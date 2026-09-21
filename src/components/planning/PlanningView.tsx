'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  isToday,
  isWeekend,
  parseISO,
  differenceInCalendarDays,
  differenceInYears,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addYears,
  subYears,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, calculateTotalTS } from '@/lib/utils'
import { colorForName } from '@/lib/colors'
import { BookingEditModal } from '@/components/planning/BookingEditModal'
import type { HouseSide } from '@/types'

export interface PlanningBooking {
  id: string
  // Titulaire du compte sur lequel ce séjour est enregistré (jamais
  // renseigné sur les données de test — voir canEditBooking ci-dessous,
  // qui les laisse alors non modifiables). Sert à savoir qui peut éditer
  // ce séjour depuis le planning (lui-même, ou un admin).
  user_id?: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  room_label?: string | null
  profiles?: {
    first_name: string
    last_name: string
    family_group: string
    // Pour déduire une tranche d'âge par défaut (enfant/adulte) à l'édition
    // depuis le planning, faute de tranche d'âge mémorisée en base pour un
    // séjour déjà saisi — voir inferAgeRate plus bas.
    date_of_birth?: string | null
  } | null
  // Couleur de la personne, déjà résolue côté serveur (compte ou
  // accompagnant mémorisé — voir src/app/dashboard/planning/page.tsx et
  // src/lib/colors.ts). Toujours la même pour une personne donnée, quelle
  // que soit la période affichée. Absente ⇒ repli calculé depuis le nom
  // (voir colorForName plus bas), pour les données de test notamment.
  color?: string | null
}

export interface PlanningEvent {
  id: string
  title: string
  start_date: string
  end_date: string
}

interface PlanningViewProps {
  bookings: PlanningBooking[]
  // Sous le contrôle du parent (PlanningPageClient.tsx) plutôt qu'un état
  // interne : le widget "Prochain séjour" (ReserverSejour.tsx, juste
  // au-dessus sur la page) enregistre aussi des séjours, et sa ligne
  // colorée doit apparaître ici instantanément — les deux partagent donc
  // la même source de vérité côté client (demandé par Aurélie le
  // 21/09/2026).
  onBookingsChange: (updater: PlanningBooking[] | ((prev: PlanningBooking[]) => PlanningBooking[])) => void
  events: PlanningEvent[]
  // Pour savoir quelles lignes colorées l'utilisateur courant peut éditer
  // depuis le planning (cliquer/glisser) : les siennes, ou toutes si admin
  // — même règle que la RLS bookings_update/delete (voir schema.sql) et que
  // /api/bookings/quick, qui la vérifie aussi côté serveur. Demandé par
  // Nicolas le 21/09/2026.
  currentUserId: string
  isAdmin: boolean
}

type ViewMode = 'week' | 'month' | 'year'

// Colonne des noms : une largeur qui se resserre elle-même sur petit écran
// (clamp), pour laisser le plus de place possible aux colonnes des jours.
// Les colonnes des jours n'ont plus de largeur minimale en pixels : elles se
// partagent tout l'espace disponible (minmax(0, 1fr)) pour que la semaine,
// le mois ou l'année tienne toujours dans la largeur de l'écran, sans
// scroll horizontal pour voir le reste de la période affichée.
const LABEL_COL = 'clamp(96px, 22vw, 190px)'

interface Segment {
  id: string
  start: number
  end: number
  startsInRange: boolean
  endsInRange: boolean
}

interface Row {
  key: string
  label: string
  color: string
  segments: Segment[]
}

const SECTIONS: { key: 'lalande' | 'canat'; title: string }[] = [
  { key: 'lalande', title: 'Lalande' },
  { key: 'canat', title: 'Canat' },
]

// Seuils des gestes de navigation (glisser au trackpad/souris ou au doigt)
// pour passer à la période suivante/précédente — voir handleWheel /
// handleTouchStart / handleTouchEnd plus bas.
const WHEEL_THRESHOLD = 40
const TOUCH_THRESHOLD = 50
const WHEEL_COOLDOWN_MS = 500

