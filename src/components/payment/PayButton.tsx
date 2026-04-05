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
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error(err)
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
