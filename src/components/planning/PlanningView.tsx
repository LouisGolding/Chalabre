'use client'

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  subDays,
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
import { cn, calculateTotalTS, firstNameOnly } from '@/lib/utils'
import { colorForName, coloredTextureStyle } from '@/lib/colors'
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
  // Note libre saisie à la réservation (colonne "notes" existante,
  // réutilisée telle quelle) — convention proposée par Nicolas le
  // 27/09/2026 : 3 premières lettres du lieu d'arrivée + l'heure (ex.
  // "PAM. 14h45"), affichée au clic sur le séjour de quelqu'un d'autre
  // (voir revealedBookingId plus bas). Pas de format imposé côté code :
  // juste le texte tel que saisi dans "notes".
  notes?: string | null
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

type ViewMode = 'week' | 'fortnight' | 'month' | 'year'

// Colonne des noms : une largeur qui se resserre elle-même sur petit écran
// (clamp), pour laisser le plus de place possible aux colonnes des jours.
// En vue "mois"/"année", les colonnes des jours se partagent tout
// l'espace disponible (minmax(0, 1fr)) pour que le mois ou l'année
// tienne toujours dans la largeur de l'écran, sans scroll horizontal. En
// vue "semaine"/"quinzaine" en revanche (depuis le 28/09/2026, précisé le
// 29/09/2026 à la demande de Nicolas), les colonnes ont une largeur en
// pourcentage calculée pour que la période affichée (7 ou 14 jours)
// remplisse exactement la largeur de l'écran, sans scroll nécessaire pour
// la voir en entier — voir gridTemplateColumns plus bas. La grille
// affiche cependant, de part et d'autre, quelques jours supplémentaires
// en mémoire tampon (BUFFER_DAYS, voir rangeStart/rangeEnd) : un
// glissement horizontal fait alors apparaître les jours précédents/
// suivants sans changer de période — la navigation par les flèches reste
// le seul moyen de vraiment changer de période affichée.
const LABEL_COL = 'clamp(96px, 22vw, 190px)'

// Nombre de jours gardés en mémoire tampon de chaque côté de la période
// affichée (~1 mois, demandé par Nicolas le 29/09/2026 — d'abord 2 mois,
// réduit le même jour), pour permettre un aperçu par glissement
// horizontal sans recharger la grille — voir le commentaire ci-dessus. En
// jours (et non en nombre de périodes) pour que la profondeur du tampon
// soit la même en semaine et en quinzaine.
const BUFFER_DAYS = 30

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

