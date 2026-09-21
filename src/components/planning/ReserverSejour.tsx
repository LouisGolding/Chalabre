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

// En-tête de l'onglet Planning : titre "Planning" + bouton "Réserver un
// séjour", sur la même ligne (justify-between) comme avant le 21/09/2026 —
// remonté ici (avec le titre) pour que la ligne garde une hauteur fixe,
// quelle que soit la taille du widget ci-dessous.
//
// Jusqu'au 21/09/2026 le bouton menait à /dashboard/reserver, une page
// séparée avec un vieux formulaire (BookingForm) — retirée. Le widget
// "Prochain séjour + Taxe de séjour", qui vivait sur la page d'accueil, a
// migré ici à la place (demandé par Nicolas) : un clic sur le bouton le
// fait apparaître, pas de navigation, pas de bouton pour le re-masquer
// ensuite (non demandé).
//
// Le 21/09/2026 (2e demande de Nicolas, dans la foulée) : le widget était
// d'abord imbriqué dans la même colonne que le bouton, ce qui — la ligne
// d'en-tête étant en "items-center" — poussait le titre "Planning" vers le
// bas dès que le widget apparaissait (sa hauteur tirait toute la ligne vers
// le bas). Le widget est donc sorti de cette ligne : il s'affiche
// maintenant en dessous, sur toute la largeur, la ligne titre + bouton
// restant fixe.
export function ReserverSejour({ profile, booking, guestBookings }: ReserverSejourProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Planning</h1>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Réserver un séjour
        </button>
      </div>

      {revealed && <NextStayCard profile={profile} booking={booking} guestBookings={guestBookings} />}
    </>
  )
}
