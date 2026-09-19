'use client'

import { useState } from 'react'

interface CotisationPillProps {
  profileId: string
  initialAmount: number | null
}

// Pastille "Cotisation mensuelle", éditable par le membre lui-même : un clic
// dessus bascule vers un champ de saisie, l'enregistrement se fait à la
// perte du focus ou sur Entrée (Échap annule). Montant toujours un nombre
// rond (pas de virgule/décimales) : on affiche juste "{amount} €", sans
// passer par formatCurrency qui ajoute ",00". Pastille blanche/translucide
// (comme les autres pastilles "blanches" du widget), pour deviner le fond
// derrière — cohérent avec "+ Ajouter un séjour" / "- Supprimer ce séjour".
//
// Important : coté serveur, /api/profiles/tm-tier et le trigger Supabase
// protect_profile_privileges() n'autorisaient jusqu'ici que les admins à
// modifier tm_tier (voir migration_auth_fix.sql). La route a été ouverte
// pour qu'un membre (non-ami) modifie sa PROPRE cotisation, mais le
// verrou côté base ne change qu'avec migration_tm_self_edit.sql, pas
// encore appliquée en production — en attendant, cette pastille fonctionne
// en local (mode dev, réponse simulée) mais l'enregistrement réel échoue
// silencieusement tant que Louis n'a pas validé et appliqué la migration.
export function CotisationPill({ profileId, initialAmount }: CotisationPillProps) {
  const [amount, setAmount] = useState(initialAmount)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialAmount != null ? String(initialAmount) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEditing = () => {
    setDraft(amount != null ? String(amount) : '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    // Tolère "100", "100€", "100 €", "100 euros"... seuls les chiffres comptent.
    const digits = draft.replace(/[^\d]/g, '')
    const parsed = digits === '' ? null : Number(digits)

    setEditing(false)
    if (parsed === amount) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profiles/tm-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, amount: parsed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
      setAmount(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {editing ? (
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Montant"
          className="h-8 w-32 rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground outline-none backdrop-blur-sm placeholder:text-muted-foreground"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="inline-flex h-8 w-fit items-center justify-center rounded-lg border border-border bg-card/40 px-2.5 text-sm font-medium text-foreground backdrop-blur-sm"
        >
          Cotisation mensuelle : {amount != null ? `${amount} €` : 'NR'}
          {saving && '…'}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
