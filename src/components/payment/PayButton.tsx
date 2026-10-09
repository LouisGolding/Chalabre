'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Loader2 } from 'lucide-react'

interface PayButtonProps {
  type: 'ts' | 'tm'
  paymentId: string
  amount: number
  label: string
  variant?: 'default' | 'outline'
  className?: string
}

export function PayButton({ type, paymentId, amount, label, variant = 'default', className }: PayButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: paymentId, amount, label }),
      })
      // Même correctif que TSBalancePayButton.tsx le 09/10/2026 : une
      // erreur ici restait auparavant invisible (console.error seul),
      // ce qui a donné l'impression d'un bouton qui "ne fait rien" sur
      // mobile. L'erreur s'affiche désormais via alert().
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
    <Button
      onClick={handlePay}
      disabled={loading}
      variant={variant}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <CreditCard className="h-4 w-4 mr-2" />
      )}
      {loading ? 'Redirection...' : `Payer ${amount}€`}
    </Button>
  )
}
