'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Widget "Vidéos tutoriel" (27/10/2026, demande d'Aurélie) : savoir
// combien de fois chaque chapitre de /bienvenue (public/bienvenue/
// index.html, envoyée à la famille avant même qu'elle ait un compte) a
// été regardé. Après discussion, pas d'identité associée (ni prénom
// demandé, ni lien personnalisé par personne) -- seulement un compteur
// par chapitre, alimenté par POST /api/bienvenue-view (voir
// supabase/migration_bienvenue_views.sql). Même principe de widget
// déroulant "barres" que IncidentsHistory.tsx.
export interface TutorialViewRow {
  chapterId: string
  event: 'start' | 'end'
}

// Mêmes identifiants et même ordre que CHAPTERS dans
// public/bienvenue/index.html -- à garder synchronisés à la main (les
// deux fichiers ne peuvent pas partager un import, l'un étant une page
// statique servie hors de l'app Next.js).
const CHAPTER_LABELS: readonly [string, string][] = [
  ['premiers-pas', 'Premiers pas'],
  ['reserver', 'Réserver son séjour'],
  ['accompagnant', 'Inscrire un accompagnant'],
  ['calendrier', 'Lire le calendrier'],
  ['guide', 'Le guide de la maison'],
  ['urgences', 'En cas d’urgence'],
  ['contacts', 'Les contacts'],
  ['realisations', 'Partager une réalisation'],
  ['entretien', 'L’entretien'],
  ['budget', 'Suivre le budget'],
]

function Bar({ label, start, end, maxStart }: { label: string; start: number; end: number; maxStart: number }) {
  const widthPct = `${Math.max(4, (start / maxStart) * 100).toFixed(1)}%`
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-sm">
        <span className="min-w-0 text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{start}</span> vue{start === 1 ? '' : 's'}
          {end > 0 && ` · ${end} terminée${end === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full transition-[width]" style={{ background: 'var(--primary)', width: widthPct }} />
      </div>
    </div>
  )
}

export function TutorialViewsHistory({ rows }: { rows: TutorialViewRow[] }) {
  const [isOpen, setIsOpen] = useState(false)

  const counts = useMemo(() => {
    const starts = new Map<string, number>()
    const ends = new Map<string, number>()
    for (const r of rows) {
      const m = r.event === 'start' ? starts : ends
      m.set(r.chapterId, (m.get(r.chapterId) ?? 0) + 1)
    }
    return CHAPTER_LABELS.map(([id, label]) => ({ id, label, start: starts.get(id) ?? 0, end: ends.get(id) ?? 0 }))
  }, [rows])
  const totalStarts = useMemo(() => rows.filter((r) => r.event === 'start').length, [rows])
  const maxStart = Math.max(1, ...counts.map((c) => c.start))

  return (
    <Card className="py-0">
      <CardHeader>
        <button type="button" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen} className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80">
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">Vidéos tutoriel ({totalStarts})</CardTitle>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4">
          {totalStarts === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucune vue pour le moment.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {counts.map((c) => (
                <Bar key={c.id} label={c.label} start={c.start} end={c.end} maxStart={maxStart} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
