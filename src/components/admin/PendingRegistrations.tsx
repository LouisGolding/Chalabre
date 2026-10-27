'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn, actionPillClass, formatDate, properCase } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Widget "Inscriptions en attente" (27/10/2026, demande d'Aurélie :
// "soit je valide chaque inscription") -- voir
// supabase/migration_registration_approval.sql et
// /api/admin/registrations. Même principe de widget dépliable que les
// autres de cette page (TutorialViewsHistory.tsx), mais ouvert par
// défaut dès qu'il y a au moins une demande (contrairement aux autres,
// qui sont replié par défaut) : c'est une action à traiter, pas un
// historique à consulter.
export interface PendingRegistrationRow {
  id: string
  firstName: string
  lastName: string
  email: string
  familyGroup: 'lalande' | 'canat' | 'friend'
  createdAt: string
}

const FAMILY_GROUP_LABEL: Record<PendingRegistrationRow['familyGroup'], string> = {
  lalande: 'Lalande',
  canat: 'Canat',
  friend: 'Invité',
}

export function PendingRegistrations({ rows: initialRows }: { rows: PendingRegistrationRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [isOpen, setIsOpen] = useState(initialRows.length > 0)
  const [pending, setPending] = useState<string | null>(null)

  const decide = async (row: PendingRegistrationRow, decision: 'approve' | 'reject') => {
    setPending(row.id)
    try {
      const res = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: row.id, decision }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch {
      // Silencieux : la ligne reste affichée, l'admin peut retenter.
    } finally {
      setPending(null)
    }
  }

  return (
    <Card className="py-0">
      <CardHeader>
        <button type="button" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen} className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80">
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">
            Inscriptions en attente ({rows.length})
          </CardTitle>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4">
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucune inscription en attente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {properCase(row.firstName)} {properCase(row.lastName)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {FAMILY_GROUP_LABEL[row.familyGroup]}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.email} · inscrit le {formatDate(row.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={pending === row.id}
                      onClick={() => decide(row, 'approve')}
                      className={actionPillClass}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={pending === row.id}
                      onClick={() => decide(row, 'reject')}
                      className={actionPillClass}
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
