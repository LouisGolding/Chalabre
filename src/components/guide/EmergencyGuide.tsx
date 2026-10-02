'use client'

import { useEffect, useRef, useState } from 'react'
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

const SWIPE_THRESHOLD_PX = 40

// Les 4 plans fournis par Nicolas partagent tous le même format
// (6000x2138px, vérifié à l'ajout) : un seul ratio sert donc à la fois à
// donner sa forme à la vignette (CSS aspect-ratio) et à calculer la
// largeur du plan en plein écran à partir de sa hauteur (voir
// FullscreenPlanViewer). À adapter si un futur plan a un format différent.
const PLAN_ASPECT_RATIO = 6000 / 2138

function LocatorPlanImage({
  level,
  onToggle,
  onSwipe,
}: {
  level: LocatorLevel
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
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
        style={{ aspectRatio: PLAN_ASPECT_RATIO }}
      >
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
      aria-label="Agrandir le plan"
      className="relative block w-full overflow-hidden rounded-lg border border-border bg-muted"
      style={{ aspectRatio: PLAN_ASPECT_RATIO }}
    >
      <Image
        src={level.planImage}
        alt={`Extincteurs — ${level.label}`}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 700px"
      />
    </button>
  )
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4

// Plan en plein écran : pleine hauteur par défaut, pincement à deux
// doigts pour zoomer, glisser pour se déplacer une fois zoomé -- demandé
// par Nicolas le 02/10/2026. Le conteneur défilant (overflow-auto) gère
// le déplacement nativement (comportement standard du navigateur, pas de
// code à écrire) : l'image est dimensionnée en pixels réels à partir de
// `zoomScale` (pas via une transformation CSS, qui ne change que l'aspect
// visuel sans agrandir la zone de défilement) afin que chaque partie de
// l'image agrandie reste atteignable en glissant.
function FullscreenPlanViewer({ level, onClose }: { level: LocatorLevel; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  // "Pleine hauteur d'office" ne s'applique qu'au mobile (précision de
  // Nicolas le 02/10/2026) -- sur bureau, le plan garde le comportement
  // d'origine (entièrement contenu dans l'écran, comme object-contain).
  // Même seuil que le "md" de Tailwind (768px), utilisé partout ailleurs
  // en CSS sur le site -- initialisé à true pour que le tout premier
  // rendu (avant que l'effet ci-dessous ne mesure la vraie largeur) se
  // comporte comme sur mobile plutôt que de clignoter.
  const [isMobile, setIsMobile] = useState(true)
  const [zoomScale, setZoomScale] = useState(1)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)

  // Taille de référence du conteneur, mesurée à l'ouverture et à chaque
  // redimensionnement -- l'image part toujours de cette taille (zoomScale
  // = 1), jamais d'un simple h-full/w-full CSS, pour que le calcul de
  // largeur (PLAN_ASPECT_RATIO) et le zoom restent cohérents entre eux.
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsMobile(!mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Remet le zoom à 1 à chaque changement de plan (nouveau niveau choisi
  // pendant que le plein écran est ouvert, ou réouverture) -- jamais de
  // zoom hérité du plan précédent. Ajustement de state pendant le rendu
  // (compare à la dernière valeur connue) plutôt qu'un useEffect, pour
  // rester conforme à la règle eslint react-hooks/set-state-in-effect du
  // projet (même motif qu'au point 31, TileNav.tsx).
  const [lastLevelId, setLastLevelId] = useState(level.id)
  if (level.id !== lastLevelId) {
    setLastLevelId(level.id)
    setZoomScale(1)
  }

  // Recentre horizontalement le défilement à chaque changement de plan --
  // pure manipulation du DOM (pas de setState ici), donc un useEffect
  // classique convient.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
      el.scrollTop = 0
    })
  }, [level.id])

  // Pincement à deux doigts : addEventListener natif plutôt que les props
  // React onTouchMove (passives par défaut pour les événements tactiles,
  // donc impossible d'y appeler preventDefault), nécessaire pour bloquer
  // le zoom natif de la page pendant le geste.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const distance = (touches: TouchList) => {
      const a = touches[0]
      const b = touches[1]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDistance: distance(e.touches), startScale: zoomScale }
      }
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const ratio = distance(e.touches) / pinchRef.current.startDistance
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchRef.current.startScale * ratio))
        setZoomScale(next)
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [zoomScale])

  if (!level.planImage) return null

  // Base avant zoom : pleine hauteur sur mobile (déborde en largeur, vue
  // par défilement) ; sur bureau, contenu dans les deux dimensions à la
  // fois (la plus contraignante des deux l'emporte), comme avant cette
  // demande -- les plans sont très larges, donc sur un grand écran c'est
  // en général la largeur qui limite, pas la hauteur.
  const baseHeightPx = isMobile
    ? containerSize.height
    : Math.min(containerSize.height, containerSize.width / PLAN_ASPECT_RATIO)
  const height = Math.round(baseHeightPx * zoomScale)
  const width = Math.round(height * PLAN_ASPECT_RATIO)

  return (
    <div className="fixed inset-0 z-50 bg-black/95">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le plan en plein écran"
        className="absolute right-4 top-4 z-10 text-white/80 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>
      {/* onClick ici (pas stopPropagation sur l'image) : un tap simple,
          sur le plan ou à côté, referme -- seul un glisser (pincement ou
          défilement) ne déclenche pas de clic, comportement natif du
          navigateur, rien à coder en plus pour distinguer les deux. */}
      <div ref={containerRef} className="h-full w-full overflow-auto" onClick={onClose}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <div className="relative mx-auto" style={{ width, height }}>
            {/* unoptimized : en plein écran, la largeur réelle affichée
                dépasse largement la largeur de l'écran dès le mode "pleine
                hauteur" (plan très large), et davantage encore une fois
                pincé/zoomé -- l'optimiseur d'images de Next.js choisirait
                une résolution basée sur la largeur de l'écran seule (trop
                petite), produisant un agrandissement flou. On sert donc le
                fichier original tel quel ici, demandé par Nicolas le
                02/10/2026 après avoir constaté une perte de netteté au
                zoom. La vignette repliée (LocatorPlanImage, jamais
                zoomée) garde l'optimisation normale. */}
            <Image
              src={level.planImage}
              alt={`Extincteurs — ${level.label}`}
              fill
              className="object-contain"
              sizes="100vw"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
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

      {level && <LocatorPlanImage level={level} onToggle={() => setIsFullscreen(true)} onSwipe={goToOffset} />}

      {isFullscreen && level && <FullscreenPlanViewer level={level} onClose={() => setIsFullscreen(false)} />}
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
