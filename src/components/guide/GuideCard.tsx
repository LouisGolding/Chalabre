'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface GuideCardProps {
  title: string
  // Accepte aussi bien une simple chaine multi-lignes (whitespace-pre-line
  // s'en charge) qu'un contenu plus riche (ex. mise en forme partielle
  // pour "Dechetterie", tableau pour "Cheminee") -- demande par Nicolas
  // le 29/09/2026.
  content: ReactNode
  defaultOpen?: boolean
}

// Widget repliable du "Guide de la maison" (catégories hors Urgences,
// qui reste gérée par EmergencyGuide.tsx) : le titre reste toujours
// visible, le texte est masqué par défaut et se révèle au clic — reprend
// la logique d'ouverture/fermeture des pastilles "Prochain séjour X"
// (voir StayBanner dans NextStayCard.tsx). Demandé par Nicolas le
// 28/09/2026.
export function GuideCard({ title, content, defaultOpen = false }: GuideCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-2 text-left hover:opacity-80"
        >
          <CardTitle className="text-base">{title}</CardTitle>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent>
          {/* div plutot que p : certains contenus (tableau Cheminee)
              incluent des elements de bloc, invalides a l'interieur d'un
              <p>. whitespace-pre-line reste sans effet sur ce contenu. */}
          <div className="text-sm text-muted-foreground whitespace-pre-line">{content}</div>
        </CardContent>
      )}
    </Card>
  )
}
