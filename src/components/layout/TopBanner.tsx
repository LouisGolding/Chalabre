'use client'

import Link from 'next/link'
import Image from 'next/image'

// Bandeau du haut — refonte du 27/09/2026 demandée par Nicolas : plus
// aucun onglet ici (ils vivent désormais dans la grille de tuiles de la
// page d'accueil, voir TileNav.tsx), seulement le dessin de la bâtisse
// (même PNG que le logo de la page de connexion), petit, centré, qui
// ramène à l'accueil au clic. Identique sur toutes les pages (mobile et
// bureau) et sur tous les rôles — plus besoin de la prop `role` qui
// servait à filtrer les onglets ici, ce filtrage vit maintenant dans
// TileNav.
//
// Bandeau réduit en hauteur (h-28 -> h-20) et dessin agrandi le
// 27/09/2026, toujours à la demande de Nicolas, pour coller au visuel
// qu'il a fourni. Important : `w-[32%]` ne fonctionnait pas comme prévu
// (le lien parent, en display:flex sans largeur propre, ne donne pas de
// base au pourcentage — l'image se retrouvait minuscule, bien en-deçà du
// plafond max-w-[130px] qu'on croyait actif). Remplacé par `vw`, qui se
// calcule toujours par rapport à l'écran et rend la taille réellement
// prévisible.
export function TopBanner() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 items-center justify-center bg-background">
      <Link href="/dashboard" aria-label="Retour à l'accueil" className="flex items-center justify-center">
        <Image
          src="/images/logo-batisse-drawing.png"
          alt="La Bâtisse"
          width={1897}
          height={652}
          priority
          className="h-auto w-[32vw] max-w-[140px]"
        />
      </Link>
    </header>
  )
}
