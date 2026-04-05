import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { payment_type, payment_id, user_id } = session.metadata ?? {}

    if (!payment_type || !payment_id) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
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

    // Mettre à jour le paiement
    const updateData = {
      status: 'paid' as const,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: sessionId,
      stripe_amount_received: amountReceived,
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
    }

    if (payment_type === 'ts') {
      await supabase.from('ts_payments').update(updateData).eq('id', payment_id)
    } else if (payment_type === 'tm') {
      await supabase.from('tm_payments').update(updateData).eq('id', payment_id)
    }

    // Logger l'événement dans payment_events
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
    })
  }

  // Gérer les paiements échoués
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    const { payment_type, payment_id, user_id } = pi.metadata ?? {}

    if (payment_type && payment_id) {
      const failureReason = pi.last_payment_error?.message ?? 'Échec du paiement'

      if (payment_type === 'ts') {
        await supabase.from('ts_payments')
          .update({ status: 'overdue', failure_reason: failureReason })
          .eq('id', payment_id)
      } else if (payment_type === 'tm') {
        await supabase.from('tm_payments')
          .update({ status: 'overdue', failure_reason: failureReason })
          .eq('id', payment_id)
      }

      await supabase.from('payment_events').insert({
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        payment_type,
        payment_id,
        user_id: user_id ?? null,
        stripe_payment_intent_id: pi.id,
        status: 'failed',
        raw_payload: event as unknown as Record<string, unknown>,
      })
    }
  }

  return NextResponse.json({ received: true })
}
