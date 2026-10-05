'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '@/components/layout/PageTitle'
import { NextStayCard, SavedStayInfo } from '@/components/dashboard/NextStayCard'
import type { TsBalanceResult } from '@/lib/ts-balance'
import type { FamilyGroup, HouseSide, Profile, TSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  notes?: string | null
  ts_payments?: TSPayment[]
  // Couleur de cet occupant (voir src/lib/colors.ts -- depuis le
  // 29/09/2026, color_hue est un index de palette, a lire avec
  // color_family), resolue cote serveur (planning/page.tsx) -- sert a
  // colorer le fond de la banniere correspondante dans NextStayCard.tsx
  // (demande le 29/09/2026).
  color_hue?: number | null
  color_family?: FamilyGroup | null
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
  // Change de valeur à chaque glisser persisté directement sur le planning
  // (voir PlanningPageClient.handleDatesPersistedFromCalendar) : rappelle
  // /api/ts-balance, puisque le montant de taxe de séjour a pu changer sans
  // passer par ce widget -- demandé par Nicolas le 02/10/2026.
  externalTsRefreshSignal?: number
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
  externalTsRefreshSignal,
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

  // 0 au montage (aucun rafraîchissement à faire) ; toute valeur positive
  // suivante signale un glisser fait directement sur le planning. Le fetch
  // est fait ici en ligne plutôt que via refreshTsBalance (appel direct
  // d'une fonction qui modifie l'état déclenchée par un effet, à éviter) --
  // même requête, avec un garde-fou pour ignorer une réponse tardive si le
  // composant a changé de signal entre-temps.
  useEffect(() => {
    if (!externalTsRefreshSignal) return
    let active = true
    void (async () => {
      try {
        const res = await fetch('/api/ts-balance')
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.own && Array.isArray(data?.guests)) setTsBalance(data)
      } catch {
        // Pas grave : les pastilles gardent leur dernière valeur connue.
      }
    })()
    return () => {
      active = false
    }
  }, [externalTsRefreshSignal])
  const handleDeleted = (bookingId: string) => {
    onBookingDeleted?.(bookingId)
    void refreshTsBalance()
  }

  return (
    <>
      <PageTitle>Planning</PageTitle>

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
