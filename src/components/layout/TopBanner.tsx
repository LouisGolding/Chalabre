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
export function TopBanner() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-28 items-center justify-center bg-background">
      <Link href="/dashboard" aria-label="Retour à l'accueil" className="flex items-center justify-center">
        <Image
          src="/images/logo-batisse-drawing.png"
          alt="La Bâtisse"
          width={1897}
          height={652}
          priority
          className="h-auto w-[32%] max-w-[130px]"
        />
      </Link>
    </header>
  )
}
