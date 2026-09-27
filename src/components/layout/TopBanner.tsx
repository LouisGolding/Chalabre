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
//
// Dessin réduit de 20% en homothétie le 27/09/2026 (32vw/140px ->
// 25.6vw/112px, même rapport largeur/hauteur).
//
// Alignement bas (items-end, collé au bas du bandeau) essayé le
// 27/09/2026 puis abandonné le même jour à la demande de Nicolas : il
// veut un espace visible entre le bas du dessin et le bas du bandeau,
// pas un dessin collé au bord. Étape intermédiaire : items-center (le
// dessin flotte au milieu, espace égal au-dessus et en dessous) —
// remplacé le même jour par une répartition précise demandée par
// Nicolas : hauteur du bandeau INCHANGÉE (h-20, 80px), mais l'espace
// entre le HAUT du dessin et le haut du bandeau doit valoir exactement
// 2x l'espace entre le BAS du dessin et le bas du bandeau (donc un
// dessin décalé vers le bas du bandeau, pas centré).
//
// Calcul (au viewport mobile de référence 402px, celui utilisé pour
// tous les réglages précis de ce bandeau) : largeur du dessin
// 25.6vw = 0.256 * 402 = 102.912px, hauteur au ratio du PNG
// (652/1897) = 35.37px. Avec bandeau = 80px et
// espace_haut = 2 * espace_bas : 2*espace_bas + 35.37 + espace_bas = 80,
// donc espace_bas = 14.88px et espace_haut = 29.75px. Implémenté en
// gardant le dessin calé en HAUT du bandeau (items-start) puis en le
// redescendant de 29.75px (mt-[29.75px]) — l'espace restant en bas
// (80 - 29.75 - 35.37 = 14.88px) se déduit automatiquement de la
// hauteur fixe du bandeau, sans avoir besoin de le fixer séparément.
// Comme le dessin est en vw (responsive) mais le bandeau et cette marge
// sont en px fixes, le ratio 2:1 n'est exact qu'à ce viewport de
// référence (402px) — cohérent avec le reste des réglages de ce
// bandeau (w-[25.6vw] max-w-[112px]), jamais recalculés dynamiquement
// pour d'autres largeurs d'écran.
export function TopBanner() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 items-start justify-center bg-background">
      <Link href="/dashboard" aria-label="Retour à l'accueil" className="mt-[29.75px] flex items-start justify-center">
        <Image
          src="/images/logo-batisse-drawing.png"
          alt="La Bâtisse"
          width={1897}
          height={652}
          priority
          className="h-auto w-[25.6vw] max-w-[112px]"
        />
      </Link>
    </header>
  )
}
