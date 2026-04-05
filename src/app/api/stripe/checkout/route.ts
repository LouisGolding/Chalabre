import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { type, id, amount, label } = await request.json()
  // type: 'ts' | 'tm'
  // id: payment record id
  // amount: in euros
  // label: display label

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'eur',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: label,
            description: 'La Bâtisse — Chalabre',
          },
          unit_amount: Math.round(amount * 100), // cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      payment_type: type,
      payment_id: id,
      user_id: user.id,
    },
    success_url: `${origin}/dashboard/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/paiement/annule`,
    customer_email: user.email,
    payment_intent_data: {
      metadata: {
        payment_type: type,
        payment_id: id,
        user_id: user.id,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
