'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GuideCard } from '@/components/guide/GuideCard'
import { Zap, Droplet, Flame, Thermometer, ArrowLeft, Phone, Mail, CheckCircle2, AlertTriangle } from 'lucide-react'
import { EmergencyCategory, DiagnosticZone } from '@/lib/emergency-guide'
import { Contact } from '@/types'
import { cn } from '@/lib/utils'
import { PlanThumbnail, FullscreenPlanViewer } from '@/components/guide/PlanViewer'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  electrique: Zap,
  eau: Droplet,
  // Ajoutée le 27/09/2026 avec la catégorie "Plus d'eau chaude" (voir
  // emergency-guide.ts) — Thermometer plutôt que Droplet pour la
  // distinguer visuellement de "Fuite d'eau".
  'eau-chaude': Thermometer,
  extincteurs: Flame,
}

function PlanImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Plan à venir
      </div>
    )
  }
  return (
    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-muted">
      <Image src={src} alt={alt} fill className="object-contain" />
    </div>
  )
}

// --- Catégories "diagnostic" (panne électrique, fuite d'eau) -----------

type DiagnosticStep = 'idle' | 'zones' | 'solution' | 'outcome' | 'contacts'

function DiagnosticCard({
  category,
  contacts,
}: {
  category: Extract<EmergencyCategory, { kind: 'diagnostic' }>
  contacts: Contact[]
}) {
  const [step, setStep] = useState<DiagnosticStep>('idle')
  const [zone, setZone] = useState<DiagnosticZone | null>(null)
  const [incidentId, setIncidentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const Icon = CATEGORY_ICONS[category.id]

  const matchingContacts = contacts.filter((c) =>
    category.contactRoleKeywords.some((kw) => c.role?.toLowerCase().includes(kw))
  )

  const reset = () => {
    setStep('idle')
    setZone(null)
    setIncidentId(null)
  }

  const handlePickZone = async (z: DiagnosticZone) => {
    setZone(z)
    setStep('solution')
    setSubmitting(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: category.id, zoneId: z.id, zoneLabel: z.label }),
      })
      const data = await res.json()
      if (res.ok) setIncidentId(data.id)
    } catch {
      // silencieux — le parcours reste utilisable même si le signalement échoue
    } finally {
      setSubmitting(false)
    }
  }

  const handleOutcome = async (status: 'resolved' | 'persistent') => {
    if (incidentId) {
      fetch('/api/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, status }),
      }).catch(() => {})
    }
    if (status === 'resolved') {
      reset()
    } else {
      setStep('contacts')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {category.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {step === 'idle' && (
          <Button type="button" variant="outline" size="sm" className="bg-card/60 backdrop-blur-sm" onClick={() => setStep('zones')}>
            Signaler un problème
          </Button>
        )}

        {step === 'zones' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Où se trouve le problème ?</p>
            <div className="flex flex-wrap gap-2">
              {category.zones.map((z) => (
                <Button key={z.id} type="button" variant="outline" size="sm" className="bg-card/60 backdrop-blur-sm" onClick={() => handlePickZone(z)}>
                  {z.label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={reset}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Annuler
            </Button>
          </div>
        )}

        {step === 'solution' && zone && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{zone.label}</p>
            <PlanImage src={zone.planImage} alt={`Plan — ${zone.label}`} />
            <Button type="button" size="sm" className="bg-foreground text-background" disabled={submitting} onClick={() => setStep('outcome')}>
              {zone.checkLabel}
            </Button>
          </div>
        )}

        {step === 'outcome' && zone && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Une fois vérifié :</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-card/60 backdrop-blur-sm" onClick={() => handleOutcome('resolved')}>
                <CheckCircle2 className="h-4 w-4" />
                Problème réglé
              </Button>
              <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={() => handleOutcome('persistent')}>
                <AlertTriangle className="h-4 w-4" />
                Problème persistant
              </Button>
            </div>
          </div>
        )}

        {step === 'contacts' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">Le problème persiste — contacte un professionnel :</p>
            {matchingContacts.length > 0 ? (
              <div className="space-y-2">
                {matchingContacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                          <Phone className="h-3.5 w-3.5" />
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun contact renseigné pour l’instant — ajoute-le depuis l’onglet Contacts.
              </p>
            )}
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
              Terminer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Catégorie "locator" (extincteurs) ----------------------------------
//
// Refonte du 02/10/2026, demandée par Nicolas : plus d'étape "Voir les
// emplacements" / "Quel niveau ?" ni de bouton "Annuler" -- les 4
// pastilles de niveau (RDC/1er/2e/3e) restent toujours visibles, y
// compris une fois qu'une est sélectionnée (c'est elle qui est mise en
// évidence). Cliquer sur le plan affiché l'agrandit en plein écran ;
// recliquer dessus le referme. Sur mobile uniquement, glisser le doigt
// sur la vignette (pas sur le plan plein écran, voir plus bas) passe au
// niveau précédent/suivant -- un simple onTouchStart/onTouchEnd suffit à
// restreindre ce geste aux écrans tactiles, sans détection d'appareil
// séparée.
//
// Complété le 02/10/2026 (2) : la vignette adopte désormais le format
// réel des plans (plus de cadre 192px fixe, qui laissait des bandes
// vides) ; le plein écran s'ouvre d'office en pleine hauteur (au lieu
// d'être contenu dans l'écran, ce qui laissait les plans -- très larges
// et peu hauts -- minuscules sur un téléphone en portrait) et peut être
// pincé à deux doigts pour zoomer/dézoomer -- voir FullscreenPlanViewer.

// Les 4 plans fournis par Nicolas partagent tous le même format
// (6000x2138px, vérifié à l'ajout) : un seul ratio sert donc à la fois à
// donner sa forme à la vignette (CSS aspect-ratio) et à calculer la
// largeur du plan en plein écran à partir de sa hauteur. À adapter si un
// futur plan a un format différent.
//
// Vignette + plein écran (pincement/zoom/glissement, y compris le
// glisser pour changer de niveau sur la vignette) extraits le 04/10/2026
// dans PlanViewer.tsx (PlanThumbnail/FullscreenPlanViewer), pour être
// réutilisés à l'identique par le widget "Rangement indications" (Guide
// de la maison) -- demande explicite de Nicolas. Il ne reste plus rien à
// garder ici au-delà de ce ratio, propre aux plans Extincteurs.
const PLAN_ASPECT_RATIO = 6000 / 2138

function LocatorCard({ category }: { category: Extract<EmergencyCategory, { kind: 'locator' }> }) {
  const [levelId, setLevelId] = useState<string | null>(category.levels[0]?.id ?? null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const levelIndex = category.levels.findIndex((l) => l.id === levelId)
  const level = levelIndex >= 0 ? category.levels[levelIndex] : null

  const goToOffset = (offset: 1 | -1) => {
    if (levelIndex < 0) return
    const nextIndex = (levelIndex + offset + category.levels.length) % category.levels.length
    setLevelId(category.levels[nextIndex].id)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {category.levels.map((l) => (
          <Button
            key={l.id}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'bg-card/60 backdrop-blur-sm',
              l.id === levelId && 'bg-foreground text-background hover:bg-foreground hover:text-background'
            )}
            onClick={() => setLevelId(l.id)}
          >
            {l.label}
          </Button>
        ))}
      </div>

      {level && (
        <PlanThumbnail
          level={level}
          aspectRatio={PLAN_ASPECT_RATIO}
          altPrefix="Extincteurs"
          onToggle={() => setIsFullscreen(true)}
          onSwipe={goToOffset}
        />
      )}

      {isFullscreen && level && (
        <FullscreenPlanViewer
          level={level}
          aspectRatio={PLAN_ASPECT_RATIO}
          altPrefix="Extincteurs"
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  )
}

export function EmergencyGuide({ categories, contacts }: { categories: EmergencyCategory[]; contacts: Contact[] }) {
  return (
    <div className="space-y-3">
      {categories.map((category) =>
        category.kind === 'diagnostic' ? (
          <DiagnosticCard key={category.id} category={category} contacts={contacts} />
        ) : (
          // Repliable comme les autres widgets du Guide de la maison (voir
          // GuideCard.tsx) -- demandé par Nicolas le 02/10/2026, "même
          // mécanisme que les autres widgets de la page".
          <GuideCard key={category.id} title={category.label} content={<LocatorCard category={category} />} />
        )
      )}
    </div>
  )
}
