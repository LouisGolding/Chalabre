import { createClient } from '@/lib/supabase/server'
import { normalizeName, tsPeriodFromCheckOut, MONTHS_3, type TsPeriod } from '@/lib/utils'

export interface TsBalanceItem {
  id: string
  amount: number
  checkOut: string
  period: TsPeriod
  label: string // ex. "2026/JUN", pour affichage/debug — voir buildTsStatementDescriptor pour le libellé bancaire complet
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
// pour lequel CE compte a saisi un séjour (ex. Emmanuelle voit un solde
// pour Oscar, Agathe, Zoé).
//
// Un accompagnant saisi par quelqu'un d'autre (guest_name en texte libre)
// mais qui correspond en réalité à un compte existant (même nom complet,
// insensible à la casse — même convention que le reste du site, voir
// normalizeName) voit ce séjour compté dans SON PROPRE "own" ici, en plus
// de chez la personne qui l'a saisi : les deux comptes partagent les mêmes
// lignes ts_payments en base, donc le solde des deux se met à jour
// ensemble dès que l'un règle (au prochain chargement de page — voir
// /api/ts-balance, pas de synchronisation instantanée entre deux comptes
// ouverts en même temps, non demandée).
//
// "pending" désigne ici tout ce qui n'est pas encore réglé (status
// 'pending' OU 'overdue', ex. un paiement Stripe qui a échoué) — même
// convention que la vue admin public.user_balances (status != 'paid'),
// voir migration_payment_tracking.sql.
export async function computeTsBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TsBalanceResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single()

  const myName = profile ? normalizeName(`${profile.first_name} ${profile.last_name}`) : null

  const { data: myBookings } = await supabase
    .from('bookings')
    .select('id, guest_name, check_out, ts_payments(id, amount, status)')
    .eq('user_id', userId)

  const { data: otherBookings } = myName
    ? await supabase
        .from('bookings')
        .select('id, guest_name, user_id, check_out, ts_payments(id, amount, status)')
        .neq('user_id', userId)
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

  for (const booking of (myBookings ?? []) as RawBooking[]) {
    const guestName = booking.guest_name?.trim()
    const payments = booking.ts_payments ?? []
    if (!guestName) {
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out)
      continue
    }
    if (!guestMap.has(guestName)) {
      guestMap.set(guestName, { name: guestName, pending: 0, items: [] })
      guestOrder.push(guestName)
    }
    const bucket = guestMap.get(guestName)!
    for (const payment of payments) bucket.pending += addUnpaid(bucket.items, payment, booking.check_out)
  }

  if (myName) {
    for (const booking of (otherBookings ?? []) as RawBooking[]) {
      const guestName = booking.guest_name?.trim()
      if (!guestName || normalizeName(guestName) !== myName) continue
      const payments = booking.ts_payments ?? []
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out)
    }
  }

  return {
    own: { pending: ownPending, items: ownItems },
    guests: guestOrder.map((name) => guestMap.get(name)!),
  }
}