// En dessous de ce déplacement (en pixels), un glisser sur une ligne
// colorée est considéré comme un simple clic (ouvre la modale d'édition)
// plutôt qu'un déplacement/redimensionnement — voir handlePointerUpOnSegment.
const DRAG_CLICK_THRESHOLD_PX = 4

function clampDateToRange(date: Date, rangeStart: Date, rangeEnd: Date): Date {
  if (date < rangeStart) return rangeStart
  if (date > rangeEnd) return rangeEnd
  return date
}

// Même logique que la construction des segments dans rowsBySection
// ci-dessous, réutilisée pour l'aperçu en direct d'un glisser en cours
// (voir DragState) : convertit une paire de dates réelles en position dans
// la grille (colonnes de jours) pour la période actuellement affichée.
function segmentFromDates(checkIn: Date, checkOut: Date, rangeStart: Date, rangeEnd: Date) {
  const clampedStart = clampDateToRange(checkIn, rangeStart, rangeEnd)
  const clampedEnd = clampDateToRange(checkOut, rangeStart, rangeEnd)
  return {
    start: differenceInCalendarDays(clampedStart, rangeStart),
    end: differenceInCalendarDays(clampedEnd, rangeStart),
    startsInRange: !(checkIn < rangeStart),
    endsInRange: !(checkOut > rangeEnd),
  }
}

// Un séjour est modifiable depuis le planning par son titulaire, ou par un
// admin — même règle que la RLS bookings_update/delete (voir schema.sql).
// Les données de test (isDev, voir planning/page.tsx) n'ont pas de user_id
// : jamais modifiables, cohérent avec le commentaire qui les accompagne
// ("à retirer une fois la mise en forme validée").
function canEditBooking(booking: PlanningBooking, currentUserId: string, isAdmin: boolean): boolean {
  return !!booking.user_id && (isAdmin || booking.user_id === currentUserId)
}

// Tranche d'âge par défaut pour recalculer la taxe de séjour d'un séjour
// existant (glisser ou modale) : déduite de la date de naissance du
// titulaire du compte, comme sur la page d'accueil (NextStayCard.tsx) ; à
// défaut (accompagnant sans compte, ou date de naissance absente) —
// "adulte" par défaut, comme StayEntry pour un accompagnant. Aucune
// tranche d'âge n'est mémorisée en base pour un séjour déjà saisi, d'où ce
// recalcul systématique plutôt qu'une valeur mémorisée qui pourrait dater
// de l'ancienne période du séjour.
function inferAgeRate(booking: PlanningBooking): number {
  if (booking.guest_name) return 20
  const dob = booking.profiles?.date_of_birth
  if (!dob) return 20
  const age = differenceInYears(new Date(), parseISO(dob))
  return age >= 16 ? 20 : 10
}

type DragMode = 'move' | 'resize-left' | 'resize-right'

interface DragState {
  bookingId: string
  mode: DragMode
  pointerId: number
  startClientX: number
  pxPerDay: number
  trueCheckIn: Date
  trueCheckOut: Date
  currentCheckIn: Date
  currentCheckOut: Date
  moved: boolean
}

