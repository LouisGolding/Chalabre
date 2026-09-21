'use client'

import { useState } from 'react'
import { PlanningView, PlanningBooking, PlanningEvent } from '@/components/planning/PlanningView'
import { ReserverSejour } from '@/components/planning/ReserverSejour'
import { SavedStayInfo } from '@/components/dashboard/NextStayCard'
import { oklchForHue, colorForName } from '@/lib/colors'
import type { HouseSide, Profile, TSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  ts_payments?: TSPayment[]
}

interface PlanningPageClientProps {
  profile: Profile
  nextBooking: BookingData | null
  guestFutureBookings: BookingData[]
  initialOwnSoldeTS: number
  initialGuestSoldeTS: { name: string; pending: number }[]
  initialPlanningBookings: PlanningBooking[]
  planningEvents: PlanningEvent[]
  currentUserId: string
  isAdmin: boolean
}

// Pont côté client entre le widget "Prochain séjour" (ReserverSejour /
// NextStayCard, qui enregistre en base via /api/bookings/quick) et le
// planning affiché juste en dessous (PlanningView) : les deux partagent ici
// le même état (planningBookings), pour que la ligne colorée d'un séjour
// apparaisse/disparaisse instantanément dans le planning dès qu'il est
// enregistré ou supprimé depuis le widget — sans recharger la page (demandé
// par Aurélie le 21/09/2026). Cet état reste aussi la source de vérité pour
// l'édition directe sur le planning (glisser/modale, voir PlanningView.tsx),
// pour que les deux façons de modifier un séjour restent synchronisées.
export function PlanningPageClient({
  profile,
  nextBooking,
  guestFutureBookings,
  initialOwnSoldeTS,
  initialGuestSoldeTS,
  initialPlanningBookings,
  planningEvents,
  currentUserId,
  isAdmin,
}: PlanningPageClientProps) {
  const [planningBookings, setPlanningBookings] = useState(initialPlanningBookings)

  const handleBookingSaved = (booking: SavedStayInfo) => {
    const isGuest = !!booking.guest_name
    const color =
      booking.colorHue !== null
        ? oklchForHue(booking.colorHue)
        : colorForName(booking.guest_name || profile.first_name)

    const next: PlanningBooking = {
      id: booking.id,
      user_id: currentUserId,
      check_in: booking.check_in,
      check_out: booking.check_out,
      guest_name: booking.guest_name,
      house_side: booking.house_side,
      room_label: null,
      profiles: isGuest
        ? null
        : {
            first_name: profile.first_name,
            last_name: profile.last_name,
            family_group: profile.family_group,
            date_of_birth: profile.date_of_birth,
          },
      color,
    }

    setPlanningBookings((prev) => {
      const exists = prev.some((b) => b.id === booking.id)
      return exists ? prev.map((b) => (b.id === booking.id ? next : b)) : [...prev, next]
    })
  }

  const handleBookingDeleted = (bookingId: string) => {
    setPlanningBookings((prev) => prev.filter((b) => b.id !== bookingId))
  }

  return (
    <>
      <ReserverSejour
        profile={profile}
        booking={nextBooking}
        guestBookings={guestFutureBookings}
        initialOwnSoldeTS={initialOwnSoldeTS}
        initialGuestSoldeTS={initialGuestSoldeTS}
        onBookingSaved={handleBookingSaved}
        onBookingDeleted={handleBookingDeleted}
      />
      <PlanningView
        bookings={planningBookings}
        onBookingsChange={setPlanningBookings}
        events={planningEvents}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </>
  )
}