// "Petite maison" (demandé par Aurélie le 21/09/2026) : une dépendance
// distincte de la maison principale, avec sa propre section sur le
// planning — même forme que Lalande/Canat (voir HouseSide dans
// src/types/index.ts).
const SECTIONS: { key: 'lalande' | 'canat' | 'petite_maison'; title: string }[] = [
  { key: 'canat', title: 'Canat' },
  { key: 'lalande', title: 'Lalande' },
  { key: 'petite_maison', title: 'Petite maison' },
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
  // Vue par défaut : "semaine", pas "mois" comme avant — depuis que le
  // mobile n'affiche plus que Semaine/Quinzaine (28/09/2026, demandé par
  // Nicolas), "mois" comme état initial n'aurait correspondu à aucune
  // pastille visible sur mobile. "Semaine" existe des deux côtés
  // (mobile et bureau), un choix neutre pour les deux.
  const [viewMode, setViewMode] = useState<ViewMode>('week')
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
  // Séjour dont la note est actuellement affichée sur sa ligne (demandé
  // par Nicolas le 27/09/2026) : pour un séjour qui n'est pas le tien
  // (booking.user_id différent du compte connecté — y compris pour un
  // admin, volontairement : voir le clic sur le segment plus bas), cliquer
  // dessus affiche sa note au lieu d'ouvrir la fenêtre d'édition ; recliquer
  // la masque à nouveau.
  const [revealedBookingId, setRevealedBookingId] = useState<string | null>(null)
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
  // Élément défilable (overflow-x-auto) de la grille en semaine/quinzaine
  // — utilisé pour repositionner le défilement sur la période affichée
  // (voir le useLayoutEffect plus bas) et pour calculer, pendant un
  // glissement, la période actuellement visible (titre en temps réel).
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const scrollRafRef = useRef<number | null>(null)

  // Période "exacte" actuellement affichée — une semaine, une quinzaine,
  // un mois ou une année, selon le bouton choisi à côté de "Aujourd'hui".
  // Sert de référence pour le titre (au repos, voir plus bas) et pour la
  // navigation (goPrev/goNext) ; rangeStart/rangeEnd ci-dessous, utilisées
  // par tout le reste de l'affichage (jours, séjours...), sont une version
  // élargie de cette période en semaine/quinzaine — voir BUFFER_DAYS.
  const periodStart = useMemo(() => {
    // "Quinzaine" (mobile uniquement, voir plus bas) : deux semaines
    // pleines, alignées sur le même début (lundi) que "semaine".
    if (viewMode === 'week' || viewMode === 'fortnight') return startOfWeek(currentDate, { weekStartsOn: 1 })
    if (viewMode === 'year') return startOfYear(currentDate)
    return startOfMonth(currentDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getTime(), viewMode])
  const periodEnd = useMemo(() => {
    if (viewMode === 'week') return endOfWeek(currentDate, { weekStartsOn: 1 })
    if (viewMode === 'fortnight') return addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 13)
    if (viewMode === 'year') return endOfYear(currentDate)
    return endOfMonth(currentDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getTime(), viewMode])
  const periodDayCount = differenceInCalendarDays(periodEnd, periodStart) + 1
  const scrollableDays = viewMode === 'week' || viewMode === 'fortnight'
  // Index (dans le tableau "days" élargi plus bas) du premier jour de la
  // période affichée — c'est aussi le nombre de jours de tampon avant
  // elle, les deux étant égaux par construction (BUFFER_DAYS jours).
  const periodStartIndex = scrollableDays ? BUFFER_DAYS : 0

  // Plage réellement utilisée pour construire la grille (jours affichés,
  // séjours, positionnement...) : élargie de BUFFER_DAYS jours de chaque
  // côté en semaine/quinzaine, pour permettre d'apercevoir les jours
  // voisins par glissement horizontal sans changer de période — identique
  // à periodStart/periodEnd en mois/année.
  const rangeStart = useMemo(() => {
    if (!scrollableDays) return periodStart
    return subDays(periodStart, BUFFER_DAYS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart.getTime(), scrollableDays])
  const rangeEnd = useMemo(() => {
    if (!scrollableDays) return periodEnd
    return addDays(periodEnd, BUFFER_DAYS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodEnd.getTime(), scrollableDays])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  )
  const dayCount = days.length

  // Index (dans "days") du premier jour actuellement visible à l'écran,
  // juste après la colonne des noms — égal à periodStartIndex au repos
  // (période exacte affichée), mis à jour en temps réel pendant un
  // glissement horizontal par handleScroll plus bas, pour que le titre
  // (entre les flèches) reflète toujours ce qui est réellement visible.
  const [displayedStartIndex, setDisplayedStartIndex] = useState(periodStartIndex)

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
    setCurrentDate((d) =>
      viewMode === 'week'
        ? subWeeks(d, 1)
        : viewMode === 'fortnight'
          ? subWeeks(d, 2)
          : viewMode === 'year'
            ? subYears(d, 1)
            : subMonths(d, 1)
    )
  }
  const goNext = () => {
    setSlideDir('next')
    setCurrentDate((d) =>
      viewMode === 'week'
        ? addWeeks(d, 1)
        : viewMode === 'fortnight'
          ? addWeeks(d, 2)
          : viewMode === 'year'
            ? addYears(d, 1)
            : addMonths(d, 1)
    )
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

  // Glissement horizontal natif (semaine/quinzaine) : recalcule, au
  // rythme de l'affichage (requestAnimationFrame), quel jour se trouve
  // actuellement juste après la colonne des noms, pour mettre à jour le
  // titre en temps réel — demandé par Nicolas le 29/09/2026. La largeur
  // d'une colonne de jour est mesurée sur firstDayCellRef (toutes les
  // colonnes ont la même largeur, voir gridTemplateColumns).
  const handleScroll = () => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const wrapper = scrollWrapperRef.current
      const dayCell = firstDayCellRef.current
      if (!wrapper || !dayCell) return
      const dayColWidth = dayCell.getBoundingClientRect().width
      if (!dayColWidth) return
      const rawIndex = Math.round(wrapper.scrollLeft / dayColWidth)
      const idx = Math.max(0, Math.min(rawIndex, dayCount - periodDayCount))
      setDisplayedStartIndex((prev) => (prev === idx ? prev : idx))
    })
  }

  // En semaine/quinzaine, le titre reflète ce qui est réellement visible à
  // l'écran (displayedStartIndex, mis à jour en temps réel pendant un
  // glissement — voir handleScroll) plutôt que la période exacte
  // (periodStart/periodEnd), pour rester cohérent avec l'aperçu des jours
  // voisins. Au repos, displayedStartIndex vaut periodStartIndex et le
  // résultat est identique à periodStart/periodEnd.
  const title = scrollableDays
    ? `${format(days[displayedStartIndex] ?? periodStart, 'd MMM', { locale: fr })} – ${format(
        days[Math.min(displayedStartIndex + periodDayCount - 1, dayCount - 1)] ?? periodEnd,
        'd MMM yyyy',
        { locale: fr }
      )}`
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
    const bySection = new Map<'lalande' | 'canat' | 'petite_maison', Map<string, Row>>([
      ['lalande', new Map()],
      ['canat', new Map()],
      ['petite_maison', new Map()],
    ])

    for (const booking of bookings) {
      // Le repli sur profiles.family_group (séjours enregistrés avant
      // l'ajout de house_side) ne peut jamais donner "petite_maison" — ce
      // n'est pas un family_group, uniquement un house_side choisi
      // explicitement pour ce séjour.
      const side =
        booking.house_side ??
        (booking.profiles?.family_group === 'canat' || booking.profiles?.family_group === 'lalande'
          ? booking.profiles.family_group
          : null)
      if (side !== 'lalande' && side !== 'canat' && side !== 'petite_maison') continue

      const checkIn = parseISO(booking.check_in)
      const checkOut = parseISO(booking.check_out)
      if (checkOut < rangeStart || checkIn > rangeEnd) continue

      // Prénom seul (pas de nom de famille) pour les comptes — demandé par
      // Nicolas le 19/09/2026. Le choix de chambre (room_label) n'est pas
      // affiché sur le planning pour l'instant : cette fonctionnalité n'est
      // pas encore développée (voir points-a-regler-avec-louis.md).
      const label = (booking.guest_name?.trim() && firstNameOnly(booking.guest_name)) || booking.profiles?.first_name || 'Séjour'
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
  // Semaine/quinzaine : la grille reçoit une largeur EXPLICITE (gridWidth)
  // au lieu de la largeur implicite (100 %) de son parent — nécessaire
  // pour que la colonne des noms (position: sticky) reste ancrée sur
  // toute la largeur réelle de la grille, y compris une fois défilée
  // jusqu'à la période courante. Les colonnes de jours se répartissent
  // ensuite cette largeur en pourcentage (calc, base = la grille
  // elle-même désormais) de sorte que periodDayCount d'entre elles
  // remplissent exactement la largeur de l'écran — les jours de tampon
  // débordent alors naturellement en dehors, provoquant le défilement
  // horizontal. Mois/année : inchangé, largeur implicite, les colonnes se
  // partagent l'espace disponible.
  //
  // bufferRatio = dayCount / periodDayCount : le tampon étant désormais
  // fixé en jours (BUFFER_DAYS, ~2 mois) plutôt qu'en nombre de périodes,
  // ce ratio n'est plus forcément un nombre entier (ex. semaine :
  // (7 + 2*60)/7 ≈ 18,14) — mais la formule calc() ci-dessous reste
  // valable avec un multiplicateur décimal.
  const bufferRatio = dayCount / periodDayCount
  const gridWidth = scrollableDays
    ? `calc(${bufferRatio} * 100% - ${bufferRatio - 1} * ${LABEL_COL})`
    : undefined
  const gridTemplateColumns = scrollableDays
    ? `${LABEL_COL} repeat(${dayCount}, calc((100% - ${LABEL_COL}) / ${dayCount}))`
    : `${LABEL_COL} repeat(${dayCount}, minmax(0, 1fr))`

  const todayIndex = differenceInCalendarDays(new Date(), rangeStart)
  const emptyLabel =
    viewMode === 'week'
      ? 'Aucun séjour cette semaine.'
      : viewMode === 'fortnight'
        ? 'Aucun séjour cette quinzaine.'
        : viewMode === 'year'
          ? 'Aucun séjour cette année.'
          : 'Aucun séjour ce mois-ci.'

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

  // Repositionne le défilement sur le début de la période affichée à
  // chaque changement de période/vue (flèches, pastilles de vue) — en
  // layout effect pour que ce repositionnement soit invisible (avant
  // peinture), sans flash de l'ancien aperçu de jours voisins.
  useLayoutEffect(() => {
    setDisplayedStartIndex(periodStartIndex)
    if (!scrollableDays) return
    const wrapper = scrollWrapperRef.current
    const dayCell = firstDayCellRef.current
    if (!wrapper || !dayCell) return
    const dayColWidth = dayCell.getBoundingClientRect().width
    if (!dayColWidth) return
    wrapper.scrollLeft = periodStartIndex * dayColWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart.getTime(), viewMode])

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
          {/* Majuscules (au lieu de capitalize, qui ne mettait en
              majuscule que la premiere lettre) demande par Nicolas le
              29/09/2026 -- le gras (font-semibold) est conserve. Taille
              remontee a 18px (mobile) / 22px (md), + tracking 0.08em --
              harmonisation typo demandee par Nicolas le 30/09/2026 (voir
              "Typographie La Batisse.pdf"). */}
          <h2 className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground min-w-[140px] text-center">
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
          {/* Pastilles de vue. Réécrites le 28/09/2026 à la demande de
              Nicolas : simples libellés texte (majuscules, gris clair,
              gris foncé une fois sélectionné), même traitement que
              "Taxe de séjour" dans le widget "Prochain séjour" (voir
              NextStayCard.tsx) — plus de bouton encadré/rempli. "Mois" et
              "Année" ne sont plus proposés sur mobile (repliés en
              hidden/md:inline) : sur petit écran il ne reste que
              "Semaine" et "Quinzaine" (nouvelle vue, deux semaines
              pleines — voir rangeStart/rangeEnd plus haut), "Quinzaine"
              elle-même masquée sur bureau (md:hidden) où elle n'a pas été
              demandée. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* Pastille "Aujourd'hui" retirée (demandé par Nicolas le
                29/09/2026) — il reste les flèches et les pastilles de vue
                ci-dessous pour naviguer. */}
            {(
              [
                { mode: 'week' as const, label: 'Semaine', responsive: '' },
                { mode: 'fortnight' as const, label: 'Quinzaine', responsive: 'md:hidden' },
                { mode: 'month' as const, label: 'Mois', responsive: 'hidden md:inline' },
                { mode: 'year' as const, label: 'Année', responsive: 'hidden md:inline' },
              ]
            ).map(({ mode, label, responsive }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  'text-xs uppercase tracking-[0.08em] transition-colors hover:text-foreground md:text-sm',
                  responsive,
                  mode === viewMode ? 'font-semibold text-foreground' : 'font-normal text-foreground/60'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille. En semaine/quinzaine, la période affichée (7/14 jours)
          remplit exactement la largeur de l'écran (voir gridTemplateColumns),
          mais quelques jours supplémentaires (~1 mois, BUFFER_DAYS) sont
          gardés en tampon de chaque côté : un glissement horizontal permet
          d'apercevoir les jours précédents/suivants — sans changer de
          période, la navigation passe toujours par les flèches uniquement
          (onWheel/onTouch* désactivés dans ce cas). Le titre (entre les
          flèches) se met à jour en temps réel pendant ce glissement — voir
          handleScroll/displayedStartIndex. En mois/année, comportement
          inchangé : tient toujours dans la largeur de l'écran, et le
          glissement (wheel/touch) change directement de période. Demandé
          par Nicolas les 28 et 29/09/2026. */}
      <div
        ref={scrollWrapperRef}
        className={scrollableDays ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}
        onWheel={scrollableDays ? undefined : handleWheel}
        onTouchStart={scrollableDays ? undefined : handleTouchStart}
        onTouchEnd={scrollableDays ? undefined : handleTouchEnd}
        onScroll={scrollableDays ? handleScroll : undefined}
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
          style={{ gridTemplateColumns, width: gridWidth }}
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
                  {/* Abréviation du jour (LUN., MAR....) : uniquement en vue
                      "semaine", où chaque colonne (~1/7 de l'écran) a la
                      place de l'afficher lisiblement. En "quinzaine", les
                      colonnes sont deux fois plus étroites (14 sur le même
                      écran) — le texte se chevaucherait illisiblement, le
                      numéro du jour seul suffit à se repérer. */}
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
                className="flex items-center bg-muted/70 py-1.5"
                style={{ gridColumn: '1 / -1', gridRow: section.sectionHeaderRow }}
              >
                {/* Le bandeau lui-même (fond gris) couvre toute la
                    largeur défilable de la grille — voir gridColumn
                    '1 / -1' — mais SON TEXTE doit rester ancré à gauche
                    pendant le défilement, comme le nom de chaque ligne
                    (row.label) juste en dessous : même traitement
                    (sticky left-0 + fond), sinon le titre défile avec le
                    reste et disparaît dès qu'on scrolle. */}
                <span className="sticky left-0 z-10 bg-muted/70 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                  className="bg-card py-2"
                  style={{ gridColumn: '1 / -1', gridRow: section.emptyRow }}
                >
                  {/* Même correction que le titre de section ci-dessus :
                      texte ancré à gauche (sticky) plutôt que défilant
                      avec le reste de la période affichée. */}
                  <span className="sticky left-0 z-10 bg-card px-3 text-sm font-light text-muted-foreground">
                    {emptyLabel}
                  </span>
                </div>
              )}

              {section.rows.map((row, idx) => {
                const gridRow = section.rowStarts[idx]
                // Estompe le prénom dans la colonne fixe quand aucun des
                // séjours de cette ligne ne recoupe la fenêtre de jours
                // actuellement visible à l'écran (displayedStartIndex, mis
                // à jour en temps réel pendant le scroll — voir
                // handleScroll) : reste lisible pour repérer une présence
                // toute proche hors écran, sans faire apparaître/
                // disparaître la ligne elle-même ni changer la hauteur de
                // la grille pendant le glissement. Toujours pleinement
                // visible en mois/année (pas de fenêtre de scroll).
                const isRowInView =
                  !scrollableDays ||
                  row.segments.some(
                    (seg) => seg.end >= displayedStartIndex && seg.start <= displayedStartIndex + periodDayCount - 1
                  )
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
                      <span
                        className={cn(
                          'truncate text-sm font-medium leading-tight transition-opacity',
                          isRowInView ? 'text-foreground' : 'text-foreground/30'
                        )}
                      >
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
                              ...coloredTextureStyle(row.color),
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
                      // "Pas le tien" au sens de ce nouveau clic = pas ton
                      // propre compte titulaire, même si tu es admin et donc
                      // techniquement autorisé à l'éditer (canEditBooking) —
                      // voir la note sur revealedBookingId plus haut.
                      const ownedByViewer = !!booking && booking.user_id === currentUserId
                      const isRevealed = revealedBookingId === seg.id
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
                            if (!ownedByViewer) {
                              // "si il y en a une" (Nicolas) : rien à
                              // afficher si le séjour n'a pas de note.
                              if (!booking?.notes?.trim()) return
                              setRevealedBookingId((prev) => (prev === seg.id ? null : seg.id))
                              return
                            }
                            setModalError(null)
                            setEditingBookingId(seg.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              if (!ownedByViewer) {
                                if (!booking?.notes?.trim()) return
                                setRevealedBookingId((prev) => (prev === seg.id ? null : seg.id))
                                return
                              }
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
                            style={{ ...coloredTextureStyle(row.color), opacity: isDragging ? 0.75 : 1 }}
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
                          {isRevealed && booking?.notes?.trim() && (
                            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                              <span className="whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium leading-none text-background shadow-sm">
                                {booking.notes.trim()}
                              </span>
                            </div>
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
            label: (editingBooking.guest_name?.trim() && firstNameOnly(editingBooking.guest_name)) || editingBooking.profiles?.first_name || 'Séjour',
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
