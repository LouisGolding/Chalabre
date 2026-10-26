'use client'

import { TSBalancePayButton } from '@/components/payment/TSBalancePayButton'

interface TaxeSejourPillProps {
  amount: number
  // Identifiants des ts_payments non réglés du titulaire (tsBalance.own.items),
  // transmis tels quels à TSBalancePayButton pour régler le tout en une
  // seule session Stripe.
  ids: string[]
}

// Pastille "Payer ici ses taxes de séjour" (texte et comportement
// simplifiés le 26/10/2026 à la demande d'Aurélie : "on va faire
// finalement beaucoup plus simple"). L'ancien effet "texte creusé dans
// la photo de fond" au survol est retiré -- remplacé par une animation
// ambiante en boucle (voir .ts-pill-pulse dans globals.css) qui fait
// passer la pastille de "texte blanc sur fond transparent" à "texte
// foncé sur fond blanc cassé" et retour, progressivement (1,5 seconde
// dans chaque sens, réduit de 5s puis 2,5s le 26/10/2026), à l'infini -- pour qu'elle se remarque sans
// attendre un survol.
//
// Reste un vrai lien de paiement (demandé par Nicolas le 27/09/2026,
// sur le modèle de la pastille de solde TS de l'onglet Planning, voir
// TSBalancePayButton.tsx / ReserverSejour.tsx) : un clic ouvre une
// session Stripe Checkout pour régler d'un coup tout ce que le
// titulaire doit.
export function TaxeSejourPill({ amount, ids }: TaxeSejourPillProps) {
  const formatted = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')

  return (
    <TSBalancePayButton
      ids={ids}
      className="ts-pill-pulse inline-flex items-center border border-white px-3 py-1.5 text-xs uppercase tracking-[0.12em] md:text-sm"
    >
      Payer ici ses taxes de séjour : {formatted}€
    </TSBalancePayButton>
  )
}
