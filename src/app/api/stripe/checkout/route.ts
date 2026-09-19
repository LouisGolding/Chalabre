import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

// Crée une session Stripe Checkout pour régler un paiement (taxe de séjour ou
// cotisation mensuelle).
//
// ⚠️ SÉCURITÉ (corrigé le 19/09/2026) : le montant n'est JAMAIS pris du client.
// Avant, la route facturait le `amount` envoyé par le navigateur — n'importe
// qui pouvait payer 1 € une taxe de 100 €. Le montant, le propriétaire et le
// statut sont désormais relus en base à partir de l'id du paiement.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { type, id } = await request.json()

  if ((type !== 'ts' && type !== 'tm') || typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // Le rôle du demandeur : un admin peut régler pour un autre membre.
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = caller?.role === 'admin'

  // Requête statique par table (le client typé refuse un select construit
  // dynamiquement). On lit le montant, le propriétaire, le statut, et le mois
  // pour la cotisation (libellé).
  let payment: { amount: number; user_id: string; status: string; month?: string } | null = null
  if (type === 'ts') {
    const { data } = await supabase
      .from('ts_payments')
      .select('amount, user_id, status')
      .eq('id', id)
      .single()
    payment = data
  } else {
    const { data } = await supabase
      .from('tm_payments')
      .select('amount, user_id, status, month')
      .eq('id', id)
      .single()
    payment = data
  }

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

  // Libellé construit côté serveur (le client ne le décide pas non plus).
  const label =
    type === 'ts'
      ? 'Taxe de séjour — La Bâtisse'
      : `Cotisation mensuelle${payment.month ? ` (${payment.month})` : ''} — La Bâtisse`

  // Derrière le proxy Vercel, l'en-tête Origin du fetch vaut bien l'origine du
  // site (labatisse.art) ; on garde NEXT_PUBLIC_APP_URL en secours.
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
          unit_amount: Math.round(amount * 100), // cents, montant issu de la base
        },
        quantity: 1,
      },
    ],
    metadata: {
      payment_type: type,
      payment_id: id,
      user_id: payment.user_id,
    },
    success_url: `${origin}/dashboard/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/paiement/annule`,
    customer_email: user.email,
    payment_intent_data: {
      metadata: {
        payment_type: type,
        payment_id: id,
        user_id: payment.user_id,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
