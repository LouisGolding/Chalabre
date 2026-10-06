'use client'

import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

export interface StayRow {
  id: string
  memberName: string
  checkIn: string
  checkOut: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'none'
  paidAt: string | null
  stripeId: string | null
  year: number
}

const STATUS_LABEL: Record<StayRow['status'], { label: string; color: string }> = {
  paid:    { label: 'Payé',          color: 'bg-green-100 text-green-700' },
  pending: { label: 'En attente',    color: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: 'Échoué',        color: 'bg-red-100 text-red-700' },
  // "Aucune TS due" : séjour sans ts_payment associé (montant à 0 ou déjà
  // entièrement couvert sans solde restant au moment de la saisie) --
  // voir le commentaire au-dessus du composant.
  none:    { label: 'Aucune TS due', color: 'bg-stone-100 text-stone-500' },
}

// Historique complet des séjours (onglet "Membres", tout en bas) -- un
// séjour = une ligne, y compris ceux sans taxe de séjour due, demandé par
// Nicolas le 07/10/2026 : "la liste des séjours doit être un historique
// de chaque séjour enregistré". Ce composant reçoit directement les
// séjours (table `bookings`, voir admin/page.tsx) plutôt que les
// paiements (`ts_payments`) comme avant le 07/10/2026 : un séjour sans
// aucun ts_payment (montant nul) apparaît donc désormais lui aussi, et un
// séjour supprimé disparaît de cette liste dès le prochain chargement de
// page puisqu'il ne vit plus dans `bookings`, sans dépendre d'une
// suppression en cascade sur une autre table.
//
// Groupé par année de check-in, bandeau repliable par année (même
// esthétique que les bandeaux Canat/Lalande/Petite maison du Planning --
// chevron tournant comme GuideCard.tsx). L'année la plus récente est
// dépliée par défaut, les précédentes repliées -- demandé le même jour :
// "la ligne 2026 aura une flèche permettant de masquer la liste des
// séjours de l'année précédente" dès qu'une année 2027 apparaît. Clic sur
// le bandeau : déplie/replie cette année.
export function StaysHistory({ rows }: { rows: StayRow[] }) {
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a)
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => new Set(years.slice(1)) // toutes sauf la plus récente, repliées au premier affichage
  )

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Aucun séjour enregistré.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-stone-400 text-left">
            <th className="pb-2 font-medium">Membre</th>
            <th className="pb-2 font-medium">Séjour</th>
            <th className="pb-2 font-medium text-right">Montant</th>
            <th className="pb-2 font-medium">Statut</th>
            <th className="pb-2 font-medium">Payé le</th>
            <th className="pb-2 font-medium text-xs text-stone-300">Stripe ID</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const isCollapsed = collapsedYears.has(year)
            const yearRows = rows.filter((r) => r.year === year)
            return (
              <Fragment key={year}>
                <tr>
                  <td colSpan={6} className="p-0">
                    <button
                      type="button"
                      onClick={() => toggleYear(year)}
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center gap-2 bg-muted/70 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
                      />
                      {year}
                    </button>
                  </td>
                </tr>
                {!isCollapsed &&
                  yearRows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-stone-50">
                      <td className="py-2 font-medium">{p.memberName}</td>
                      <td className="py-2 text-stone-500 text-xs">
                        {formatDate(p.checkIn)} → {formatDate(p.checkOut)}
                      </td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABEL[p.status].color}`}>
                          {STATUS_LABEL[p.status].label}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-stone-400">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                      <td className="py-2 text-xs text-stone-300 font-mono truncate max-w-[120px]">
                        {p.stripeId ?? '—'}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
