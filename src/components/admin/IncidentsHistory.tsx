'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface IncidentRow {
  category: string
  zoneLabel: string
}

// Libellés affichés -- mêmes intitulés que les catégories "diagnostic" du
// Guide de la maison (voir emergency-guide.ts : eau -> "Fuite d'eau",
// eau-chaude -> "Plus d'eau chaude", electrique -> "Panne électrique").
// Une catégorie inconnue (future, ou "extincteurs" qui n'enregistre
// aujourd'hui aucun incident) retombe simplement sur son identifiant brut.
const INCIDENT_CATEGORY_LABEL: Record<string, string> = {
  electrique: 'Panne électrique',
  eau: "Fuite d'eau",
  'eau-chaude': "Plus d'eau chaude",
}

// Couleur fixe par catégorie (identité, jamais générée à la volée) --
// voir globals.css (--incident-electrique/eau/eau-chaude), même
// convention que --banner-border/--icon-muted.
const INCIDENT_CATEGORY_COLOR: Record<string, string> = {
  electrique: 'var(--incident-electrique)',
  eau: 'var(--incident-eau)',
  'eau-chaude': 'var(--incident-eau-chaude)',
}
const FALLBACK_COLOR = 'var(--muted-foreground)'

function Bar({ label, count, maxCount, color, onClick }: { label: string; count: number; maxCount: number; color: string; onClick?: () => void }) {
  const widthPct = `${Math.max(4, (count / maxCount) * 100).toFixed(1)}%`
  const content = (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-sm">
        <span className="min-w-0 text-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full transition-[width]" style={{ background: color, width: widthPct }} />
      </div>
    </div>
  )
  if (!onClick) return content
  return (
    <button type="button" onClick={onClick} className="flex flex-col gap-1 text-left hover:opacity-80">
      {content}
    </button>
  )
}

// Widget "Historique des pannes" (26/10/2026, demande d'Aurélie) --
// onglet "Gestion" (ex-"Membres"). Affiche le contenu de la table
// `incident_reports` (signalements "Panne électrique"/"Plus d'eau
// chaude" depuis le Guide de la maison -> Urgences, voir
// EmergencyGuide.tsx) sous forme de barres, d'abord regroupées par
// catégorie, puis -- au clic sur une catégorie -- par zone à l'intérieur
// de cette catégorie (confirmé par Aurélie : "d'abord catégorie, puis
// par zone"). Même convention visuelle que le détail "Barres" de
// l'onglet Budget (BudgetBoard.tsx : libellé + valeur au-dessus d'une
// piste `bg-foreground/10` remplie en proportion). Repliée par défaut,
// même gabarit que les autres widgets dépliables de cette page
// (StaysHistory.tsx).
//
// Le signalement était désactivé depuis le 06/10/2026 (TRACK_INCIDENTS =
// false dans EmergencyGuide.tsx) faute d'écran admin pour le consulter
// -- réactivé le même jour que ce widget (26/10/2026), donc les 5
// pannes de septembre déjà en base avant la désactivation ne sont plus,
// désormais, les seules qui s'y ajouteront.
export function IncidentsHistory({ rows }: { rows: IncidentRow[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])
  const maxCategoryCount = categoryCounts[0]?.count ?? 1

  const zoneCounts = useMemo(() => {
    if (!selectedCategory) return []
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (r.category !== selectedCategory) continue
      counts.set(r.zoneLabel, (counts.get(r.zoneLabel) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([zoneLabel, count]) => ({ zoneLabel, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows, selectedCategory])
  const maxZoneCount = zoneCounts[0]?.count ?? 1

  return (
    <Card className="py-0">
      <CardHeader>
        <button
          type="button"
          onClick={() => {
            setIsOpen((v) => !v)
            setSelectedCategory(null)
          }}
          aria-expanded={isOpen}
          className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
        >
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">
            Historique des pannes ({rows.length})
          </CardTitle>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4">
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucune panne signalée pour le moment.</p>
          ) : selectedCategory === null ? (
            <div className="flex flex-col gap-2.5">
              {categoryCounts.map(({ category, count }) => (
                <Bar
                  key={category}
                  label={INCIDENT_CATEGORY_LABEL[category] ?? category}
                  count={count}
                  maxCount={maxCategoryCount}
                  color={INCIDENT_CATEGORY_COLOR[category] ?? FALLBACK_COLOR}
                  onClick={() => setSelectedCategory(category)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="self-start text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
              >
                ← Toutes les catégories
              </button>
              <p className="text-sm font-medium text-foreground">
                {INCIDENT_CATEGORY_LABEL[selectedCategory] ?? selectedCategory}
              </p>
              <div className="flex flex-col gap-2.5">
                {zoneCounts.map(({ zoneLabel, count }) => (
                  <Bar
                    key={zoneLabel}
                    label={zoneLabel}
                    count={count}
                    maxCount={maxZoneCount}
                    color={INCIDENT_CATEGORY_COLOR[selectedCategory] ?? FALLBACK_COLOR}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
