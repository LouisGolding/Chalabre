'use client'

import { useMemo, useState } from 'react'
import { PlanningView, PlanningBooking, PlanningEvent } from '@/components/planning/PlanningView'
import { ReserverSejour } from '@/components/planning/ReserverSejour'
import { SavedStayInfo } from '@/components/dashboard/NextStayCard'
import { colorForName, colorForPaletteIndex } from '@/lib/colors'
import type { FamilyGroup, HouseSide, Profile, TSPayment } from '@/types'
import type { TsBalanceResult } from '@/lib/ts-balance'

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  ts_payments?: TSPayment[]
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

interface PlanningPageClientProps {
  profile: Profile
  myOwnBookings: BookingData[]
  guestFutureBookings: BookingData[]
  initialTsBalance: TsBalanceResult
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
  myOwnBookings,
  guestFutureBookings,
  initialTsBalance,
  initialPlanningBookings,
  planningEvents,
  currentUserId,
  isAdmin,
}: PlanningPageClientProps) {
  const [planningBookings, setPlanningBookings] = useState(initialPlanningBookings)

  // Copie locale de "myOwnBookings"/"guestFutureBookings" (séjours du
  // titulaire lui-même + ceux déjà saisis pour des accompagnants, ex.
  // Otto) : ces props ne servent normalement qu'à initialiser NextStayCard
  // (qui gère ensuite ses propres séjours enregistrés/modifiés depuis le
  // widget lui-même) -- mais depuis le 02/10/2026, un glisser fait
  // directement sur une bande colorée du planning (PlanningView.tsx,
  // persistDates) doit aussi mettre à jour la bannière correspondante dans
  // ce widget, sans qu'on soit passé par lui. Voir
  // handleDatesPersistedFromCalendar ci-dessous.
  const [myOwnBookingsState, setMyOwnBookingsState] = useState(myOwnBookings)
  const [guestFutureBookingsState, setGuestFutureBookingsState] = useState(guestFutureBookings)
  // Lequel des séjours du titulaire (myOwnBookingsState) le widget "Prochain
  // séjour" affiche actuellement -- par défaut le premier (le plus proche,
  // même comportement qu'avant ce changement). Cliquer sur la bande colorée
  // d'un AUTRE de ses propres séjours sur le planning fait basculer cette
  // sélection (voir handleSelectOwnBooking) -- demandé par Aurélie le
  // 26/10/2026.
  const [selectedOwnBookingId, setSelectedOwnBookingId] = useState<string | null>(myOwnBookings[0]?.id ?? null)
  const nextBookingState = useMemo(
    () => myOwnBookingsState.find((b) => b.id === selectedOwnBookingId) ?? myOwnBookingsState[0] ?? null,
    [myOwnBookingsState, selectedOwnBookingId]
  )
  // Incrémenté à chaque glisser persisté sur le planning : signale à
  // ReserverSejour qu'il doit rappeler /api/ts-balance, puisque le montant de
  // taxe de séjour a pu changer sans passer par le widget "Prochain séjour".
  const [calendarSyncSignal, setCalendarSyncSignal] = useState(0)

  // Séjours déjà validés mais en cours de modification dans une bannière du
  // widget "Prochain séjour" (voir NextStayCard.tsx, refonte du
  // 23/09/2026) : masqués du planning tant qu'ils ne sont pas revalidés,
  // sans être retirés de `planningBookings` (source de vérité conservée
  // intacte pour ne rien perdre si le planning lui-même déclenche une mise
  // à jour pendant ce temps — voir handlePlanningBookingsChange).
  const [hiddenBookingIds, setHiddenBookingIds] = useState<string[]>([])
  const visiblePlanningBookings = useMemo(
    () => (hiddenBookingIds.length === 0 ? planningBookings : planningBookings.filter((b) => !hiddenBookingIds.includes(b.id))),
    [planningBookings, hiddenBookingIds]
  )

  // Le planning (glisser/modale, PlanningView.tsx) ne voit que la liste
  // visible : on réintègre les séjours masqués tels quels pour ne jamais
  // les perdre de `planningBookings`. PlanningView appelle ce setter comme
  // un setState React classique (valeur directe OU updater `(prev) =>
  // next`) : on doit donc accepter les deux formes.
  const handlePlanningBookingsChange = (
    updater: PlanningBooking[] | ((prev: PlanningBooking[]) => PlanningBooking[])
  ) => {
    setPlanningBookings((prev) => {
      const hiddenSet = new Set(hiddenBookingIds)
      const prevVisible = prev.filter((b) => !hiddenSet.has(b.id))
      const stillHidden = prev.filter((b) => hiddenSet.has(b.id))
      const updatedVisible = typeof updater === 'function' ? updater(prevVisible) : updater
      return [...updatedVisible, ...stillHidden]
    })
  }

  const handleBookingSaved = (booking: SavedStayInfo) => {
    const isGuest = !!booking.guest_name
    const color =
      booking.colorHue !== null && booking.colorFamily
        ? colorForPaletteIndex(booking.colorFamily, booking.colorHue)
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

  // Glisser fait directement sur une bande colorée du planning (voir
  // PlanningView.tsx, persistDates) : répercute les nouvelles dates sur la
  // bannière correspondante du widget "Prochain séjour" (titulaire ou
  // accompagnant), et déclenche un rafraîchissement du solde TS -- demandé
  // par Nicolas le 02/10/2026 ("si je réduis la bande d'Otto ... son widget
  // doit automatiquement changer, sa taxe de séjour aussi").
  const handleDatesPersistedFromCalendar = (bookingId: string, checkIn: string, checkOut: string) => {
    setMyOwnBookingsState((prev) => prev.map((b) => (b.id === bookingId ? { ...b, check_in: checkIn, check_out: checkOut } : b)))
    setGuestFutureBookingsState((prev) => prev.map((b) => (b.id === bookingId ? { ...b, check_in: checkIn, check_out: checkOut } : b)))
    setCalendarSyncSignal((n) => n + 1)
  }

  // Clic sur la bande colorée d'un AUTRE de ses propres séjours (voir
  // PlanningView.tsx, onSelectOwnBooking) : ignore tout id qui ne
  // correspondrait à aucun séjour connu du titulaire (garde-fou, ne devrait
  // normalement pas arriver).
  const handleSelectOwnBooking = (bookingId: string) => {
    if (myOwnBookingsState.some((b) => b.id === bookingId)) setSelectedOwnBookingId(bookingId)
  }

  return (
    <>
      <ReserverSejour
        profile={profile}
        booking={nextBookingState}
        guestBookings={guestFutureBookingsState}
        initialTsBalance={initialTsBalance}
        onBookingSaved={handleBookingSaved}
        onBookingDeleted={handleBookingDeleted}
        onHiddenBookingIdsChange={setHiddenBookingIds}
        externalTsRefreshSignal={calendarSyncSignal}
      />
      <PlanningView
        bookings={visiblePlanningBookings}
        onBookingsChange={handlePlanningBookingsChange}
        onDatesPersisted={handleDatesPersistedFromCalendar}
        onSelectOwnBooking={handleSelectOwnBooking}
        events={planningEvents}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </>
  )
}
