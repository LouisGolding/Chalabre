import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Un compte Stripe par côté de la maison, pour que l'argent arrive
// directement sur le bon compte bancaire :
// - Lalande : STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET ;
// - Canat : STRIPE_SECRET_KEY_CANAT / STRIPE_WEBHOOK_SECRET_CANAT.
// Sans les variables Canat, tout passe par le compte Lalande.
export type StripeAccount = 'lalande' | 'canat'

const API_VERSION = '2025-02-24.acacia'

const lalande = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: API_VERSION })
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
    [process.env.STRIPE_WEBHOOK_SECRET, lalande],
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

let stripePromise: ReturnType<typeof loadStripe>
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}
