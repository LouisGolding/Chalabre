import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Stripe sends no session cookie, so the anon-key client would be treated as
  // an unauthenticated user and RLS would silently discard every write below.
  const supabase = createAdminClient()

  // Returning 200 on a failed write would tell Stripe the event was handled and
  // it would never retry, so failures have to surface as a 5xx.
  const failures: string[] = []
  const check = (label: string) => ({ error }: { error: { message: string } | null }) => {
    if (error) failures.push(`${label}: ${error.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { payment_type, payment_id, payment_ids, user_id } = session.metadata ?? {}

    if (!payment_type || !payment_id) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Un paiement de taxe de séjour peut désormais regrouper plusieurs
    // ts_payments réglés en une seule session Stripe (demandé par Aurélie
    // le 22/09/2026 : régler d'un coup tout ce qu'une personne doit — voir
    // /api/stripe/checkout/route.ts). payment_ids porte la liste complète
    // (JSON) ; payment_id (unique) reste renseigné pour compatibilité avec
    // les anciens paiements à un seul id.
    let paymentIds: string[] = [payment_id]
    if (payment_ids) {
      try {
        const parsed = JSON.parse(payment_ids)
        if (Array.isArray(parsed) && parsed.length > 0) paymentIds = parsed
      } catch {
        // payment_ids illisible : on retombe sur [payment_id] seul.
      }
    }

    const paymentIntentId = session.payment_intent as string
    const sessionId = session.id
    const amountReceived = session.amount_total // en centimes

    // Récupérer le moyen de paiement
    let paymentMethod: string | null = null
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['payment_method'],
        })
        const pm = pi.payment_method as Stripe.PaymentMethod | null
        paymentMethod = pm?.type ?? null
      } catch {}
    }

    // Mettre à jour le(s) paiement(s)
    const updateData = {
      status: 'paid' as const,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: sessionId,
      stripe_amount_received: amountReceived,
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
    }

    if (payment_type === 'ts') {
      const { data: paidRows } = await supabase.from('ts_payments').select('id, amount').in('id', paymentIds)

      // stripe_amount_received est propre à CHAQUE ts_payment (son propre
      // montant, pas le total du groupe payé en une fois) — sinon un
      // séjour de 20 € réglé avec un autre de 30 € afficherait 50 € reçus
      // sur les deux lignes.
      for (const row of paidRows ?? []) {
        await supabase.from('ts_payments').update({
          ...updateData,
          stripe_amount_received: Math.round(Number(row.amount) * 100),
        }).eq('id', row.id).then(check('ts_payments.update'))

        await supabase.from('payment_events').insert({
          stripe_event_id: `${event.id}:${row.id}`,
          stripe_event_type: event.type,
          payment_type,
          payment_id: row.id,
          user_id: user_id ?? null,
          amount: Number(row.amount),
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
          status: 'success',
          raw_payload: event as unknown as Record<string, unknown>,
        }).then(check('payment_events.insert'))
      }
    } else if (payment_type === 'tm') {
      await supabase.from('tm_payments').update(updateData).eq('id', payment_id)
        .then(check('tm_payments.update'))

      await supabase.from('payment_events').insert({
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        payment_type,
        payment_id,
        user_id: user_id ?? null,
        amount: amountReceived ? amountReceived / 100 : null,
        stripe_session_id: sessionId,
        stripe_payment_intent_id: paymentIntentId,
        status: 'success',
        raw_payload: event as unknown as Record<string, unknown>,
      }).then(check('payment_events.insert'))
    }
  }

  // Gérer les paiements échoués
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    const { payment_type, payment_id, payment_ids, user_id } = pi.metadata ?? {}

    if (payment_type && payment_id) {
      const failureReason = pi.last_payment_error?.message ?? 'Échec du paiement'

      // Même regroupement que checkout.session.completed ci-dessus : un
      // paiement TS groupé qui échoue doit repasser TOUS ses ts_payments
      // en "overdue", pas seulement le premier de la liste.
      let failedIds: string[] = [payment_id]
      if (payment_type === 'ts' && payment_ids) {
        try {
          const parsed = JSON.parse(payment_ids)
          if (Array.isArray(parsed) && parsed.length > 0) failedIds = parsed
        } catch {
          // payment_ids illisible : on retombe sur [payment_id] seul.
        }
      }

      if (payment_type === 'ts') {
        await supabase.from('ts_payments')
          .update({ status: 'overdue', failure_reason: failureReason })
          .in('id', failedIds)
          .then(check('ts_payments.update'))
      } else if (payment_type === 'tm') {
        await supabase.from('tm_payments')
          .update({ status: 'overdue', failure_reason: failureReason })
          .eq('id', payment_id)
          .then(check('tm_payments.update'))
      }

      for (const id of payment_type === 'ts' ? failedIds : [payment_id]) {
        await supabase.from('payment_events').insert({
          stripe_event_id: `${event.id}:${id}`,
          stripe_event_type: event.type,
          payment_type,
          payment_id: id,
          user_id: user_id ?? null,
          stripe_payment_intent_id: pi.id,
          status: 'failed',
          raw_payload: event as unknown as Record<string, unknown>,
        }).then(check('payment_events.insert'))
      }
    }
  }

  if (failures.length > 0) {
    console.error(`[stripe/webhook] ${event.id} ${event.type}: ${failures.join('; ')}`)
    return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
