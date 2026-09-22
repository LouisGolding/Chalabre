'use client'

import { useState } from 'react'
import { NextStayCard, SavedStayInfo } from '@/components/dashboard/NextStayCard'
import { TSBalancePayButton } from '@/components/payment/TSBalancePayButton'
import { formatCurrency, firstNameOnly } from '@/lib/utils'
import type { TsBalanceResult } from '@/lib/ts-balance'
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
  // Solde de taxe de séjour "à la manière d'un solde bancaire" (demandé
  // par Aurélie le 22/09/2026) : calculé côté serveur au chargement de la
  // page (voir planning/page.tsx, src/lib/ts-balance.ts) et rafraîchi
  // ensuite en direct via /api/ts-balance dès qu'un séjour est enregistré,
  // supprimé ou réglé.
  initialTsBalance: TsBalanceResult
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
}

function soldeAmountClass(pending: number) {
  return pending > 0 ? 'text-red-600' : 'text-foreground'
}

function soldeLabel(pending: number) {
  return pending > 0 ? `-${formatCurrency(pending)}` : formatCurrency(0)
}

const pillClass =
  'inline-flex h-8 w-fit items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm'

// En-tête de l'onglet Planning : titre "Planning", puis "Prochain séjour" +
// la ou les pastilles de solde TS sur leur propre ligne (justify-between),
// puis le widget lui-même (NextStayCard) — affiché directement, sans
// pastille "Réserver un séjour" pour le déplier (retirée le 21/09/2026,
// demandé par Aurélie : "elle n'est plus utile", le widget s'affichant
// désormais dès l'arrivée sur l'onglet).
//
// Les pastilles de solde TS sont à la fois un récapitulatif ET un lien de
// paiement (comme la pastille "Payer X€" existante) — demandé par Aurélie
// le 22/09/2026. "Votre solde TS" reste toujours affichée, même à 0 € (à
// la manière d'un solde bancaire) ; une pastille "TS - <prénom>" par
// accompagnant pour lequel ce compte a saisi un séjour, mais UNIQUEMENT
// tant que son solde n'est pas nul — elle disparaît automatiquement dès
// que c'est réglé (par ce compte-ci ou directement par la personne
// elle-même depuis le sien, voir src/lib/ts-balance.ts). Cliquer une
// pastille règle en un seul paiement Stripe tout ce que la personne doit,
// même si ça couvre plusieurs séjours distincts.
export function ReserverSejour({
  profile,
  booking,
  guestBookings,
  initialTsBalance,
  onBookingSaved,
  onBookingDeleted,
}: ReserverSejourProps) {
  const [tsBalance, setTsBalance] = useState<TsBalanceResult>(initialTsBalance)

  // Rappelle le solde exact depuis la base plutôt que de le recalculer côté
  // client à partir d'un seul séjour : il couvre TOUS les séjours du
  // compte (passés et à venir, y compris ceux saisis pour des
  // accompagnants ou par quelqu'un d'autre sous son nom), donc un
  // aller-retour serveur reste plus sûr qu'un cumul local.
  const refreshTsBalance = async () => {
    try {
      const res = await fetch('/api/ts-balance')
      if (!res.ok) return
      const data = await res.json()
      if (data?.own && Array.isArray(data?.guests)) setTsBalance(data)
    } catch {
      // Pas grave : les pastilles gardent leur dernière valeur connue, un
      // rechargement de page les resynchronisera.
    }
  }

  const handleSaved = (saved: SavedStayInfo) => {
    onBookingSaved?.(saved)
    void refreshTsBalance()
  }
  const handleDeleted = (bookingId: string) => {
    onBookingDeleted?.(bookingId)
    void refreshTsBalance()
  }

  const ownIds = tsBalance.own.items.map((i) => i.id)
  const payableGuests = tsBalance.guests.filter((g) => g.items.length > 0)

  return (
    <>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Planning</h1>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-normal text-xl md:text-2xl text-foreground">Prochain séjour</h2>
        <div className="flex flex-col items-start gap-2">
          {ownIds.length > 0 ? (
            <TSBalancePayButton ids={ownIds} className={pillClass}>
              Votre solde TS :
              <span className={`ml-1 ${soldeAmountClass(tsBalance.own.pending)}`}>
                {soldeLabel(tsBalance.own.pending)}
              </span>
            </TSBalancePayButton>
          ) : (
            <span className={pillClass}>
              Votre solde TS :
              <span className="ml-1 text-foreground">{formatCurrency(0)}</span>
            </span>
          )}
          {payableGuests.map((guest) => (
            <TSBalancePayButton key={guest.name} ids={guest.items.map((i) => i.id)} className={pillClass}>
              TS - {firstNameOnly(guest.name)} :
              <span className={`ml-1 ${soldeAmountClass(guest.pending)}`}>{soldeLabel(guest.pending)}</span>
            </TSBalancePayButton>
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
