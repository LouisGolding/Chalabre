'use client'

import { useState } from 'react'
import { NextStayCard, SavedStayInfo } from '@/components/dashboard/NextStayCard'
import { formatCurrency } from '@/lib/utils'
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
  // Solde de taxe de séjour en attente, calculé côté serveur au chargement
  // de la page (voir planning/page.tsx) ; rafraîchi ensuite en direct via
  // /api/ts-balance dès qu'un séjour est enregistré ou supprimé.
  initialSoldeTS: number
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
}

// En-tête de l'onglet Planning : titre "Planning", puis "Prochain séjour" +
// la pastille "Solde taxe de séjour" sur leur propre ligne (justify-between),
// puis le widget lui-même (NextStayCard) — affiché directement, sans
// pastille "Réserver un séjour" pour le déplier (retirée le 21/09/2026,
// demandé par Aurélie : "elle n'est plus utile", le widget s'affichant
// désormais dès l'arrivée sur l'onglet).
//
// Jusqu'au 21/09/2026 un bouton "Réserver un séjour" menait à
// /dashboard/reserver, une page séparée avec un vieux formulaire
// (BookingForm) — retirée. Le widget "Prochain séjour + Taxe de séjour",
// qui vivait sur la page d'accueil, a migré ici à la place le même jour ;
// il était d'abord caché derrière ce bouton (2e demande de Nicolas), avant
// que le bouton lui-même ne soit retiré (3e demande, celle d'Aurélie
// ci-dessus).
//
// La pastille "Solde taxe de séjour" vivait jusqu'ici sur la page
// d'accueil, à côté de "Cotisation mensuelle" (18/09/2026) — déplacée ici
// le 21/09/2026, à côté de "Prochain séjour" puisque tout ce qui concerne
// les séjours et leur taxe de séjour est désormais sur cet onglet.
export function ReserverSejour({
  profile,
  booking,
  guestBookings,
  initialSoldeTS,
  onBookingSaved,
  onBookingDeleted,
}: ReserverSejourProps) {
  const [soldeTS, setSoldeTS] = useState(initialSoldeTS)

  // Rappelle le solde exact depuis la base plutôt que de le recalculer côté
  // client à partir d'un seul séjour : le solde affiché couvre TOUS les
  // séjours du compte (y compris ceux saisis pour des accompagnants), donc
  // un aller-retour serveur reste plus sûr qu'un cumul local.
  const refreshSoldeTS = async () => {
    try {
      const res = await fetch('/api/ts-balance')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.pending === 'number') setSoldeTS(data.pending)
    } catch {
      // Pas grave : la pastille garde sa dernière valeur connue, un
      // rechargement de page la resynchronisera.
    }
  }

  const handleSaved = (saved: SavedStayInfo) => {
    onBookingSaved?.(saved)
    void refreshSoldeTS()
  }
  const handleDeleted = (bookingId: string) => {
    onBookingDeleted?.(bookingId)
    void refreshSoldeTS()
  }

  return (
    <>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Planning</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-normal text-xl md:text-2xl text-foreground">Prochain séjour</h2>
        <span className="inline-flex h-8 w-fit items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm">
          Solde taxe de séjour :
          <span className={`ml-1 ${soldeTS > 0 ? 'text-red-600' : 'text-foreground'}`}>
            {soldeTS > 0 ? `-${formatCurrency(soldeTS)}` : formatCurrency(0)}
          </span>
        </span>
      </div>

      <NextStayCard
        profile={profile}
        booking={booking}
        guestBookings={guestBookings}
        onBookingSaved={handleSaved}
        onBookingDeleted={handleDeleted}
      />
    </>
  )
}
