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
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
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
