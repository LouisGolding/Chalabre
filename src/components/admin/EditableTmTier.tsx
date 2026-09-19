'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Check, Loader2 } from 'lucide-react'

interface EditableTmTierProps {
  profileId: string
  initialAmount: number | null
}

// Montant de la cotisation mensuelle (tm_tier), modifiable uniquement ici
// (page admin) : la base refuse qu'un propriétaire change son propre
// montant (voir migration_auth_fix.sql), ce composant ne s'adresse donc
// qu'aux admins. Enregistrement automatique avec un léger débounce, comme
// le widget "Prochain séjour" de la page d'accueil.
export function EditableTmTier({ profileId, initialAmount }: EditableTmTierProps) {
  const [value, setValue] = useState(initialAmount != null ? String(initialAmount) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    // Ne rien envoyer au chargement : seulement quand la personne modifie la valeur.
    if (!mounted.current) {
      mounted.current = true
      return
    }

    const parsed = value.trim() === '' ? null : Number(value)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return

    setSaved(false)
    setError(null)
    let cancelled = false

    const timeout = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch('/api/profiles/tm-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, amount: parsed }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
        if (!cancelled) setSaved(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur')
      } finally {
        if (!cancelled) setSaving(false)
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Non renseignée"
        className="h-8 w-28 text-right"
      />
      <span className="text-xs text-stone-400 w-4">€</span>
      {saving && <Loader2 className="h-3.5 w-3.5 text-stone-400 animate-spin" />}
      {!saving && saved && <Check className="h-3.5 w-3.5 text-green-600" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
