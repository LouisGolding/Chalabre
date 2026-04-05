'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, isWithinInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PlanningViewProps {
  bookings: any[]
  events: any[]
}

export function PlanningView({ bookings, events }: PlanningViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getBookingsForDay = (day: Date) => {
    return bookings.filter(booking => {
      const checkIn = parseISO(booking.check_in)
      const checkOut = parseISO(booking.check_out)
      return isWithinInterval(day, { start: checkIn, end: checkOut })
    })
  }

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const start = parseISO(event.start_date)
      const end = parseISO(event.end_date)
      return isWithinInterval(day, { start, end })
    })
  }

  const familyColors: Record<string, string> = {
    lalande: 'bg-blue-100 text-blue-800',
    canat: 'bg-green-100 text-green-800',
    friend: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(currentDate)
            d.setMonth(d.getMonth() - 1)
            setCurrentDate(d)
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-stone-800 capitalize min-w-[160px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(currentDate)
            d.setMonth(d.getMonth() + 1)
            setCurrentDate(d)
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Aujourd&apos;hui
        </Button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 border-b border-stone-200">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-stone-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells for start of month */}
        {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-stone-100" />
        ))}

        {days.map(day => {
          const dayBookings = getBookingsForDay(day)
          const dayEvents = getEventsForDay(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[80px] p-1 border-b border-r border-stone-100',
                !isSameMonth(day, currentDate) && 'bg-stone-50',
                isToday(day) && 'bg-amber-50'
              )}
            >
              <span className={cn(
                'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                isToday(day) ? 'bg-primary text-white' : 'text-stone-600'
              )}>
                {format(day, 'd')}
              </span>

              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 3).map(booking => (
                  <div
                    key={booking.id}
                    className={cn(
                      'text-xs px-1 rounded truncate',
                      familyColors[booking.profiles?.family_group ?? 'friend']
                    )}
                  >
                    {booking.profiles?.first_name}
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-xs text-stone-400">+{dayBookings.length - 3}</div>
                )}
                {dayEvents.map(event => (
                  <div key={event.id} className="text-xs px-1 rounded truncate bg-amber-100 text-amber-800">
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-4 border-t border-stone-200">
        <span className="text-xs text-stone-400">Légende :</span>
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Famille Lalande</Badge>
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Famille Canat</Badge>
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Amis</Badge>
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Événements</Badge>
      </div>
    </div>
  )
}
