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
import { cn } from '@/lib/utils'
import { colorForName } from '@/lib/colors'

export interface PlanningBooking {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: 'lalande' | 'canat' | null
  room_label?: string | null
  profiles?: { first_name: string; last_name: string; family_group: string } | null
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
  events: PlanningEvent[]
}

type ViewMode = 'week' | 'month' | 'year'

// Colonne des noms : une largeur qui se resserre elle-même sur petit écran
// (clamp), pour laisser le plus de place possible aux colonnes des jours.
// Les colonnes des jours n'ont plus de largeur minimale en pixels : elles se
// partagent tout l'espace disponible (minmax(0, 1fr)) pour que la semaine,
// le mois ou l'année tienne toujours dans la largeur de l'écran, sans
// scroll horizontal pour voir le reste de la période affichée.
const LABEL_COL = 'clamp(96px, 22vw, 190px)'

interface Row {
  key: string
  label: string
  color: string
  segments: { id: string; start: number; end: number; startsInRange: boolean; endsInRange: boolean }[]
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

export function PlanningView({ bookings, events }: PlanningViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  // Direction du dernier changement de période, pour l'animation de
  // glissement (slide) — appliquée aussi bien depuis les flèches que
  // depuis un geste de glissement sur le planning.
  const [slideDir, setSlideDir] = useState<'next' | 'prev'>('next')
  const wheelLocked = useRef(false)
  const touchStartX = useRef<number | null>(null)

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

      const clampedStart = checkIn < rangeStart ? rangeStart : checkIn
      const clampedEnd = checkOut > rangeEnd ? rangeEnd : checkOut
      row.segments.push({
        id: booking.id,
        start: differenceInCalendarDays(clampedStart, rangeStart),
        end: differenceInCalendarDays(clampedEnd, rangeStart),
        startsInRange: !(checkIn < rangeStart),
        endsInRange: !(checkOut > rangeEnd),
      })
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
      const clampedStart = start < rangeStart ? rangeStart : start
      const clampedEnd = end > rangeEnd ? rangeEnd : end
      rows.push({
        key: event.id,
        label: event.title,
        color: colorForName(event.title),
        segments: [
          {
            id: event.id,
            start: differenceInCalendarDays(clampedStart, rangeStart),
            end: differenceInCalendarDays(clampedEnd, rangeStart),
            startsInRange: !(start < rangeStart),
            endsInRange: !(end > rangeEnd),
          },
        ],
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

  const sectionDefs: { key: string; title: string; rows: Row[]; showEmptyState: boolean; showDayCounts: boolean }[] = [
    ...(eventRows.length > 0
      ? [{ key: 'events', title: 'Événements', rows: eventRows, showEmptyState: false, showDayCounts: false }]
      : []),
    ...SECTIONS.map(({ key, title }) => ({
      key,
      title,
      rows: Array.from(rowsBySection.get(key)?.values() ?? []),
      showEmptyState: true,
      showDayCounts: true,
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
    return { key: def.key, title: def.title, rows: def.rows, sectionHeaderRow, rowStarts, emptyRow, dayCounts }
  })

  const totalRows = rowCursor
  const gridTemplateColumns = `${LABEL_COL} repeat(${dayCount}, minmax(0, 1fr))`

  const todayIndex = differenceInCalendarDays(new Date(), rangeStart)
  const emptyLabel =
    viewMode === 'week' ? 'Aucun séjour cette semaine.' : viewMode === 'year' ? 'Aucun séjour cette année.' : 'Aucun séjour ce mois-ci.'

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
            slideDir === 'next' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'
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
                    {row.segments.map((seg) => (
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
                    ))}
                  </Fragment>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
