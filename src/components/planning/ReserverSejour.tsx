'use client'

import { useState } from 'react'
import { NextStayCard, SavedStayInfo } from '@/components/dashboard/NextStayCard'
import type { TsBalanceResult } from '@/lib/ts-balance'
import type { HouseSide, Profile, TSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  notes?: string | null
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
  onHiddenBookingIdsChange?: (ids: string[]) => void
}

// En-tête de l'onglet Planning : titre "Planning", puis le widget
// "Prochain séjour" lui-même (NextStayCard), qui porte désormais ses
// propres bannières dépliables — une pour le titulaire, une par
// accompagnant, chacune avec sa pastille de solde TS (voir
// NextStayCard.tsx, refonte du 23/09/2026 demandée par Nicolas). Ce
// composant ne fait plus que porter l'état du solde TS et le rafraîchir.
export function ReserverSejour({
  profile,
  booking,
  guestBookings,
  initialTsBalance,
  onBookingSaved,
  onBookingDeleted,
  onHiddenBookingIdsChange,
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

  return (
    <>
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground mt-6">Planning</h1>

      <NextStayCard
        profile={profile}
        booking={booking}
        guestBookings={guestBookings}
        tsBalance={tsBalance}
        onBookingSaved={handleSaved}
        onBookingDeleted={handleDeleted}
        onHiddenBookingIdsChange={onHiddenBookingIdsChange}
      />
    </>
  )
}
