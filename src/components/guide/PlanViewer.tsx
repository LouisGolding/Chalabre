'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

// Visualiseur de plan reutilisable : vignette cliquable au format reel
// du plan, plein ecran avec pincement pour zoomer (mobile) et defilement
// pour se deplacer, glisser pour changer de niveau sur la vignette
// (mobile). Extrait le 04/10/2026 depuis EmergencyGuide.tsx (widget
// "Urgences" -> "Extincteurs", refonte du 02/10/2026) pour etre reutilise
// a l'identique par le widget "Rangement indications" (Guide de la
// maison) -- demande explicite de Nicolas ("Cette image aura les memes
// fonctionnalites que les images dans le widget urgences"). Pur deplacement
// de code, aucun changement de comportement pour Urgences.
//
// `aspectRatio` est un parametre (pas une constante en dur comme avant
// cette extraction) : les 4 plans "Extincteurs" partagent tous le format
// 6000x2138px, mais les futurs plans "Rangement indications" n'ont pas
// encore ete fournis par Nicolas et n'ont donc pas de format confirme --
// un ratio par defaut raisonnable (3:2, format paysage courant) est
// utilise en attendant, a ajuster si besoin une fois les vrais plans
// recus (voir storage-guide.ts).

export interface PlanLevel {
  id: string
  label: string
  planImage?: string
}

const SWIPE_THRESHOLD_PX = 40
const ZOOM_MIN = 1
const ZOOM_MAX = 4

export function PlanThumbnail({
  level,
  aspectRatio,
  altPrefix,
  onToggle,
  onSwipe,
}: {
  level: PlanLevel
  aspectRatio: number
  altPrefix: string
  onToggle: () => void
  onSwipe?: (direction: 1 | -1) => void
}) {
  const touchStartXRef = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX === null || !onSwipe) return
    const endX = e.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX
    if (deltaX > SWIPE_THRESHOLD_PX) onSwipe(-1)
    else if (deltaX < -SWIPE_THRESHOLD_PX) onSwipe(1)
  }

  if (!level.planImage) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
        style={{ aspectRatio }}
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
      style={{ aspectRatio }}
    >
      <Image
        src={level.planImage}
        alt={`${altPrefix} — ${level.label}`}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 700px"
      />
    </button>
  )
}

// Plan en plein ecran : pleine hauteur par defaut sur mobile, pincement a
// deux doigts pour zoomer, glisser pour se deplacer une fois zoome --
// voir le detail du mecanisme dans le commentaire d'origine (desormais
// ici) depuis le 02/10/2026.
export function FullscreenPlanViewer({
  level,
  aspectRatio,
  altPrefix,
  onClose,
}: {
  level: PlanLevel
  aspectRatio: number
  altPrefix: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [isMobile, setIsMobile] = useState(true)
  const [zoomScale, setZoomScale] = useState(1)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)

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

  const [lastLevelId, setLastLevelId] = useState(level.id)
  if (level.id !== lastLevelId) {
    setLastLevelId(level.id)
    setZoomScale(1)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
      el.scrollTop = 0
    })
  }, [level.id])

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

  const baseHeightPx = isMobile
    ? containerSize.height
    : Math.min(containerSize.height, containerSize.width / aspectRatio)
  const height = Math.round(baseHeightPx * zoomScale)
  const width = Math.round(height * aspectRatio)

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
      <div ref={containerRef} className="h-full w-full overflow-auto" onClick={onClose}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <div className="relative mx-auto" style={{ width, height }}>
            <Image
              src={level.planImage}
              alt={`${altPrefix} — ${level.label}`}
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
