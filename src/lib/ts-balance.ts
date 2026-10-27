import { createClient } from '@/lib/supabase/server'
import { tsPeriodFromCheckOut, MONTHS_3, type TsPeriod } from '@/lib/utils'
import { findClosestNameMatch } from '@/lib/fuzzy-name'
import { otherNuclearFamilyMemberIds } from '@/lib/nuclear-family'

export interface TsBalanceItem {
  id: string
  amount: number
  checkOut: string
  period: TsPeriod
  label: string // ex. "2026/JUN", pour affichage/debug — voir buildTsStatementDescriptorSuffix pour le libellé bancaire
}

export interface TsBalanceBucket {
  pending: number
  items: TsBalanceItem[]
}

export interface TsGuestBalance extends TsBalanceBucket {
  name: string
}

export interface TsBalanceResult {
  own: TsBalanceBucket
  guests: TsGuestBalance[]
}

type RawTsPayment = { id: string; amount: number; status: string }
type RawBooking = { id: string; guest_name: string | null; check_out: string; ts_payments: RawTsPayment[] | null }

// Solde de taxe de séjour "à la manière d'un solde bancaire" (demandé par
// Aurélie le 22/09/2026) : additionne TOUTES les taxes de séjour dues d'une
// personne (tous ses séjours, passés ou à venir) et retire celles déjà
// réglées — jamais remis à zéro d'un séjour à l'autre. "own" est le solde
// du titulaire du compte connecté ; "guests" un solde par accompagnant
// pour lequel CE compte, OU un membre de sa famille nucléaire (voir plus
// bas), a saisi un séjour (ex. Emmanuelle voit un solde pour Oscar,
// Agathe, Zoé).
//
// Un accompagnant saisi par quelqu'un d'autre (guest_name en texte libre)
// mais qui correspond en réalité à un compte existant (même nom complet,
// tolérant aux accents/fautes de frappe — harmonisé le 07/10/2026 sur la
// même logique que ensureGuestColor, voir findClosestNameMatch/fuzzy-name.ts ;
// avant cette date, la correspondance ici était stricte alors qu'elle était
// déjà tolérante côté couleurs/famille, une incohérence signalée à Louis)
// voit ce séjour compté dans SON PROPRE "own" ici, en plus
// de chez la personne qui l'a saisi : les deux comptes partagent les mêmes
// lignes ts_payments en base, donc le solde des deux se met à jour
// ensemble dès que l'un règle (au prochain chargement de page — voir
// /api/ts-balance, pas de synchronisation instantanée entre deux comptes
// ouverts en même temps, non demandée).
//
// Familles nucléaires (27/10/2026, demande d'Aurélie : "si un des deux
// parents rentre le sejour de son enfant, ce sejour apparait aussi sur le
// profil de l'autre parent [...] de sorte à ce que l'un des deux parents
// puisse payer") : un séjour D'ACCOMPAGNANT (enfant...) saisi par un
// AUTRE compte qui partage la même colonne profiles.nuclear_family (voir
// src/lib/colors.ts et src/lib/nuclear-family.ts — ex. Nicolas et Aurélie
// partagent 'lal-nicolas-aurelie') est traité ici exactement comme si le
// titulaire du compte l'avait saisi lui-même : même bucket "guests", même
// somme, payable depuis les deux comptes (voir l'autorisation
// correspondante dans /api/stripe/checkout/route.ts). Volontairement
// exclu de ce partage : le séjour PROPRE d'un autre membre de la famille
// nucléaire (sans accompagnant) ne devient pas payable par les autres
// pour autant — seuls les séjours d'accompagnants sont partagés. Et tout
// séjour d'accompagnant dont le nom correspond en réalité au titulaire
// lui-même reste compté dans "own" (via la correspondance de nom
// ci-dessus), jamais dans "guests" en plus — pas de double comptage.
//
// "pending" désigne ici tout ce qui n'est pas encore réglé (status
// 'pending' OU 'overdue', ex. un paiement Stripe qui a échoué) — même
// convention que la vue admin public.user_balances (status != 'paid'),
// voir migration_payment_tracking.sql.
export async function computeTsBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  // Évite un aller-retour Supabase supplémentaire quand l'appelant a déjà
  // ce champ sous la main (ex. dashboard/page.tsx, planning/page.tsx — le
  // profil du titulaire est déjà chargé par getCurrentUserAndProfile()).
  // undefined (valeur par défaut) : on va la chercher nous-mêmes.
  knownNuclearFamily?: string | null
): Promise<TsBalanceResult> {
  // Latence (26/10/2026, demande d'Aurélie : "il y a toujours un temps
  // de latence [...] a revérifier pour que tout soit tres tres
  // rapide") : `profile` et `myBookings` ne dépendent pas l'un de
  // l'autre (myBookings n'a besoin que de userId, déjà connu) -- lancés
  // de front ici. `otherBookings` et la famille nucléaire restent de
  // vraies dépendances séquentielles (besoin de myFullName/profile) --
  // mais lancées de front ENTRE ELLES juste en dessous.
  const [{ data: profile }, { data: myBookings }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, nuclear_family').eq('id', userId).single(),
    supabase
      .from('bookings')
      .select('id, guest_name, check_out, ts_payments(id, amount, status)')
      .eq('user_id', userId),
  ])

  const myFullName = profile ? `${profile.first_name} ${profile.last_name}` : null
  const nuclearFamily = knownNuclearFamily !== undefined ? knownNuclearFamily : profile?.nuclear_family ?? null

  const [{ data: otherBookings }, familyMemberIds] = await Promise.all([
    myFullName
      ? supabase
          .from('bookings')
          .select('id, guest_name, user_id, check_out, ts_payments(id, amount, status)')
          .neq('user_id', userId)
          .not('guest_name', 'is', null)
      : Promise.resolve({ data: [] as RawBooking[] }),
    otherNuclearFamilyMemberIds(supabase, userId, nuclearFamily),
  ])

  const { data: familyGuestBookings } =
    familyMemberIds.length > 0
      ? await supabase
          .from('bookings')
          .select('id, guest_name, check_out, ts_payments(id, amount, status)')
          .in('user_id', familyMemberIds)
          .not('guest_name', 'is', null)
      : { data: [] as RawBooking[] }

  const ownItems: TsBalanceItem[] = []
  let ownPending = 0
  const guestOrder: string[] = []
  const guestMap = new Map<string, TsGuestBalance>()

  // Ajoute un ts_payment non réglé à une liste d'items, et renvoie son
  // montant (0 si déjà payé, pour ne rien ajouter au solde).
  const addUnpaid = (items: TsBalanceItem[], payment: RawTsPayment, checkOut: string): number => {
    if (payment.status === 'paid') return 0
    const period = tsPeriodFromCheckOut(checkOut)
    const amount = Number(payment.amount)
    items.push({
      id: payment.id,
      amount,
      checkOut,
      period,
      label: `${period.year}/${MONTHS_3[period.monthIndex]}`,
    })
    return amount
  }

  const addToGuestBucket = (guestName: string, payments: RawTsPayment[], checkOut: string) => {
    if (!guestMap.has(guestName)) {
      guestMap.set(guestName, { name: guestName, pending: 0, items: [] })
      guestOrder.push(guestName)
    }
    const bucket = guestMap.get(guestName)!
    for (const payment of payments) bucket.pending += addUnpaid(bucket.items, payment, checkOut)
  }

  for (const booking of (myBookings ?? []) as RawBooking[]) {
    const guestName = booking.guest_name?.trim()
    const payments = booking.ts_payments ?? []
    if (!guestName) {
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out)
      continue
    }
    addToGuestBucket(guestName, payments, booking.check_out)
  }

  // Séjours d'accompagnants saisis par un autre membre de la même
  // famille nucléaire (voir le grand commentaire au-dessus de la
  // fonction) : même bucket "guests" que ci-dessus, à l'exclusion de ceux
  // qui correspondent en réalité au titulaire du compte lui-même (comptés
  // dans "own" par la boucle suivante à la place, jamais les deux).
  for (const booking of (familyGuestBookings ?? []) as RawBooking[]) {
    const guestName = booking.guest_name?.trim()
    if (!guestName) continue
    if (myFullName && findClosestNameMatch(guestName, [myFullName]) !== -1) continue
    addToGuestBucket(guestName, booking.ts_payments ?? [], booking.check_out)
  }

  if (myFullName) {
    for (const booking of (otherBookings ?? []) as RawBooking[]) {
      const guestName = booking.guest_name?.trim()
      if (!guestName || findClosestNameMatch(guestName, [myFullName]) === -1) continue
      const payments = booking.ts_payments ?? []
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out)
    }
  }

  return {
    own: { pending: ownPending, items: ownItems },
    guests: guestOrder.map((name) => guestMap.get(name)!),
  }
}
