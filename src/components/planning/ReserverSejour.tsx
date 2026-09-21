'use client'

import { useState } from 'react'
import { NextStayCard } from '@/components/dashboard/NextStayCard'
import type { HouseSide, Profile, TSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  ts_payments?: TSPayment[]
}

interface ReserverSejourProps {
  profile: Profile
  booking: BookingData | null
  guestBookings: BookingData[]
}

// Bouton "Réserver un séjour" de l'onglet Planning. Jusqu'au 21/09/2026 il
// menait à /dashboard/reserver, une page séparée avec un vieux formulaire
// (BookingForm) — retirée. Le widget "Prochain séjour + Taxe de séjour",
// qui vivait sur la page d'accueil, a migré ici à la place (demandé par
// Nicolas) : un clic sur ce bouton le fait simplement apparaître juste en
// dessous, sur la même page — pas de navigation, pas de bouton pour le
// re-masquer ensuite (non demandé).
export function ReserverSejour({ profile, booking, guestBookings }: ReserverSejourProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
      >
        Réserver un séjour
      </button>

      {revealed && (
        <div className="mt-6">
          <NextStayCard profile={profile} booking={booking} guestBookings={guestBookings} />
        </div>
      )}
    </div>
  )
}