export function PlanningView({ bookings, onBookingsChange, events, currentUserId, isAdmin }: PlanningViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  // Direction du dernier changement de période, pour l'animation de
  // glissement (slide) — appliquée aussi bien depuis les flèches que
  // depuis un geste de glissement sur le planning.
  const [slideDir, setSlideDir] = useState<'next' | 'prev'>('next')
  const wheelLocked = useRef(false)
  const touchStartX = useRef<number | null>(null)

  // Mise à jour optimiste des séjours (glisser, modale d'édition, ou widget
  // "Prochain séjour" au-dessus) directement dans l'état du parent — voir
  // onBookingsChange ci-dessus. La source de vérité reste Supabase — un
  // rechargement de page reprend toujours les données à jour du serveur.
  const setBookings = onBookingsChange
  const bookingsById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings])

  const [drag, setDrag] = useState<DragState | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  // Largeur d'une colonne de jour, mesurée au clic/glisser sur une ligne
  // colorée (voir handlePointerDownOnSegment) : les colonnes de jours étant
  // réparties à parts égales (minmax(0, 1fr)), la largeur de la première
  // suffit à convertir un déplacement en pixels en un nombre de jours.
  const firstDayCellRef = useRef<HTMLDivElement | null>(null)
  // Évite qu'un clic natif, qui peut survenir juste après un glisser réel
  // selon les navigateurs (le préventDefault sur pointerup ne le garantit
  // pas toujours), ne rouvre la modale d'édition juste après un
  // déplacement/redimensionnement déjà enregistré.
  const justDraggedRef = useRef(false)

  // Plage de dates actuellement affichée — une semaine, un mois ou une
  // année entière selon le bouton choisi à côté de "Aujourd'hui".
  const rangeStart = useMemo(() => {
    if (viewMode === 'week') return startOfWeek(currentDate, { weekStartsOn: 1 })
    if (viewMode === 'year') return startOfYear(currentDate)
    return startOfMonth(currentDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getTime(), viewMode])
  const rangeEnd = useMemo(() => {
    if (viewMode === 'week') return endOfWeek(currentDate, { weekStartsOn: 1 })
    if (viewMode === 'year') return endOfYear(currentDate)
    return endOfMonth(currentDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getTime(), viewMode])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  )
  const dayCount = days.length

  // Bandeaux de mois affichés en en-tête de la vue année (à la place des
  // numéros de jour, illisibles à cette échelle).
  const monthBands = useMemo(() => {
    if (viewMode !== 'year') return []
    return Array.from({ length: 12 }, (_, m) => {
      const mStart = new Date(rangeStart.getFullYear(), m, 1)
      const mEnd = endOfMonth(mStart)
      return {
        key: m,
        label: format(mStart, 'MMM', { locale: fr }),
        start: differenceInCalendarDays(mStart, rangeStart),
        end: differenceInCalendarDays(mEnd, rangeStart),
      }
    })
  }, [viewMode, rangeStart])

  const goPrev = () => {
    setSlideDir('prev')
    setCurrentDate((d) => (viewMode === 'week' ? subWeeks(d, 1) : viewMode === 'year' ? subYears(d, 1) : subMonths(d, 1)))
  }
  const goNext = () => {
    setSlideDir('next')
    setCurrentDate((d) => (viewMode === 'week' ? addWeeks(d, 1) : viewMode === 'year' ? addYears(d, 1) : addMonths(d, 1)))
  }

  // Glisser au trackpad/souris (molette horizontale) sur le planning fait
  // passer à la période suivante/précédente, comme sur une appli de
  // calendrier mobile — verrouillage court pour ne déclencher qu'une seule
  // navigation par geste.
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < WHEEL_THRESHOLD) return
    if (wheelLocked.current) return
    wheelLocked.current = true
    if (e.deltaX > 0) goNext()
    else goPrev()
    setTimeout(() => {
      wheelLocked.current = false
    }, WHEEL_COOLDOWN_MS)
  }

  // Glisser au doigt (tactile) : même principe, sur le geste de fin de
  // glissement (touchend) pour éviter les déclenchements accidentels.
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < TOUCH_THRESHOLD) return
    if (delta < 0) goNext()
    else goPrev()
  }

  const title =
    viewMode === 'week'
      ? `${format(rangeStart, 'd MMM', { locale: fr })} – ${format(rangeEnd, 'd MMM yyyy', { locale: fr })}`
      : viewMode === 'year'
        ? format(currentDate, 'yyyy')
        : format(currentDate, 'MMMM yyyy', { locale: fr })

  // Une ligne par occupant (nom + côté de la maison) : deux séjours du même
  // occupant dans la plage affichée (ex. Alex en Lalande, début et fin de
  // mois) partagent la même ligne plutôt que d'en ouvrir une seconde. La
  // couleur de la ligne est celle de la personne (booking.color, résolue
  // côté serveur — voir page.tsx), toujours la même d'une période à
  // l'autre ; à défaut (données de test), calculée depuis le nom.
  const rowsBySection = useMemo(() => {
    const bySection = new Map<'lalande' | 'canat', Map<string, Row>>([
      ['lalande', new Map()],
      ['canat', new Map()],
    ])

    for (const booking of bookings) {
      const side =
        booking.house_side ??
        (booking.profiles?.family_group === 'canat' || booking.profiles?.family_group === 'lalande'
          ? booking.profiles.family_group
          : null)
      if (side !== 'lalande' && side !== 'canat') continue

      const checkIn = parseISO(booking.check_in)
      const checkOut = parseISO(booking.check_out)
      if (checkOut < rangeStart || checkIn > rangeEnd) continue

      // Prénom seul (pas de nom de famille) pour les comptes — demandé par
      // Nicolas le 19/09/2026. Le choix de chambre (room_label) n'est pas
      // affiché sur le planning pour l'instant : cette fonctionnalité n'est
      // pas encore développée (voir points-a-regler-avec-louis.md).
      const label = booking.guest_name?.trim() || booking.profiles?.first_name || 'Séjour'
      const rowKey = `${side}::${label}`
      const sectionRows = bySection.get(side)!

      if (!sectionRows.has(rowKey)) {
        sectionRows.set(rowKey, {
          key: rowKey,
          label,
          color: booking.color ?? colorForName(label),
          segments: [],
        })
      }

      const row = sectionRows.get(rowKey)!
      row.segments.push({ id: booking.id, ...segmentFromDates(checkIn, checkOut, rangeStart, rangeEnd) })
    }

    return bySection
  }, [bookings, rangeStart, rangeEnd])

  // Une ligne par événement (nom en colonne de gauche, comme pour un
  // occupant), regroupées sous un bandeau "Événements" — même forme que
  // les sections Lalande/Canat, demandé par Nicolas le 19/09/2026.
  const eventRows = useMemo(() => {
    const rows: Row[] = []
    for (const event of events) {
      const start = parseISO(event.start_date)
      const end = parseISO(event.end_date)
      if (end < rangeStart || start > rangeEnd) continue
      rows.push({
        key: event.id,
        label: event.title,
        color: colorForName(event.title),
        segments: [{ id: event.id, ...segmentFromDates(start, end, rangeStart, rangeEnd) }],
      })
    }
    return rows
  }, [events, rangeStart, rangeEnd])

  // Construction des index de lignes de la grille : en-tête des jours, puis
  // le bandeau "Événements" (s'il y en a), puis un bandeau + des lignes par
  // famille — calculé une fois par rendu, dans cet ordre d'affichage. Le
  // décompte de présence par jour (demandé par Nicolas le 19/09/2026) n'est
  // calculé que pour les familles (Lalande/Canat), pas pour les événements.
  let rowCursor = 0
  const headerRow = rowCursor + 1
  rowCursor = headerRow

  const sectionDefs: {
    key: string
    title: string
    rows: Row[]
    showEmptyState: boolean
    showDayCounts: boolean
    // Seules les sections Lalande/Canat correspondent à de vrais séjours
    // (bookingsById) : les événements ne sont ni cliquables ni glissables
    // ici (hors périmètre de cette fonctionnalité).
    interactive: boolean
  }[] = [
    ...(eventRows.length > 0
      ? [{ key: 'events', title: 'Événements', rows: eventRows, showEmptyState: false, showDayCounts: false, interactive: false }]
      : []),
    ...SECTIONS.map(({ key, title }) => ({
      key,
      title,
      rows: Array.from(rowsBySection.get(key)?.values() ?? []),
      showEmptyState: true,
      showDayCounts: true,
      interactive: true,
    })),
  ]

  const sections = sectionDefs.map((def) => {
    const sectionHeaderRow = rowCursor + 1
    rowCursor = sectionHeaderRow
    let emptyRow: number | null = null
    const rowStarts: number[] = []
    if (def.rows.length === 0) {
      if (def.showEmptyState) {
        emptyRow = rowCursor + 1
        rowCursor = emptyRow
      }
    } else {
      for (let i = 0; i < def.rows.length; i++) {
        rowCursor += 1
        rowStarts.push(rowCursor)
      }
    }
    let dayCounts: number[] | null = null
    if (def.showDayCounts) {
      dayCounts = new Array(dayCount).fill(0)
      for (const row of def.rows) {
        for (const seg of row.segments) {
          const from = Math.max(0, seg.start)
          const to = Math.min(dayCount - 1, seg.end)
          for (let d = from; d <= to; d++) dayCounts[d]++
        }
      }
    }
    return { key: def.key, title: def.title, rows: def.rows, sectionHeaderRow, rowStarts, emptyRow, dayCounts, interactive: def.interactive }
  })

  const totalRows = rowCursor
  const gridTemplateColumns = `${LABEL_COL} repeat(${dayCount}, minmax(0, 1fr))`

  const todayIndex = differenceInCalendarDays(new Date(), rangeStart)
  const emptyLabel =
    viewMode === 'week' ? 'Aucun séjour cette semaine.' : viewMode === 'year' ? 'Aucun séjour cette année.' : 'Aucun séjour ce mois-ci.'

  // ============================================================
  // Édition directe depuis la ligne colorée (demandé par Nicolas le
  // 21/09/2026) : cliquer ouvre la modale d'édition (dates exactes, âge,
  // côté de la maison, suppression) ; glisser le corps de la barre la
  // déplace (mêmes dates décalées d'autant) ; glisser un de ses bords
  // l'étend ou la raccourcit de ce côté. Fonctionne aussi sur un séjour
  // déjà passé — aucune restriction de date ici ni côté API.
  // ============================================================

  const persistDates = async (bookingId: string, newCheckIn: Date, newCheckOut: Date) => {
    const booking = bookingsById.get(bookingId)
    if (!booking) return
    setSavingBookingId(bookingId)
    setModalError(null)
    const ageRate = inferAgeRate(booking)
    const amount = calculateTotalTS(newCheckIn, newCheckOut, ageRate, true)
    const checkInStr = format(newCheckIn, 'yyyy-MM-dd')
    const checkOutStr = format(newCheckOut, 'yyyy-MM-dd')
    try {
      const res = await fetch('/api/bookings/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: checkInStr,
          checkOut: checkOutStr,
          amount,
          bookingId,
          guestName: booking.guest_name ?? undefined,
          houseSide: booking.house_side,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, check_in: checkInStr, check_out: checkOutStr } : b))
      )
      return true
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
      return false
    } finally {
      setSavingBookingId(null)
    }
  }

  const handleModalSave = async (
    bookingId: string,
    checkIn: string,
    checkOut: string,
    houseSide: HouseSide,
    ageBracket: 'child' | 'adult'
  ) => {
    const booking = bookingsById.get(bookingId)
    if (!booking) return
    setSavingBookingId(bookingId)
    setModalError(null)
    const amount = calculateTotalTS(new Date(checkIn), new Date(checkOut), ageBracket === 'child' ? 10 : 20, true)
    try {
      const res = await fetch('/api/bookings/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn,
          checkOut,
          amount,
          bookingId,
          guestName: booking.guest_name ?? undefined,
          houseSide,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, check_in: checkIn, check_out: checkOut, house_side: houseSide } : b))
      )
      setEditingBookingId(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setSavingBookingId(null)
    }
  }

  const handleModalDelete = async (bookingId: string) => {
    setSavingBookingId(bookingId)
    setModalError(null)
    try {
      const res = await fetch(`/api/bookings/quick?id=${bookingId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la suppression')
      setBookings((prev) => prev.filter((b) => b.id !== bookingId))
      setEditingBookingId(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setSavingBookingId(null)
    }
  }

  const handlePointerDownOnSegment = (e: React.PointerEvent, bookingId: string, mode: DragMode) => {
    if (e.pointerType === 'touch') return // pas de glisser tactile : voir onClick, qui reste disponible
    if (viewMode === 'year') return
    const booking = bookingsById.get(bookingId)
    if (!booking || !canEditBooking(booking, currentUserId, isAdmin)) return
    const pxPerDay = firstDayCellRef.current?.getBoundingClientRect().width || 0
    if (!pxPerDay) return

    e.stopPropagation()
    const trueCheckIn = parseISO(booking.check_in)
    const trueCheckOut = parseISO(booking.check_out)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({
      bookingId,
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      pxPerDay,
      trueCheckIn,
      trueCheckOut,
      currentCheckIn: trueCheckIn,
      currentCheckOut: trueCheckOut,
      moved: false,
    })
  }

  const handlePointerMoveOnSegment = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const deltaPx = e.clientX - drag.startClientX
    const deltaDays = Math.round(deltaPx / drag.pxPerDay)

    let newCheckIn = drag.trueCheckIn
    let newCheckOut = drag.trueCheckOut
    if (drag.mode === 'move') {
      newCheckIn = addDays(drag.trueCheckIn, deltaDays)
      newCheckOut = addDays(drag.trueCheckOut, deltaDays)
    } else if (drag.mode === 'resize-left') {
      newCheckIn = addDays(drag.trueCheckIn, deltaDays)
      if (newCheckIn >= drag.trueCheckOut) newCheckIn = addDays(drag.trueCheckOut, -1)
    } else {
      newCheckOut = addDays(drag.trueCheckOut, deltaDays)
      if (newCheckOut <= drag.trueCheckIn) newCheckOut = addDays(drag.trueCheckIn, 1)
    }

    setDrag((prev) =>
      prev
        ? {
            ...prev,
            currentCheckIn: newCheckIn,
            currentCheckOut: newCheckOut,
            moved: prev.moved || Math.abs(deltaPx) > DRAG_CLICK_THRESHOLD_PX,
          }
        : prev
    )
  }

  const handlePointerUpOnSegment = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const finished = drag
    setDrag(null)
    if (!finished.moved) return // pas de déplacement réel : laisse le clic natif ouvrir la modale
    e.preventDefault()
    justDraggedRef.current = true
    setTimeout(() => {
      justDraggedRef.current = false
    }, 0)
    void persistDates(finished.bookingId, finished.currentCheckIn, finished.currentCheckOut)
  }

  const editingBooking = editingBookingId ? bookingsById.get(editingBookingId) ?? null : null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Navigation + vue */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="bg-card/40 backdrop-blur-sm"
            onClick={goPrev}
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground capitalize min-w-[140px] text-center">
            {title}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="bg-card/40 backdrop-blur-sm"
            onClick={goNext}
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { mode: 'week' as const, label: 'Semaine' },
                { mode: 'month' as const, label: 'Mois' },
                { mode: 'year' as const, label: 'Année' },
              ]
            ).map(({ mode, label }) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant="outline"
                className={
                  mode === viewMode
                    ? 'bg-foreground text-background hover:bg-foreground/80'
                    : 'bg-card/40 backdrop-blur-sm'
                }
                onClick={() => setViewMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-card/40 backdrop-blur-sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd&apos;hui
          </Button>
        </div>
      </div>

      {/* Grille — tient toujours dans la largeur de l'écran (pas de scroll
          horizontal) ; se glisse aussi à la souris/trackpad ou au doigt
          pour changer de période. */}
      <div
        className="overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={rangeStart.getTime()}
          className={cn(
            'relative grid animate-in fade-in-0 duration-200',
            slideDir === 'next' ? 'slide-in-from-right-2' : 'slide-in-from-left-2',
            // Évite la sélection de texte (nom de la ligne, numéros de
            // jour...) pendant qu'on glisse une barre de séjour.
            drag ? 'select-none' : ''
          )}
          style={{ gridTemplateColumns }}
        >
          {/* Bandes week-end, en arrière-plan, sur toute la hauteur (pas en vue année, trop dense) */}
          {viewMode !== 'year' &&
            days.map((day, i) =>
              isWeekend(day) ? (
                <div
                  key={`we-${i}`}
                  className="bg-foreground/[0.04]"
                  style={{ gridColumn: i + 2, gridRow: `1 / ${totalRows + 1}` }}
                />
              ) : null
            )}

          {/* Repère "aujourd'hui" (vue année seulement, où il n'y a pas de puce par jour) */}
          {viewMode === 'year' && todayIndex >= 0 && todayIndex < dayCount && (
            <div
              className="bg-primary/40"
              style={{ gridColumn: todayIndex + 2, gridRow: `1 / ${totalRows + 1}` }}
            />
          )}

          {/* En-tête : numéros de jour (semaine/mois) ou bandeaux de mois (année) */}
          <div
            className="sticky left-0 z-10 border-b border-border bg-card"
            style={{ gridColumn: 1, gridRow: headerRow }}
          />
          {viewMode === 'year'
            ? monthBands.map((band) => (
                <div
                  key={band.key}
                  className="flex min-w-0 items-center justify-center overflow-hidden border-b border-l border-border py-2 text-xs font-medium capitalize text-muted-foreground"
                  style={{ gridColumn: `${band.start + 2} / ${band.end + 3}`, gridRow: headerRow }}
                >
                  {band.label}
                </div>
              ))
            : days.map((day, i) => (
                <div
                  key={i}
                  ref={i === 0 ? firstDayCellRef : undefined}
                  className="flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden border-b border-border py-2"
                  style={{ gridColumn: i + 2, gridRow: headerRow }}
                >
                  {viewMode === 'week' && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {format(day, 'EEE', { locale: fr })}
                    </span>
                  )}
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday(day) ? 'bg-foreground text-background' : 'text-muted-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
              ))}

          {/* Sections : Événements (si présents), puis Lalande / Canat —
              même forme pour toutes (bandeau gris + une ligne par nom, ex.
              Nico/Auré/Guy ou le nom d'un événement), demandé par Nicolas
              le 19/09/2026. Le bandeau des familles porte en plus, par
              jour, un décompte des personnes présentes ce jour-là. */}
          {sections.map((section) => (
            <Fragment key={section.key}>
              <div
                className="flex items-center bg-muted/70 px-3 py-1.5"
                style={{ gridColumn: '1 / -1', gridRow: section.sectionHeaderRow }}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </span>
              </div>

              {section.dayCounts &&
                viewMode !== 'year' &&
                days.map((day, i) => {
                  const count = section.dayCounts![i]
                  if (!count) return null
                  return (
                    <div
                      key={`count-${section.key}-${i}`}
                      className="flex items-center justify-center text-[10px] font-light text-muted-foreground"
                      style={{ gridColumn: i + 2, gridRow: section.sectionHeaderRow }}
                    >
                      {count}
                    </div>
                  )
                })}

              {section.rows.length === 0 && section.emptyRow && (
                <div
                  className="bg-card px-3 py-2 text-sm font-light text-muted-foreground"
                  style={{ gridColumn: '1 / -1', gridRow: section.emptyRow }}
                >
                  {emptyLabel}
                </div>
              )}

              {section.rows.map((row, idx) => {
                const gridRow = section.rowStarts[idx]
                return (
                  <Fragment key={row.key}>
                    <div
                      className="border-b border-border/60"
                      style={{ gridColumn: '1 / -1', gridRow }}
                    />
                    <div
                      className="sticky left-0 z-10 flex min-w-0 items-center bg-card px-3 py-0.5"
                      style={{ gridColumn: 1, gridRow }}
                    >
                      <span className="truncate text-sm font-medium leading-tight text-foreground">
                        {row.label}
                      </span>
                    </div>
                    {row.segments.map((seg) => {
                      if (!section.interactive) {
                        // Ligne d'événement : affichage seul, inchangé.
                        return (
                          <div
                            key={seg.id}
                            className={cn(
                              'h-4 min-w-0 self-center overflow-hidden',
                              seg.startsInRange ? 'rounded-l-full' : '',
                              seg.endsInRange ? 'rounded-r-full' : ''
                            )}
                            style={{
                              gridColumn: `${seg.start + 2} / ${seg.end + 3}`,
                              gridRow,
                              backgroundColor: row.color,
                            }}
                            title={`${row.label} · du ${format(
                              days[Math.min(seg.start, dayCount - 1)] ?? rangeStart,
                              'd MMM',
                              { locale: fr }
                            )} au ${format(days[Math.min(seg.end, dayCount - 1)] ?? rangeEnd, 'd MMM', {
                              locale: fr,
                            })}`}
                          />
                        )
                      }

                      const booking = bookingsById.get(seg.id)
                      const editable = !!booking && canEditBooking(booking, currentUserId, isAdmin)
                      const isDragging = drag?.bookingId === seg.id
                      const displaySeg = isDragging
                        ? { ...segmentFromDates(drag!.currentCheckIn, drag!.currentCheckOut, rangeStart, rangeEnd) }
                        : seg
                      const tooltipCheckIn = isDragging ? drag!.currentCheckIn : days[Math.min(seg.start, dayCount - 1)] ?? rangeStart
                      const tooltipCheckOut = isDragging ? drag!.currentCheckOut : days[Math.min(seg.end, dayCount - 1)] ?? rangeEnd
                      const canDrag = editable && viewMode !== 'year'

                      // La zone cliquable/glissable ("déplacer") couvre toute la
                      // hauteur de la ligne (pas seulement la barre visuelle de 16px,
                      // trop fine à viser précisément) : les poignées de redimensionnement
                      // (bords gauche/droit) sont posées par-dessus et interceptent leurs
                      // propres clics en premier (stopPropagation dans
                      // handlePointerDownOnSegment).
                      return (
                        <div
                          key={seg.id}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) => handlePointerDownOnSegment(e, seg.id, 'move')}
                          onPointerMove={handlePointerMoveOnSegment}
                          onPointerUp={handlePointerUpOnSegment}
                          onClick={() => {
                            if (justDraggedRef.current) return
                            setModalError(null)
                            setEditingBookingId(seg.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setModalError(null)
                              setEditingBookingId(seg.id)
                            }
                          }}
                          className={cn(
                            'relative flex h-full min-w-0 items-center outline-none',
                            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                          )}
                          style={{ gridColumn: `${displaySeg.start + 2} / ${displaySeg.end + 3}`, gridRow }}
                          title={`${row.label} · du ${format(tooltipCheckIn, 'd MMM', { locale: fr })} au ${format(
                            tooltipCheckOut,
                            'd MMM',
                            { locale: fr }
                          )}`}
                        >
                          <div
                            className={cn(
                              'h-4 min-w-0 w-full overflow-hidden',
                              displaySeg.startsInRange ? 'rounded-l-full' : '',
                              displaySeg.endsInRange ? 'rounded-r-full' : ''
                            )}
                            style={{ backgroundColor: row.color, opacity: isDragging ? 0.75 : 1 }}
                          />
                          {canDrag && displaySeg.startsInRange && (
                            <div
                              onPointerDown={(e) => handlePointerDownOnSegment(e, seg.id, 'resize-left')}
                              onPointerMove={handlePointerMoveOnSegment}
                              onPointerUp={handlePointerUpOnSegment}
                              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                              aria-hidden="true"
                            />
                          )}
                          {canDrag && displaySeg.endsInRange && (
                            <div
                              onPointerDown={(e) => handlePointerDownOnSegment(e, seg.id, 'resize-right')}
                              onPointerMove={handlePointerMoveOnSegment}
                              onPointerUp={handlePointerUpOnSegment}
                              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {editingBooking && (
        <BookingEditModal
          booking={{
            id: editingBooking.id,
            check_in: editingBooking.check_in,
            check_out: editingBooking.check_out,
            house_side: editingBooking.house_side,
            label: editingBooking.guest_name?.trim() || editingBooking.profiles?.first_name || 'Séjour',
            ageRateHint: inferAgeRate(editingBooking),
          }}
          editable={canEditBooking(editingBooking, currentUserId, isAdmin)}
          saving={savingBookingId === editingBooking.id}
          error={modalError}
          onClose={() => {
            setEditingBookingId(null)
            setModalError(null)
          }}
          onSave={(checkIn, checkOut, houseSide, ageBracket) =>
            handleModalSave(editingBooking.id, checkIn, checkOut, houseSide, ageBracket)
          }
          onDelete={() => handleModalDelete(editingBooking.id)}
        />
      )}
    </div>
  )
}
