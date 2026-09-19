'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Droplet, Flame, ArrowLeft, Phone, Mail, CheckCircle2, AlertTriangle } from 'lucide-react'
import { EmergencyCategory, DiagnosticZone, LocatorLevel } from '@/lib/emergency-guide'
import { Contact } from '@/types'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  electrique: Zap,
  eau: Droplet,
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

type LocatorStep = 'idle' | 'levels' | 'plan'

function LocatorCard({ category }: { category: Extract<EmergencyCategory, { kind: 'locator' }> }) {
  const [step, setStep] = useState<LocatorStep>('idle')
  const [level, setLevel] = useState<LocatorLevel | null>(null)
  const Icon = CATEGORY_ICONS[category.id]

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
          <Button type="button" variant="outline" size="sm" className="bg-card/60 backdrop-blur-sm" onClick={() => setStep('levels')}>
            Voir les emplacements
          </Button>
        )}

        {step === 'levels' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Quel niveau ?</p>
            <div className="flex flex-wrap gap-2">
              {category.levels.map((l) => (
                <Button key={l.id} type="button" variant="outline" size="sm" className="bg-card/60 backdrop-blur-sm" onClick={() => { setLevel(l); setStep('plan') }}>
                  {l.label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setStep('idle')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Annuler
            </Button>
          </div>
        )}

        {step === 'plan' && level && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{level.label}</p>
            <PlanImage src={level.planImage} alt={`Extincteur — ${level.label}`} />
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setStep('levels')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Autre niveau
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function EmergencyGuide({ categories, contacts }: { categories: EmergencyCategory[]; contacts: Contact[] }) {
  return (
    <div className="space-y-3">
      {categories.map((category) =>
        category.kind === 'diagnostic' ? (
          <DiagnosticCard key={category.id} category={category} contacts={contacts} />
        ) : (
          <LocatorCard key={category.id} category={category} />
        )
      )}
    </div>
  )
}
