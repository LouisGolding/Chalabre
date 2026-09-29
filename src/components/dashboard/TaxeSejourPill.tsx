'use client'

import { TSBalancePayButton } from '@/components/payment/TSBalancePayButton'

interface TaxeSejourPillProps {
  amount: number
  // Identifiants des ts_payments non réglés du titulaire (tsBalance.own.items),
  // transmis tels quels à TSBalancePayButton pour régler le tout en une
  // seule session Stripe.
  ids: string[]
}

// Pastille "TOTAL TAXE DE SÉJOUR", sur le modèle du visuel Photoshop de
// Nicolas : encadré blanc fin, transparent à l'intérieur, texte blanc
// majuscules — solde "à la manière d'un solde bancaire" (voir
// computeTsBalance dans src/lib/ts-balance.ts), affiché en négatif comme
// un montant dû (ex. "-90€").
//
// Rendue cliquable le 27/09/2026 (demandé par Nicolas) : c'est un vrai
// lien de paiement, sur le modèle de la pastille de solde TS de l'onglet
// Planning (voir TSBalancePayButton.tsx / ReserverSejour.tsx) — un clic
// ouvre une session Stripe Checkout pour régler d'un coup tout ce que le
// titulaire doit.
//
// Effet visuel "encadré blanc plein + texte creusé dans la photo de fond"
// déclenché au SURVOL (pas au clic — Nicolas : "cela indiquera facilement
// qu'il s'agit d'un lien"), en CSS pur (group-hover), pas de state JS :
// color: transparent + background-clip: text sur la même image que le
// fond plein écran de la page (accueil-bg-v2.jpg), en
// background-attachment: fixed pour qu'elle s'aligne avec la vraie photo
// derrière plutôt que d'être recadrée à la taille du texte. Note :
// background-attachment: fixed est connu pour mal se comporter sur
// Safari iOS (traité comme un scroll normal) — l'alignement avec la
// photo peut donc être légèrement décalé sur iPhone, à vérifier avec
// Nicolas.
export function TaxeSejourPill({ amount, ids }: TaxeSejourPillProps) {
  const formatted = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')

  return (
    <TSBalancePayButton
      ids={ids}
      className="group inline-flex items-center border border-white px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors hover:bg-white hover:opacity-100 md:text-sm"
    >
      <span
        className="bg-clip-text text-white/60 transition-colors group-hover:text-transparent"
        style={{
          backgroundImage: "url('/images/accueil-bg-v2.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundAttachment: 'fixed',
        }}
      >
        Total taxe de séjour : -{formatted}€
      </span>
    </TSBalancePayButton>
  )
}
