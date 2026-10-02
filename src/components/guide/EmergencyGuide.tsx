'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GuideCard } from '@/components/guide/GuideCard'
import { Zap, Droplet, Flame, Thermometer, ArrowLeft, Phone, Mail, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { EmergencyCategory, DiagnosticZone, LocatorLevel } from '@/lib/emergency-guide'
import { Contact } from '@/types'
import { cn } from '@/lib/utils'

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
// sur le plan (gauche/droite) passe au niveau précédent/suivant -- un
// simple onTouchStart/onTouchEnd suffit à restreindre ce geste aux
// écrans tactiles, sans détection d'appareil séparée.

const SWIPE_THRESHOLD_PX = 40

function LocatorPlanImage({
  level,
  fullscreen,
  onToggle,
  onSwipe,
}: {
  level: LocatorLevel
  fullscreen: boolean
  onToggle: () => void
  onSwipe: (direction: 1 | -1) => void
}) {
  const touchStartXRef = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX === null) return
    const endX = e.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX
    if (deltaX > SWIPE_THRESHOLD_PX) onSwipe(-1)
    else if (deltaX < -SWIPE_THRESHOLD_PX) onSwipe(1)
  }

  if (!level.planImage) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Plan à venir
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={fullscreen ? 'Fermer le plan en plein écran' : 'Agrandir le plan'}
      className={cn(
        'relative block w-full overflow-hidden border-border bg-muted',
        fullscreen ? 'h-full rounded-none border-0' : 'h-48 rounded-lg border'
      )}
    >
      <Image src={level.planImage} alt={`Extincteurs — ${level.label}`} fill className="object-contain" />
    </button>
  )
}

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
        <LocatorPlanImage
          level={level}
          fullscreen={false}
          onToggle={() => setIsFullscreen(true)}
          onSwipe={goToOffset}
        />
      )}

      {isFullscreen && level && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label="Fermer le plan en plein écran"
            className="absolute right-4 top-4 text-white/80 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <LocatorPlanImage level={level} fullscreen onToggle={() => setIsFullscreen(false)} onSwipe={goToOffset} />
          </div>
        </div>
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
