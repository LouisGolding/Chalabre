import { NextResponse } from 'next/server'
import { accountFor, stripeFor, transactionFeeLineItem } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { buildTsStatementDescriptorSuffix, firstNameOnly, tsPeriodFromCheckOut } from '@/lib/utils'
import { findClosestNameMatch } from '@/lib/fuzzy-name'

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
//
// Une session Stripe n'encaisse que sur un seul compte (Lalande ou Canat,
// voir src/lib/stripe.ts) : si un solde TS mélange des séjours des deux
// côtés, on ne règle cette fois que ceux du côté du premier paiement
// demandé. Les autres restent dus et le solde affiché permet de les régler
// ensuite.
interface TsRowBooking {
  user_id: string
  guest_name: string | null
  check_out: string
  house_side: string | null
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

// Une erreur (clé Stripe invalide, compte non activé, paramètre refusé…)
// remonte au navigateur avec son vrai message : une 500 sans détail ne dit
// pas à la famille ce qui bloque.
export async function POST(request: Request) {
  try {
    return await handleCheckout(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[stripe/checkout] ${message}`)
    return NextResponse.json({ error: `Erreur serveur : ${message}` }, { status: 500 })
  }
}

async function handleCheckout(request: Request) {
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
  const myFullName = caller ? `${caller.first_name} ${caller.last_name}` : null

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

  // -------------------------------------------------------------
  // Cotisation mensuelle (tm) : inchangé, un seul paiement à la fois.
  // -------------------------------------------------------------
  if (type === 'tm') {
    const { data: payment } = await supabase
      .from('tm_payments')
      .select('amount, user_id, status, month, profiles(family_group)')
      .eq('id', ids[0])
      .single<{
        amount: number
        user_id: string
        status: string
        month: string | null
        profiles: { family_group: string } | { family_group: string }[] | null
      }>()

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

    const account = accountFor(asSingle(payment.profiles)?.family_group)

    // Frais de transaction (1,5 %, voir transactionFeeLineItem dans
    // src/lib/stripe.ts) : ligne séparée, jamais mélangée au montant
    // officiel de la cotisation ci-dessus.
    const tmBaseAmountCents = Math.round(amount * 100)

    const session = await stripeFor(account).checkout.sessions.create({
      mode: 'payment',
      currency: 'eur',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: label, description: 'La Bâtisse — Chalabre' },
            unit_amount: tmBaseAmountCents,
          },
          quantity: 1,
        },
        transactionFeeLineItem(tmBaseAmountCents),
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
    .select('id, amount, status, booking_id, bookings(user_id, guest_name, check_out, house_side, profiles(first_name))')
    .in('id', ids)

  const requested = (rows ?? []) as TsRow[]

  if (requested.length !== ids.length) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  }
  if (requested.some((p) => p.status === 'paid')) {
    return NextResponse.json({ error: 'Un de ces paiements est déjà réglé' }, { status: 400 })
  }

  const accountOf = (p: TsRow) => accountFor(asSingle(p.bookings)?.house_side)
  const first = requested.find((p) => p.id === ids[0]) ?? requested[0]
  const account = accountOf(first)
  const payments = requested.filter((p) => accountOf(p) === account)
  const paidIds = payments.map((p) => p.id)

  // Autorisation : le compte qui a saisi le séjour (booking.user_id), la
  // personne elle-même quand le nom de l'accompagnant correspond à son
  // propre compte (tolérant aux accents/fautes de frappe depuis le
  // 07/10/2026 — findClosestNameMatch, même mécanisme que ensureGuestColor,
  // harmonisé avec computeTsBalance qui avait la même incohérence),
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
    const isBeneficiary = !!guestName && !!myFullName && findClosestNameMatch(guestName, [myFullName]) !== -1
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
  const statementDescriptorSuffix = buildTsStatementDescriptorSuffix(resolvedFirstName ?? 'Famille', periods)

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

  // Frais de transaction (1,5 %, voir transactionFeeLineItem dans
  // src/lib/stripe.ts) : une seule ligne séparée pour tout le groupe,
  // basée sur la somme exacte des lignes de taxe de séjour ci-dessus
  // (jamais sur un arrondi recalculé depuis totalAmount) -- les
  // montants officiels de ts_payments.amount restent inchangés, en base
  // comme à l'écran.
  const tsBaseAmountCents = lineItems.reduce((sum, li) => sum + li.price_data.unit_amount, 0)

  const session = await stripeFor(account).checkout.sessions.create({
    mode: 'payment',
    currency: 'eur',
    line_items: [...lineItems, transactionFeeLineItem(tsBaseAmountCents)],
    metadata: {
      payment_type: 'ts',
      payment_id: paidIds[0],
      payment_ids: JSON.stringify(paidIds),
      user_id: primaryUserId,
    },
    success_url: `${origin}/dashboard/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/paiement/annule`,
    customer_email: user.email,
    payment_intent_data: {
      statement_descriptor_suffix: statementDescriptorSuffix,
      metadata: {
        payment_type: 'ts',
        payment_id: paidIds[0],
        payment_ids: JSON.stringify(paidIds),
        user_id: primaryUserId,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
