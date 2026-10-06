'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// Contexte partagé pour que tous les widgets repliables du "Guide de la
// maison" (GuideCard.tsx) se comportent comme un seul accordéon : ouvrir
// l'un referme automatiquement celui qui était déjà ouvert, sur toute la
// page (Arrivée/Départ/Urgences/Organisation confondus) -- demandé par
// Nicolas le 06/10/2026 ("je trouve ça plus propre d'avoir toujours qu'un
// seul widget ouvert"). Un seul `openId` partagé (le titre du widget
// ouvert, ou `null` si aucun) plutôt qu'un état par widget.
//
// `GuideCard` reste utilisable hors de ce contexte (ex. dans un test, ou
// un futur usage ailleurs sur le site) : sans `GuideAccordionProvider`
// au-dessus, `useGuideAccordion()` renvoie `null` et `GuideCard` retombe
// sur son ancien comportement, un état local indépendant par widget.
interface GuideAccordionValue {
  openId: string | null
  setOpenId: (id: string | null) => void
}

const GuideAccordionContext = createContext<GuideAccordionValue | null>(null)

export function GuideAccordionProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <GuideAccordionContext.Provider value={{ openId, setOpenId }}>
      {children}
    </GuideAccordionContext.Provider>
  )
}

export function useGuideAccordion() {
  return useContext(GuideAccordionContext)
}
