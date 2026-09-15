'use client'

import { useMemo, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BookingLike {
  id: string
  check_in: string
  check_out: string
  user_id: string
  profiles?: { first_name: string; last_name: string; family_group: string } | null
}

interface EventLike {
  id: string
  title: string
  start_date: string
  end_date: string
}

interface PlanningViewProps {
  bookings: BookingLike[]
  events: EventLike[]
}

// Palette de couleurs distinctes, une par personne (attribuée par ordre
// d'apparition et stable tant que la liste de réservations ne change pas).
const PERSON_COLORS = [
  { bar: 'bg-sky-500', text: 'text-white' },
  { bar: 'bg-emerald-500', text: 'text-white' },
  { bar: 'bg-violet-500', text: 'text-white' },
  { bar: 'bg-rose-500', text: 'text-white' },
  { bar: 'bg-orange-500', text: 'text-white' },
  { bar: 'bg-cyan-500', text: 'text-white' },
  { bar: 'bg-indigo-500', text: 'text-white' },
  { bar: 'bg-pink-500', text: 'text-white' },
  { bar: 'bg-lime-600', text: 'text-white' },
  { bar: 'bg-teal-500', text: 'text-white' },
  { bar: 'bg-fuchsia-500', text: 'text-white' },
  { bar: 'bg-blue-500', text: 'text-white' },
]

interface WeekBar {
  bookingId: string
  personId: string
  personName: string
  colorIndex: number
  startCol: number // 0-6, colonne de la semaine où la barre commence
  endCol: number // 0-6, colonne de la semaine où la barre se termine
  isStart: boolean // le séjour commence réellement dans cette semaine
  isEnd: boolean // le séjour se termine réellement dans cette semaine
  lane: number
}

function packLanes(
  items: { key: string; start: number; end: number }[]
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()

  for (const item of sorted) {
    let placedLane = -1
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] < item.start) {
        placedLane = lane
        break
      }
    }
    if (placedLane === -1) {
      placedLane = laneEnds.length
      laneEnds.push(item.end)
    } else {
      laneEnds[placedLane] = item.end
    }
    laneOf.set(item.key, placedLane)
  }

  return laneOf
}

export function PlanningView({ bookings, events }: PlanningViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const weeks = useMemo(
    () =>
      eachWeekOfInterval({ start: calendarStart, end: calendarEnd }, { weekStartsOn: 1 }).map(
        (weekStart) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
          return {
            weekStart,
            weekEnd,
            days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
          }
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarStart.getTime(), calendarEnd.getTime()]
  )

  // Une couleur stable par personne, attribuée par ordre de première apparition
  // (triée par date d'arrivée) afin d'être cohérente d'un mois à l'autre.
  const colorByPerson = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => parseISO(a.check_in).getTime() - parseISO(b.check_in).getTime()
    )
    const map = new Map<string, number>()
    for (const booking of sorted) {
      if (!map.has(booking.user_id)) {
        map.set(booking.user_id, map.size % PERSON_COLORS.length)
      }
    }
    return map
  }, [bookings])

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const start = parseISO(event.start_date)
      const end = parseISO(event.end_date)
      return day >= start && day <= end
    })
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentDate)
              d.setMonth(d.getMonth() - 1)
              setCurrentDate(d)
            }}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-stone-800 capitalize min-w-[160px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentDate)
              d.setMonth(d.getMonth() + 1)
              setCurrentDate(d)
            }}
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Aujourd&apos;hui
        </Button>
      </div>

      {/* Days of week */}
      <div className="min-w-[640px] overflow-x-auto">
        <div className="grid grid-cols-7 border-b border-stone-200 min-w-[640px]">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <div key={day} className="p-2 text-center text-xs font-medium text-stone-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar: one row per week */}
        <div className="min-w-[640px]">
          {weeks.map((week) => {
            const items = bookings
              .filter((booking) => {
                const checkIn = parseISO(booking.check_in)
                const checkOut = parseISO(booking.check_out)
                return checkIn <= week.weekEnd && checkOut >= week.weekStart
              })
              .map((booking) => {
                const checkIn = parseISO(booking.check_in)
                const checkOut = parseISO(booking.check_out)
                const startCol = Math.max(0, differenceInCalendarDays(checkIn, week.weekStart))
                const endCol = Math.min(6, differenceInCalendarDays(checkOut, week.weekStart))
                return { booking, startCol, endCol }
              })

            const laneOf = packLanes(
              items.map((i) => ({ key: i.booking.id, start: i.startCol, end: i.endCol }))
            )

            const bars: WeekBar[] = items.map(({ booking, startCol, endCol }) => {
              const checkIn = parseISO(booking.check_in)
              const checkOut = parseISO(booking.check_out)
              return {
                bookingId: booking.id,
                personId: booking.user_id,
                personName: booking.profiles?.first_name ?? '?',
                colorIndex: colorByPerson.get(booking.user_id) ?? 0,
                startCol,
                endCol,
                isStart: isSameDay(checkIn, week.days[startCol]),
                isEnd: isSameDay(checkOut, week.days[endCol]),
                lane: laneOf.get(booking.id) ?? 0,
              }
            })

            const laneCount = bars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0)

            return (
              <div
                key={week.weekStart.toISOString()}
                className="grid grid-cols-7 border-b border-stone-100 relative"
              >
                {week.days.map((day) => {
                  const dayEvents = getEventsForDay(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'p-1 border-r border-stone-100 last:border-r-0',
                        !isSameMonth(day, currentDate) && 'bg-stone-50'
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                          isToday(day) ? 'bg-primary text-white' : 'text-stone-500',
                          !isSameMonth(day, currentDate) && !isToday(day) && 'text-stone-300'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className="text-[10px] leading-tight px-1 rounded truncate bg-amber-100 text-amber-800"
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Lignes de présence : une barre continue par séjour, empilée par personne */}
                {laneCount > 0 && (
                  <div
                    className="col-span-7 grid grid-cols-7 gap-y-1 px-1 pb-2 pt-0.5"
                    style={{ gridTemplateRows: `repeat(${laneCount}, minmax(0, 1.15rem))` }}
                  >
                    {bars.map((bar) => {
                      const color = PERSON_COLORS[bar.colorIndex]
                      return (
                        <div
                          key={bar.bookingId}
                          title={bar.personName}
                          className={cn(
                            'flex items-center overflow-hidden',
                            color.bar,
                            color.text,
                            bar.isStart ? 'rounded-l-full' : '',
                            bar.isEnd ? 'rounded-r-full' : ''
                          )}
                          style={{
                            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                            gridRow: bar.lane + 1,
                          }}
                        >
                          <span className="text-[10px] font-medium px-1.5 truncate">
                            {bar.personName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-4 border-t border-stone-200">
        <span className="text-xs text-stone-400">Légende :</span>
        <span className="text-xs text-stone-400">
          Une couleur = une personne · survolez une barre pour voir le nom
        </span>
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Événements</Badge>
      </div>
    </div>
  )
}
