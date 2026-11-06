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
// pour une cotisation, bookings.house_side pour une contribution séjour (même
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
// reçoive bien le montant officiel (contribution séjour ou cotisation,
// toujours un chiffre rond, jamais modifié dans l'app ni en base), on
// facture systématiquement ce montant + 1,5 % — calculé automatiquement,
// jamais saisi à la main — en tant que ligne séparée sur la session
// Stripe Checkout, explicitement nommée et expliquée : la personne qui
// paie voit toujours "<montant> + 1,5 %" avant de confirmer, jamais un
// montant gonflé caché dans une seule ligne.
export const TRANSACTION_FEE_RATE = 0.015

// Correctif du 06/11/2026 (Nicolas : "pourquoi encore une taxe, d'où ça
// vient ?", après avoir remarqué que le paiement de Guy -- 71,05€
// facturés -- n'avait rapporté que 69,73€ net, pas les 70,00€ visés) :
// Stripe prélève en réalité, sur une carte européenne, 1,5 % + 0,25€ FIXE
// par paiement -- pas 1,5 % seul. Vérifié directement sur deux paiements
// réels dans Stripe : 71,05€ facturés -> 1,32€ de frais réels (1,5 % de
// 71,05 + 0,25 = 1,32, pas 1,07) ; 86,28€ facturés -> 1,54€ de frais
// réels (1,5 % de 86,28 + 0,25 = 1,54, pas 1,29). En ne répercutant que
// le pourcentage, l'ancienne formule ci-dessous manquait ces 0,25€ fixes
// à chaque paiement : le compte bancaire recevait donc systématiquement
// 0,25 à 0,30€ de moins que le montant rond visé, malgré l'intention
// d'origine énoncée juste au-dessus. STRIPE_FIXED_FEE_CENTS capture ce
// second morceau, pour que transactionFeeLineItem calcule le montant à
// facturer par résolution directe (plutôt que par simple ajout d'un
// pourcentage) : charge - (charge * TRANSACTION_FEE_RATE +
// STRIPE_FIXED_FEE_CENTS) = baseAmountCents, donc charge = (baseAmountCents
// + STRIPE_FIXED_FEE_CENTS) / (1 - TRANSACTION_FEE_RATE).
const STRIPE_FIXED_FEE_CENTS = 25

export function transactionFeeLineItem(baseAmountCents: number) {
  // Arrondi au centime SUPÉRIEUR (jamais à l'inférieur) : Stripe arrondit
  // lui-même sa part proportionnelle au centime le plus proche, ce qui
  // peut provoquer un écart d'une fraction de centime dans un sens ou
  // l'autre -- en arrondissant ici vers le haut, le compte reçoit au pire
  // un centime de plus que le montant visé, jamais un centime de moins
  // (l'objectif étant justement que le montant reçu soit rond).
  const chargeCents = Math.ceil((baseAmountCents + STRIPE_FIXED_FEE_CENTS) / (1 - TRANSACTION_FEE_RATE))
  const feeCents = chargeCents - baseAmountCents
  return {
    price_data: {
      currency: 'eur',
      product_data: {
        name: 'Frais de transaction',
        description:
          "Frais Stripe (environ 1,5 % + 0,25€) prélevés sur chaque paiement par carte, répercutés ici pour que La Bâtisse reçoive le montant exact — La Bâtisse",
      },
      unit_amount: feeCents,
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
