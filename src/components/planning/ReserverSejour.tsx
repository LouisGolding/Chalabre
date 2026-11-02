'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '@/components/layout/PageTitle'
import { NextStayCard, SavedStayInfo, FamilyMemberOption, DelegatedStay } from '@/components/dashboard/NextStayCard'
import type { CsBalanceResult } from '@/lib/cs-balance'
import type { FamilyGroup, HouseSide, Profile, CSPayment } from '@/types'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  notes?: string | null
  cs_payments?: CSPayment[]
  // Couleur de cet occupant (voir src/lib/colors.ts -- depuis le
  // 29/09/2026, color_hue est un index de palette, a lire avec
  // color_family), resolue cote serveur (planning/page.tsx) -- sert a
  // colorer le fond de la banniere correspondante dans NextStayCard.tsx
  // (demande le 29/09/2026).
  color_hue?: number | null
  color_family?: FamilyGroup | null
  // Tranche d'age memorisee sur le sejour depuis le 26/10/2026 (voir
  // migration_booking_age_bracket.sql et NextStayCard.tsx) -- simple
  // passe-plat ici, cette page ne lit pas le champ elle-meme.
  age_bracket?: 'child' | 'adult' | null
}

interface ReserverSejourProps {
  profile: Profile
  booking: BookingData | null
  guestBookings: BookingData[]
  // Solde de contribution séjour "à la manière d'un solde bancaire" (demandé
  // par Aurélie le 22/09/2026) : calculé côté serveur au chargement de la
  // page (voir planning/page.tsx, src/lib/cs-balance.ts) et rafraîchi
  // ensuite en direct via /api/cs-balance dès qu'un séjour est enregistré,
  // supprimé ou réglé.
  initialCsBalance: CsBalanceResult
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
  onHiddenBookingIdsChange?: (ids: string[]) => void
  // Voir le commentaire sur NextStayCard.tsx (NextStayCardProps.guestDefaults) --
  // simple passe-plat ici.
  guestDefaults?: Record<string, { ageBracket: 'child' | 'adult'; houseSide: HouseSide }>
  // "Option famille" (30/10/2026) -- simple passe-plat ici aussi, voir
  // NextStayCard.tsx (FamilyMemberOption).
  familyMembers?: FamilyMemberOption[]
  // Paiement délégué (01/11/2026, cas unique Alexandre -> Guy) -- simple
  // passe-plat ici aussi, voir NextStayCard.tsx (DelegatedStay).
  delegatedStays?: DelegatedStay[]
  // Change de valeur à chaque glisser persisté directement sur le planning
  // (voir PlanningPageClient.handleDatesPersistedFromCalendar) : rappelle
  // /api/cs-balance, puisque le montant de contribution séjour a pu changer sans
  // passer par ce widget -- demandé par Nicolas le 02/10/2026.
  externalCsRefreshSignal?: number
}

// En-tête de l'onglet Planning : titre "Planning", puis le widget
// "Prochain séjour" lui-même (NextStayCard), qui porte désormais ses
// propres bannières dépliables — une pour le titulaire, une par
// accompagnant, chacune avec sa pastille de solde CS (voir
// NextStayCard.tsx, refonte du 23/09/2026 demandée par Nicolas). Ce
// composant ne fait plus que porter l'état du solde CS et le rafraîchir.
export function ReserverSejour({
  profile,
  booking,
  guestBookings,
  initialCsBalance,
  onBookingSaved,
  onBookingDeleted,
  onHiddenBookingIdsChange,
  externalCsRefreshSignal,
  guestDefaults,
  familyMembers,
  delegatedStays,
}: ReserverSejourProps) {
  const [csBalance, setCsBalance] = useState<CsBalanceResult>(initialCsBalance)

  // Rappelle le solde exact depuis la base plutôt que de le recalculer côté
  // client à partir d'un seul séjour : il couvre TOUS les séjours du
  // compte (passés et à venir, y compris ceux saisis pour des
  // accompagnants ou par quelqu'un d'autre sous son nom), donc un
  // aller-retour serveur reste plus sûr qu'un cumul local.
  const refreshCsBalance = async () => {
    try {
      const res = await fetch('/api/cs-balance')
      if (!res.ok) return
      const data = await res.json()
      if (data?.own && Array.isArray(data?.guests)) setCsBalance(data)
    } catch {
      // Pas grave : les pastilles gardent leur dernière valeur connue, un
      // rechargement de page les resynchronisera.
    }
  }

  const handleSaved = (saved: SavedStayInfo) => {
    onBookingSaved?.(saved)
    void refreshCsBalance()
  }

  // 0 au montage (aucun rafraîchissement à faire) ; toute valeur positive
  // suivante signale un glisser fait directement sur le planning. Le fetch
  // est fait ici en ligne plutôt que via refreshCsBalance (appel direct
  // d'une fonction qui modifie l'état déclenchée par un effet, à éviter) --
  // même requête, avec un garde-fou pour ignorer une réponse tardive si le
  // composant a changé de signal entre-temps.
  useEffect(() => {
    if (!externalCsRefreshSignal) return
    let active = true
    void (async () => {
      try {
        const res = await fetch('/api/cs-balance')
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.own && Array.isArray(data?.guests)) setCsBalance(data)
      } catch {
        // Pas grave : les pastilles gardent leur dernière valeur connue.
      }
    })()
    return () => {
      active = false
    }
  }, [externalCsRefreshSignal])
  const handleDeleted = (bookingId: string) => {
    onBookingDeleted?.(bookingId)
    void refreshCsBalance()
  }

  return (
    <>
      <PageTitle>Planning</PageTitle>

      <NextStayCard
        profile={profile}
        booking={booking}
        guestBookings={guestBookings}
        csBalance={csBalance}
        onBookingSaved={handleSaved}
        onBookingDeleted={handleDeleted}
        onHiddenBookingIdsChange={onHiddenBookingIdsChange}
        guestDefaults={guestDefaults}
        familyMembers={familyMembers}
        delegatedStays={delegatedStays}
      />
    </>
  )
}
