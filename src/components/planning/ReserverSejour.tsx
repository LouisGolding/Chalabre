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

// En-tête de l'onglet Planning : titre "Planning" + bouton "Réserver un
// séjour" sur une première ligne, puis, une fois le widget déplié, "Prochain
// séjour" + la pastille "Solde taxe de séjour" sur une seconde ligne — les
// deux lignes partagent une même grille à 2 colonnes (1fr / auto) pour que
// le bouton et la pastille démarrent exactement à la même abscisse, quelle
// que soit la largeur de chacun (demandé par Aurélie le 21/09/2026).
//
// Jusqu'au 21/09/2026 le bouton menait à /dashboard/reserver, une page
// séparée avec un vieux formulaire (BookingForm) — retirée. Le widget
// "Prochain séjour + Taxe de séjour", qui vivait sur la page d'accueil, a
// migré ici à la place (demandé par Nicolas) : un clic sur le bouton le
// fait apparaître, pas de navigation, pas de bouton pour le re-masquer
// ensuite (non demandé).
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
  const [revealed, setRevealed] = useState(false)
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
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
        <h1 className="col-start-1 row-start-1 text-2xl md:text-3xl font-semibold text-foreground">
          Planning
        </h1>
        <div className="col-start-2 row-start-1 justify-self-start">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Réserver un séjour
          </button>
        </div>

        {revealed && (
          <>
            <h2 className="col-start-1 row-start-2 font-normal text-xl md:text-2xl text-foreground">
              Prochain séjour
            </h2>
            <div className="col-start-2 row-start-2 justify-self-start">
              <span className="inline-flex h-8 w-fit items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm">
                Solde taxe de séjour :
                <span className={`ml-1 ${soldeTS > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {soldeTS > 0 ? `-${formatCurrency(soldeTS)}` : formatCurrency(0)}
                </span>
              </span>
            </div>
          </>
        )}
      </div>

      {revealed && (
        <NextStayCard
          profile={profile}
          booking={booking}
          guestBookings={guestBookings}
          onBookingSaved={handleSaved}
          onBookingDeleted={handleDeleted}
        />
      )}
    </>
  )
}
