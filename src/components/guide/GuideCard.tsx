'use client'

import { useState, type ElementType, type ReactNode } from 'react'
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
  // Pictogramme optionnel affiche devant le titre -- demande par Nicolas
  // le 05/10/2026 pour "Extincteurs" et "Plus d'eau chaude" (meme
  // traitement que l'icone de DiagnosticCard dans EmergencyGuide.tsx).
  // Absent pour tous les autres widgets du Guide de la maison.
  icon?: ElementType
}

// Widget repliable du "Guide de la maison" : le titre reste toujours
// visible, le texte est masqué par défaut et se révèle au clic — reprend
// la logique d'ouverture/fermeture des pastilles "Prochain séjour X"
// (voir StayBanner dans NextStayCard.tsx). Demandé par Nicolas le
// 28/09/2026. Titre remonté à 16px/20px (md) + tracking 0,08em +
// MAJUSCULES le 30/09/2026 (harmonisation typo, voir
// "Typographie La Batisse.pdf").
export function GuideCard({ title, content, defaultOpen = false, icon: Icon }: GuideCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card className="py-0">
      {/* Entete replie cale a exactement 40px de hauteur totale (Card
          sans padding vertical propre + bouton h-10), titre et chevron
          parfaitement centres verticalement via items-center -- demande
          par Nicolas le 01/10/2026 ("Guide de la maison" + "Contacts",
          cf. ContactsBoard.tsx pour la pastille de categorie, meme
          traitement). */}
      <CardHeader>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
        >
          <CardTitle className="flex items-center gap-2 text-sm md:text-base uppercase tracking-wide">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
            {title}
          </CardTitle>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4">
          {/* div plutot que p : certains contenus (tableau Cheminee)
              incluent des elements de bloc, invalides a l'interieur d'un
              <p>. whitespace-pre-line reste sans effet sur ce contenu. */}
          <div className="text-sm text-muted-foreground whitespace-pre-line">{content}</div>
        </CardContent>
      )}
    </Card>
  )
}
