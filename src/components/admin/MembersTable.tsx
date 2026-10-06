'use client'

import { useMemo, useState } from 'react'
import { actionPillClass, formatCurrency, formatDate } from '@/lib/utils'

export interface MemberRow {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'admin' | 'family' | 'friend'
  createdAt: string
  // Totaux TS de l'année en cours (voir admin/page.tsx) -- fusionnés
  // dans ce tableau depuis l'ancien tableau "Soldes par membre" de
  // l'onglet "Suivi paiements", demandé par Nicolas le 07/10/2026.
  // tsTotalYear = toutes les taxes de séjour de l'année en cours
  // (payées ou non), tsPaidYear = celles déjà payées. "Reste dû" est
  // recalculé à l'affichage (tsTotalYear - tsPaidYear), pas stocké.
  tsTotalYear: number
  tsPaidYear: number
}

// Libellé affiché sur la pastille "Autorisations" — un compte 'family' et
// un compte 'friend' s'affichent tous deux "Membre" (seule la distinction
// admin/non-admin est actionnable ici, voir toggleAdmin) : même
// simplification que dans la version précédente de ce tableau. Exposé en
// dehors du composant pour être réutilisé aussi bien à l'affichage qu'au
// tri par colonne "Autorisations" (voir sortValue ci-dessous).
//
// Pastille elle-même : traitée esthétiquement comme les autres pastilles
// d'action du site (actionPillClass, voir utils.ts — "+ Ajouter",
// "Publier", etc.) depuis le 06/10/2026, à la demande de Nicolas —
// remplace l'ancien style ad hoc (rounded-lg, fond plein pour "Admin").
// Le libellé ("Admin"/"Membre") suffit à indiquer l'état actuel, plus
// besoin d'un fond plein distinct pour ça.
function roleLabel(role: MemberRow['role']): string {
  return role === 'admin' ? 'Admin' : 'Membre'
}

// Reste dû de l'année en cours -- jamais stocké, toujours recalculé à
// l'affichage à partir de tsTotalYear/tsPaidYear (même logique que les
// tâches récurrentes de l'onglet Entretien, point 18 de
// points-a-regler-avec-louis.md : recalcul au chargement, pas de valeur
// figée en base).
function remainingOf(row: MemberRow): number {
  return row.tsTotalYear - row.tsPaidYear
}

type SortKey = 'lastName' | 'firstName' | 'role' | 'tsTotalYear' | 'tsPaidYear' | 'remaining' | 'email' | 'createdAt'
type SortDir = 'asc' | 'desc'

// Colonnes numériques (alignées à droite, triées par valeur et non par
// texte) -- voir sortValue et le rendu des <td> plus bas.
const NUMERIC_KEYS: SortKey[] = ['tsTotalYear', 'tsPaidYear', 'remaining']

function sortValue(row: MemberRow, key: SortKey): string | number {
  switch (key) {
    case 'lastName':
      return row.lastName
    case 'firstName':
      return row.firstName
    case 'role':
      return roleLabel(row.role)
    case 'tsTotalYear':
      return row.tsTotalYear
    case 'tsPaidYear':
      return row.tsPaidYear
    case 'remaining':
      return remainingOf(row)
    case 'email':
      return row.email
    case 'createdAt':
      return row.createdAt
  }
}

// Tableau "Membres" (admin uniquement) — un par catégorie (CANAT / LALANDE
// / INVITÉS, voir admin/page.tsx qui instancie ce composant trois fois),
// avec un bouton "Autorisations" pour donner/retirer l'accès admin — un
// peu comme la case admin d'un groupe WhatsApp.
//
// Refonte du 29/09/2026, demandée par Nicolas : plus de rangée de
// pastilles "Trier par :" au-dessus du tableau — le tri se fait
// maintenant en cliquant directement sur l'en-tête d'une colonne, un
// second clic sur la même colonne inverse l'ordre (même mécanique qu'un
// tableur). Tri par défaut : Nom, ordre alphabétique.
//
// Fusion du 07/10/2026, demandée par Nicolas : ce tableau absorbe
// l'ancien tableau "Soldes par membre" de l'onglet "Suivi paiements"
// (voir admin/paiements/page.tsx). Nouvel ordre des colonnes : Nom (en
// MAJUSCULES désormais), Prénom (inchangé, minuscules), Autorisations,
// Total TS <année en cours>, Payé, Reste dû, Email, Créé le.
export function MembersTable({ rows: initialRows }: { rows: MemberRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [pending, setPending] = useState<string | null>(null)

  // "Total TS <année>" -- 2 derniers chiffres de l'année en cours,
  // recalculés à chaque affichage (jamais figés en base) : le libellé
  // passera donc automatiquement de "Total TS 26" à "Total TS 27" le
  // 1er janvier 2027, comme demandé par Nicolas.
  const yearSuffix = String(new Date().getFullYear()).slice(-2)

  const columns: { key: SortKey; label: string }[] = [
    { key: 'lastName', label: 'Nom' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'role', label: 'Autorisations' },
    { key: 'tsTotalYear', label: `Total TS ${yearSuffix}` },
    { key: 'tsPaidYear', label: 'Payé' },
    { key: 'remaining', label: 'Reste dû' },
    { key: 'email', label: 'Email' },
    { key: 'createdAt', label: 'Créé le' },
  ]

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      const primary = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      if (primary !== 0) return dir * primary
      // Égalité (ex. deux "Membre", ou même nom de famille) : on retombe
      // toujours sur Nom puis Prénom pour un ordre stable et prévisible.
      return (
        dir * (a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      )
    })
    return copy
  }, [rows, sortKey, sortDir])

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
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-sm md:text-base uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-normal ${NUMERIC_KEYS.includes(col.key) ? 'text-right' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${NUMERIC_KEYS.includes(col.key) ? 'flex-row-reverse' : ''}`}
                >
                  {col.label}
                  {sortKey === col.key && <span aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const remaining = remainingOf(row)
            return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium uppercase text-foreground">{row.lastName}</td>
                <td className="px-3 py-2.5 text-foreground">{row.firstName}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleAdmin(row)}
                    disabled={pending === row.id}
                    className={actionPillClass}
                  >
                    {roleLabel(row.role)}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(row.tsTotalYear)}</td>
                <td className="px-3 py-2.5 text-right text-green-600">{formatCurrency(row.tsPaidYear)}</td>
                <td className={`px-3 py-2.5 text-right font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(remaining)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.email}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.createdAt)}</td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-muted-foreground">
                Aucun membre pour l&apos;instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
