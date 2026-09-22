import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { buildTsStatementDescriptor, firstNameOnly, normalizeName, tsPeriodFromCheckOut } from '@/lib/utils'

// Crée une session Stripe Checkout pour régler un paiement (taxe de séjour ou
// cotisation mensuelle).
//
// ⚠️ SÉCURITÉ (corrigé le 19/09/2026) : le montant n'est JAMAIS pris du client.
// Avant, la route facturait le `amount` envoyé par le navigateur — n'importe
// qui pouvait payer 1 € une taxe de 100 €. Le montant, le propriétaire et le
// statut sont désormais relus en base à partir de l'id du paiement.
//
// Taxe de séjour (`type: 'ts'`) : accepte désormais plusieurs `ids` à la
// fois (demandé par Aurélie le 22/09/2026) — un seul paiement Stripe pour
// régler d'un coup tout ce qu'une personne doit (pastille "Votre solde TS"
// ou "TS - <prénom>", voir ReserverSejour.tsx et src/lib/ts-balance.ts). Un
// `id` seul (ancien format, toujours utilisé par mes-paiements/page.tsx et
// le bouton "Payer" d'un séjour dans NextStayCard.tsx) reste accepté,
// équivalent à ids: [id].
interface TsRowBooking {
  user_id: string
  guest_name: string | null
  check_out: string
  profiles: { first_name: string } | { first_name: string }[] | null
}

type TsRow = {
  id: string
  amount: number
  status: string
  booking_id: string
  // Supabase renvoie un objet unique pour un embed many-to-one (chaque
  // ts_payment n'a qu'un seul booking) ; le tableau n'est là que par
  // prudence si jamais le client typé se comportait autrement.
  bookings: TsRowBooking | TsRowBooking[] | null
}

function asSingle<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await request.json()
  const type = body.type
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
    : typeof body.id === 'string' && body.id
      ? [body.id]
      : []

  if ((type !== 'ts' && type !== 'tm') || ids.length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { data: caller } = await supabase.from('profiles').select('role, first_name, last_name').eq('id', user.id).single()
  const isAdmin = caller?.role === 'admin'
  const myFullName = caller ? normalizeName(`${caller.first_name} ${caller.last_name}`) : null

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

  // -------------------------------------------------------------
  // Cotisation mensuelle (tm) : inchangé, un seul paiement à la fois.
  // -------------------------------------------------------------
  if (type === 'tm') {
    const { data: payment } = await supabase
      .from('tm_payments')
      .select('amount, user_id, status, month')
      .eq('id', ids[0])
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }
    if (payment.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Ce paiement ne vous appartient pas' }, { status: 403 })
    }
    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'Ce paiement est déjà réglé' }, { status: 400 })
    }

    const amount = Number(payment.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    const label = `Cotisation mensuelle${payment.month ? ` (${payment.month})` : ''} — La Bâtisse`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'eur',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: label, description: 'La Bâtisse — Chalabre' },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { payment_type: type, payment_id: ids[0], user_id: payment.user_id },
      success_url: `${origin}/dashboard/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/paiement/annule`,
      customer_email: user.email,
      payment_intent_data: {
        metadata: { payment_type: type, payment_id: ids[0], user_id: payment.user_id },
      },
    })

    return NextResponse.json({ url: session.url })
  }

  // -------------------------------------------------------------
  // Taxe de séjour (ts) : un ou plusieurs paiements, groupés en une seule
  // session Stripe si plusieurs séjours impayés d'une même personne sont
  // réglés d'un coup.
  // -------------------------------------------------------------
  const { data: rows } = await supabase
    .from('ts_payments')
    .select('id, amount, status, booking_id, bookings(user_id, guest_name, check_out, profiles(first_name))')
    .in('id', ids)

  const payments = (rows ?? []) as TsRow[]

  if (payments.length !== ids.length) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  }
  if (payments.some((p) => p.status === 'paid')) {
    return NextResponse.json({ error: 'Un de ces paiements est déjà réglé' }, { status: 400 })
  }

  // Autorisation : le compte qui a saisi le séjour (booking.user_id), la
  // personne elle-même quand le nom de l'accompagnant correspond à son
  // propre compte (même règle que le reste du site, voir normalizeName),
  // ou un admin — demandé par Aurélie le 22/09/2026 (ex. Emmanuelle règle
  // la taxe d'Oscar qu'elle a saisie, ou Oscar la règle lui-même).
  let resolvedFirstName: string | null = null
  for (const payment of payments) {
    const booking = asSingle(payment.bookings)
    if (!booking) {
      return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 })
    }
    const guestName = booking.guest_name?.trim()
    const isRegistrant = booking.user_id === user.id
    const isBeneficiary = !!guestName && !!myFullName && normalizeName(guestName) === myFullName
    if (!isRegistrant && !isBeneficiary && !isAdmin) {
      return NextResponse.json({ error: 'Ce paiement ne vous appartient pas' }, { status: 403 })
    }
    if (!resolvedFirstName) {
      resolvedFirstName = guestName
        ? firstNameOnly(guestName)
        : asSingle(booking.profiles)?.first_name ?? caller?.first_name ?? 'Famille'
    }
  }

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  const periods = payments.map((p) => tsPeriodFromCheckOut(asSingle(p.bookings)!.check_out))
  const statementDescriptor = buildTsStatementDescriptor(resolvedFirstName ?? 'Famille', periods)

  const lineItems = payments.map((payment) => {
    const booking = asSingle(payment.bookings)!
    const period = tsPeriodFromCheckOut(booking.check_out)
    const monthLabel = new Date(booking.check_out).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return {
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Taxe de séjour — ${resolvedFirstName ?? 'Famille'} (séjour du ${new Date(booking.check_out).toLocaleDateString('fr-FR', { timeZone: 'UTC' })})`,
          description: `La Bâtisse — Chalabre (${monthLabel}, ${period.year}/${period.monthIndex + 1})`,
        },
        unit_amount: Math.round(Number(payment.amount) * 100),
      },
      quantity: 1,
    }
  })

  const primaryUserId = payments.find((p) => asSingle(p.bookings)!.user_id === user.id)
    ? user.id
    : asSingle(payments[0].bookings)!.user_id

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'eur',
    line_items: lineItems,
    metadata: {
      payment_type: 'ts',
      payment_id: ids[0],
      payment_ids: JSON.stringify(ids),
      user_id: primaryUserId,
    },
    success_url: `${origin}/dashboard/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/paiement/annule`,
    customer_email: user.email,
    payment_intent_data: {
      statement_descriptor: statementDescriptor,
      metadata: {
        payment_type: 'ts',
        payment_id: ids[0],
        payment_ids: JSON.stringify(ids),
        user_id: primaryUserId,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
