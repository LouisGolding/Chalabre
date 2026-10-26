import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Un compte Stripe par côté de la maison, pour que l'argent arrive
// directement sur le bon compte bancaire :
// - Lalande : STRIPE_SECRET_KEY_LALANDE / STRIPE_WEBHOOK_SECRET_LALANDE
//   (à défaut, les anciennes STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET) ;
// - Canat : STRIPE_SECRET_KEY_CANAT / STRIPE_WEBHOOK_SECRET_CANAT.
// Sans les variables Canat, tout passe par le compte Lalande.
export type StripeAccount = 'lalande' | 'canat'

const API_VERSION = '2025-02-24.acacia'

const lalande = new Stripe(
  (process.env.STRIPE_SECRET_KEY_LALANDE || process.env.STRIPE_SECRET_KEY)!,
  { apiVersion: API_VERSION }
)
const canat = process.env.STRIPE_SECRET_KEY_CANAT
  ? new Stripe(process.env.STRIPE_SECRET_KEY_CANAT, { apiVersion: API_VERSION })
  : null

// Le compte qui encaisse, selon le côté de la maison : profiles.family_group
// pour une cotisation, bookings.house_side pour une taxe de séjour (même
// règle que BudgetStripeTransaction, src/types/index.ts : "petite_maison"
// et un séjour sans côté vont sur Lalande).
export function accountFor(side: string | null | undefined): StripeAccount {
  return side === 'canat' && canat ? 'canat' : 'lalande'
}

export function stripeFor(account: StripeAccount): Stripe {
  return account === 'canat' && canat ? canat : lalande
}

// Les deux comptes envoient leurs événements à la même URL de webhook, chacun
// signé avec son propre secret : on essaie chaque secret configuré et on
// garde celui qui valide la signature.
export function constructWebhookEvent(
  body: string,
  signature: string
): { event: Stripe.Event; stripe: Stripe } | null {
  const candidates: [string | undefined, Stripe | null][] = [
    [process.env.STRIPE_WEBHOOK_SECRET_LALANDE || process.env.STRIPE_WEBHOOK_SECRET, lalande],
    [process.env.STRIPE_WEBHOOK_SECRET_CANAT, canat],
  ]
  for (const [secret, client] of candidates) {
    if (!secret || !client) continue
    try {
      return { event: client.webhooks.constructEvent(body, signature, secret), stripe: client }
    } catch {
      // Mauvais secret pour cet événement : on essaie le compte suivant.
    }
  }
  return null
}

// Commission Stripe (~1,5 % prélevés par Stripe sur chaque paiement par
// carte, demandé par Aurélie le 26/10/2026) : "lorsque quelqu'un verse
// 10€, le compte ne perçoit que 9,85€". Pour que le compte bancaire
// reçoive bien le montant officiel (taxe de séjour ou cotisation,
// toujours un chiffre rond, jamais modifié dans l'app ni en base), on
// facture systématiquement ce montant + 1,5 % — calculé automatiquement,
// jamais saisi à la main — en tant que ligne séparée sur la session
// Stripe Checkout, explicitement nommée et expliquée : la personne qui
// paie voit toujours "<montant> + 1,5 %" avant de confirmer, jamais un
// montant gonflé caché dans une seule ligne.
export const TRANSACTION_FEE_RATE = 0.015

export function transactionFeeLineItem(baseAmountCents: number) {
  return {
    price_data: {
      currency: 'eur',
      product_data: {
        name: 'Frais de transaction (1,5 %)',
        description:
          "Coût de la transaction bancaire, prélevé par Stripe sur chaque paiement par carte — La Bâtisse",
      },
      unit_amount: Math.round(baseAmountCents * TRANSACTION_FEE_RATE),
    },
    quantity: 1,
  }
}

let stripePromise: ReturnType<typeof loadStripe>
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}
