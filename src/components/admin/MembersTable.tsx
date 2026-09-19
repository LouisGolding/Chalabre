'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'

export interface MemberRow {
  id: string
  firstName: string
  lastName: string
  email: string
  familyGroup: 'lalande' | 'canat' | 'friend'
  role: 'admin' | 'family' | 'friend'
  tsDueThisYear: number
  nextStay: string | null
  createdAt: string
}

const statusLabel: Record<MemberRow['familyGroup'], string> = {
  lalande: 'Famille LALANDE',
  canat: 'Famille CANAT',
  friend: 'Invité',
}

type SortKey = 'alpha' | 'stay' | 'due'

const SORT_LABELS: Record<SortKey, string> = {
  alpha: 'Ordre alphabétique',
  stay: 'Date de séjour',
  due: 'Taxe due',
}

// Tableau "Membres" (admin uniquement) : liste de tous les comptes, avec
// leur solde de taxe de séjour sur l'année en cours et un bouton
// "Autorisations" pour donner/retirer l'accès admin — un peu comme la
// case admin d'un groupe WhatsApp. Tri au choix : alphabétique, date de
// séjour (le prochain à venir), ou taxe due (la plus élevée en premier).
export function MembersTable({ rows: initialRows }: { rows: MemberRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [sortKey, setSortKey] = useState<SortKey>('alpha')
  const [pending, setPending] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sortKey === 'alpha') {
      copy.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    } else if (sortKey === 'stay') {
      copy.sort((a, b) => {
        if (!a.nextStay && !b.nextStay) return 0
        if (!a.nextStay) return 1
        if (!b.nextStay) return -1
        return a.nextStay.localeCompare(b.nextStay)
      })
    } else {
      copy.sort((a, b) => b.tsDueThisYear - a.tsDueThisYear)
    }
    return copy
  }, [rows, sortKey])

  const toggleAdmin = async (row: MemberRow) => {
    const makeAdmin = row.role !== 'admin'
    setPending(row.id)
    try {
      const res = await fetch('/api/profiles/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: row.id, makeAdmin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role: data.role } : r)))
    } catch {
      // Silencieux : le bouton revient simplement à son état précédent.
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Trier par :</span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-medium transition-colors ${
              sortKey === key
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Prénom</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2 font-medium">Solde TS (année en cours)</th>
              <th className="px-3 py-2 font-medium">Autorisations</th>
              <th className="px-3 py-2 font-medium">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium text-foreground">{row.lastName}</td>
                <td className="px-3 py-2.5 text-foreground">{row.firstName}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.email}</td>
                <td className="px-3 py-2.5 text-foreground">{statusLabel[row.familyGroup]}</td>
                <td className="px-3 py-2.5 text-foreground">
                  {row.tsDueThisYear > 0 ? formatCurrency(row.tsDueThisYear) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleAdmin(row)}
                    disabled={pending === row.id}
                    className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      row.role === 'admin'
                        ? 'bg-foreground text-background'
                        : 'border border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {row.role === 'admin' ? 'Admin' : 'Membre'}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
