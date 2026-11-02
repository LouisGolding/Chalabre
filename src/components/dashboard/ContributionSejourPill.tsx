'use client'

import { CSBalancePayButton } from '@/components/payment/CSBalancePayButton'

interface ContributionSejourPillProps {
  amount: number
  // Identifiants des cs_payments non réglés du titulaire (csBalance.own.items),
  // transmis tels quels à CSBalancePayButton pour régler le tout en une
  // seule session Stripe.
  ids: string[]
}

// Pastille "Payer ici le total de ses contributions séjour" (texte et
// comportement simplifiés le 26/10/2026 à la demande d'Aurélie : "on va
// faire finalement beaucoup plus simple"). Libellé précisé le
// 02/11/2026 (demande de Nicolas, pour la distinguer de la pastille du
// widget "Votre prochain séjour" -- NextStayCard.tsx -- qui ne paye
// plus que CE séjour précis depuis ce jour-là) : "le total de ses
// contributions" marque bien que CELLE-CI couvre le cumul de tout ce qui reste
// dû, tous séjours confondus. L'ancien effet "texte creusé dans
// la photo de fond" au survol est retiré -- remplacé par une animation
// ambiante en boucle (voir .cs-pill-pulse dans globals.css) qui fait
// passer la pastille de "texte blanc sur fond transparent" à "texte
// foncé sur fond blanc cassé" et retour, progressivement (1,5 seconde
// dans chaque sens, réduit de 5s puis 2,5s le 26/10/2026), à l'infini -- pour qu'elle se remarque sans
// attendre un survol.
//
// Reste un vrai lien de paiement (demandé par Nicolas le 27/09/2026,
// sur le modèle de la pastille de solde CS de l'onglet Planning, voir
// CSBalancePayButton.tsx / ReserverSejour.tsx) : un clic ouvre une
// session Stripe Checkout pour régler d'un coup tout ce que le
// titulaire doit.
export function ContributionSejourPill({ amount, ids }: ContributionSejourPillProps) {
  const formatted = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')

  return (
    <CSBalancePayButton
      ids={ids}
      className="cs-pill-pulse inline-flex items-center border border-white px-3 py-1.5 text-xs uppercase tracking-[0.12em] md:text-sm"
    >
      Payer ici le total de ses contributions séjour : {formatted}€
    </CSBalancePayButton>
  )
}
