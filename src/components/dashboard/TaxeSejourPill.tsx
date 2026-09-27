'use client'

import { useState } from 'react'

interface TaxeSejourPillProps {
  amount: number
}

// Pastille "TOTAL TAXE DE SÉJOUR", refaite le 27/09/2026 à l'identique du
// visuel Photoshop de Nicolas : encadré blanc fin, transparent à
// l'intérieur, texte blanc majuscules — solde "à la manière d'un solde
// bancaire" (voir computeTsBalance dans src/lib/ts-balance.ts), affiché en
// négatif comme un montant dû (ex. "-90€").
//
// Au clic, l'encadré passe en blanc plein et le texte devient "creusé"
// dans la photo de fond : color: transparent + background-clip: text,
// avec la même image que le fond plein écran de la page
// (accueil-bg.jpg), en background-attachment: fixed pour qu'elle
// s'aligne avec la vraie photo derrière plutôt que d'être recadrée à la
// taille du texte. Effet demandé par Nicolas : "l'encadré devient blanc,
// et le texte devient transparent, laissant apparaître la photo en
// fond". Note : background-attachment: fixed est connu pour mal se
// comporter sur Safari iOS (traité comme un scroll normal) — l'alignement
// avec la photo peut donc être légèrement décalé sur iPhone, à vérifier
// avec Nicolas.
export function TaxeSejourPill({ amount }: TaxeSejourPillProps) {
  const [revealed, setRevealed] = useState(false)

  const formatted = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')

  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      className={`inline-flex items-center border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors md:text-sm ${
        revealed ? 'border-white bg-white' : 'border-white bg-transparent'
      }`}
    >
      <span
        className={revealed ? 'bg-clip-text text-transparent' : 'text-white'}
        style={
          revealed
            ? {
                backgroundImage: "url('/images/accueil-bg.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundAttachment: 'fixed',
              }
            : undefined
        }
      >
        Total taxe de séjour : -{formatted}€
      </span>
    </button>
  )
}
