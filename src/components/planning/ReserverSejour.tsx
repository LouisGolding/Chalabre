'use client'

import { useState } from 'react'
import { NextStayCard, SavedStayInfo } from '@/components/dashboard/NextStayCard'
import { formatCurrency, firstNameOnly } from '@/lib/utils'
import type { HouseSide, Profile, TSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  ts_payments?: TSPayment[]
}

interface GuestSolde {
  name: string
  pending: number
}

interface ReserverSejourProps {
  profile: Profile
  booking: BookingData | null
  guestBookings: BookingData[]
  // Soldes de taxe de séjour en attente, calculés côté serveur au
  // chargement de la page (voir planning/page.tsx) : le sien propre, et un
  // par accompagnant pour lequel un séjour a été saisi — rafraîchis
  // ensuite en direct via /api/ts-balance dès qu'un séjour est enregistré
  // ou supprimé.
  initialOwnSoldeTS: number
  initialGuestSoldeTS: GuestSolde[]
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
}

function soldeLabel(pending: number) {
  return pending > 0 ? `-${formatCurrency(pending)}` : formatCurrency(0)
}

// En-tête de l'onglet Planning : titre "Planning", puis "Prochain séjour" +
// la ou les pastilles de solde TS sur leur propre ligne (justify-between),
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
// les séjours et leur taxe de séjour est désormais sur cet onglet. Elle
// mélangeait alors son propre solde avec celui de ses accompagnants
// (ex. Otto) dans un seul total, ce qui ne permettait pas de voir ce qui
// restait dû pour qui — scindée le même jour (2e demande) en "Votre solde
// TS" (soi-même) + une pastille "TS - <prénom>" par accompagnant pour
// lequel un séjour est enregistré, affichée juste en dessous.
export function ReserverSejour({
  profile,
  booking,
  guestBookings,
  initialOwnSoldeTS,
  initialGuestSoldeTS,
  onBookingSaved,
  onBookingDeleted,
}: ReserverSejourProps) {
  const [ownSoldeTS, setOwnSoldeTS] = useState(initialOwnSoldeTS)
  const [guestSoldeTS, setGuestSoldeTS] = useState<GuestSolde[]>(initialGuestSoldeTS)

  // Rappelle les soldes exacts depuis la base plutôt que de les recalculer
  // côté client à partir d'un seul séjour : ils couvrent TOUS les séjours
  // du compte (y compris ceux, passés, déjà réglés ou non), donc un
  // aller-retour serveur reste plus sûr qu'un cumul local.
  const refreshSoldeTS = async () => {
    try {
      const res = await fetch('/api/ts-balance')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.own === 'number') setOwnSoldeTS(data.own)
      if (Array.isArray(data.guests)) setGuestSoldeTS(data.guests)
    } catch {
      // Pas grave : les pastilles gardent leur dernière valeur connue, un
      // rechargement de page les resynchronisera.
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-normal text-xl md:text-2xl text-foreground">Prochain séjour</h2>
        <div className="flex flex-col items-start gap-2">
          <span className="inline-flex h-8 w-fit items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm">
            Votre solde TS :
            <span className={`ml-1 ${ownSoldeTS > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {soldeLabel(ownSoldeTS)}
            </span>
          </span>
          {guestSoldeTS.map((guest) => (
            <span
              key={guest.name}
              className="inline-flex h-8 w-fit items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm"
            >
              TS - {firstNameOnly(guest.name)} :
              <span className={`ml-1 ${guest.pending > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {soldeLabel(guest.pending)}
              </span>
            </span>
          ))}
        </div>
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
