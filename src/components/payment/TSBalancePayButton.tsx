'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TSBalancePayButtonProps {
  // Un ou plusieurs ts_payments réglés en une seule session Stripe — tout
  // ce qu'une personne doit, payé d'un coup (demandé par Aurélie le
  // 22/09/2026, voir /api/stripe/checkout/route.ts et
  // src/lib/ts-balance.ts).
  ids: string[]
  children: React.ReactNode
  className?: string
}

// Pastille de solde TS (ReserverSejour.tsx) rendue cliquable : un
// récapitulatif ET un lien de paiement, comme la pastille "Payer X€"
// existante (voir PayButton.tsx) — mais pour la totalité de ce qu'une
// personne doit (potentiellement plusieurs séjours), pas un seul paiement
// à la fois.
export function TSBalancePayButton({ ids, children, className }: TSBalancePayButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    if (loading || ids.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ts', ids }),
      })
      // Avant le 09/10/2026, une erreur ici (réponse HTTP d'erreur, ou
      // même une page d'erreur HTML renvoyée par le serveur au lieu de
      // JSON) finissait uniquement dans console.error, invisible sur
      // mobile -- Nicolas a signalé un clic qui "charge un instant puis
      // n'affiche rien" sur la pastille de solde (accueil et Planning),
      // sans aucun moyen de savoir pourquoi. L'erreur s'affiche
      // désormais via alert() -- rudimentaire mais lisible sur
      // n'importe quel appareil sans outils de développeur.
      let data: { url?: string; error?: string }
      try {
        data = await res.json()
      } catch {
        throw new Error(`Réponse du serveur illisible (code ${res.status}).`)
      }
      if (!res.ok || data.error) throw new Error(data.error ?? `Erreur serveur (code ${res.status}).`)
      if (!data.url) throw new Error('Réponse inattendue du serveur (pas de lien de paiement).')
      window.location.href = data.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error(err)
      alert(`Le paiement n'a pas pu démarrer : ${message}`)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={loading}
      className={cn('transition-opacity hover:opacity-80 disabled:opacity-60', className)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  )
}
