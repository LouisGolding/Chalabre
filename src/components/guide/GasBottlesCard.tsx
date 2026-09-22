'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

interface GasBottlesCardProps {
  editable: boolean
  initialCount: number | null
  initialLastRefillDate: string | null
}

// Pastille "Bouteilles de gaz" du Guide de la maison (widget
// "Organisation") : nombre de bouteilles disponibles + date du dernier
// remplacement, modifiable par tout compte famille ou admin (jamais les
// amis) — demandé par Aurélie le 22/09/2026. Même interaction "cliquer
// pour éditer" que la pastille "Cotisation mensuelle" (CotisationPill.tsx)
// et les cellules de l'onglet Contacts.
export function GasBottlesCard({ editable, initialCount, initialLastRefillDate }: GasBottlesCardProps) {
  const [count, setCount] = useState(initialCount)
  const [lastRefillDate, setLastRefillDate] = useState(initialLastRefillDate)
  const [editing, setEditing] = useState(false)
  const [draftCount, setDraftCount] = useState(initialCount != null ? String(initialCount) : '')
  const [draftDate, setDraftDate] = useState(initialLastRefillDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEditing = () => {
    setDraftCount(count != null ? String(count) : '')
    setDraftDate(lastRefillDate ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    const digits = draftCount.replace(/[^\d]/g, '')
    const parsedCount = digits === '' ? 0 : Number(digits)

    setEditing(false)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/gas-bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parsedCount, lastRefillDate: draftDate || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
      setCount(parsedCount)
      setLastRefillDate(draftDate || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bouteilles de gaz</CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Nombre disponible :
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={draftCount}
                onChange={(e) => setDraftCount(e.target.value)}
                className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Dernier remplacement :
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none"
              />
            </label>
            <button
              type="button"
              onClick={save}
              className="h-8 rounded-lg border border-border bg-foreground px-3 text-sm font-medium text-background"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={editable ? startEditing : undefined}
            disabled={!editable}
            className={`text-left text-sm text-muted-foreground ${editable ? 'hover:text-foreground' : ''}`}
          >
            {count != null ? `${count} bouteille${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}` : 'Nombre non renseigné'}
            {' · '}
            {lastRefillDate ? `dernier remplacement le ${formatDate(lastRefillDate)}` : 'date de dernier remplacement non renseignée'}
            {saving && '…'}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
