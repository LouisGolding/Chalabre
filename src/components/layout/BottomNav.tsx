'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', label: 'Membres' },
  { href: '/dashboard/admin/paiements', label: 'Suivi paiements' },
  { href: '/dashboard/documents', label: 'Documents' },
]

// Onglet "Suivi paiements" temporairement masque a la demande de Nicolas
// le 07/10/2026 -- meme convention que SHOW_FUITE_EAU/SHOW_DRAPS_LINGE
// dans guide/page.tsx : l'entree reste dans ADMIN_ITEMS ci-dessus,
// simplement filtree avant affichage (voir `items` dans BottomNav
// ci-dessous), prete a etre reaffichee en repassant cette constante a
// true. La page et la route /dashboard/admin/paiements elles-memes ne
// sont pas touchees, seul le lien dans ce bandeau disparait.
const SHOW_SUIVI_PAIEMENTS = false

// Bandeau fixe en BAS de l'écran. Aurélie a demandé le 17/09/2026 que les
// onglets réservés aux admins n'apparaissent jamais dans le bandeau du
// haut (commun à tout le monde), mais dans ce second bandeau, en bas, pour
// bien les distinguer du reste du site — Membres et Suivi paiements n'y
// figurent donc que pour role === 'admin'.
//
// "Adresse" (retiré le 19/09/2026, à la demande de Nicolas) vivait ici :
// l'adresse de la maison est désormais affichée directement en haut de
// "Guide de la maison" (src/app/dashboard/guide/page.tsx), jugé plus
// pertinent qu'un onglet à part entière. "Réalisations" est rangé dans le
// menu du haut (TopBanner) avec les autres onglets, pas ici. "Se
// déconnecter" (19/09/2026) reste dans ce bandeau pour tous les comptes
// — seul lui pour un compte non-admin (items vide), donc centré
// horizontalement par le justify-center du <nav> ci-dessous (seul enfant
// du flex).
//
// Position de "Se déconnecter" pour un compte admin — changé le
// 29/09/2026 à la demande de Nicolas : au MILIEU des 3 libellés (Membres,
// Se déconnecter, Suivi paiements), pas après les deux autres comme
// avant. Calculé en coupant ADMIN_ITEMS en deux autour de son milieu
// (itemsBefore/itemsAfter ci-dessous) plutôt qu'en codant en dur "1er
// item, déconnexion, 2e item", pour rester correct si la liste
// ADMIN_ITEMS change de taille un jour.
//
// "Documents" ré-ajouté le 06/10/2026 à la demande de Nicolas, réservé
// aux comptes admin, positionné juste après "Suivi paiements" (la page
// et la route existaient déjà, seul le lien de navigation avait disparu
// lors de la réorganisation de TileNav du 27/09/2026). Avec 3 libellés,
// le découpage générique Math.ceil(length/2) ci-dessus aurait mis "Se
// déconnecter" après Membres ET Suivi paiements au lieu de les séparer
// comme avant — donc le split avant/après n'est plus calculé
// automatiquement depuis ADMIN_ITEMS.length : il est fixé en dur
// (itemsBefore = [Membres], itemsAfter = [Suivi paiements, Documents])
// pour garder "Se déconnecter" au même endroit qu'avant (entre Membres
// et Suivi paiements) tout en plaçant Documents à la toute fin. À
// revoir si ADMIN_ITEMS change encore de taille ou d'ordre.
//
// Fond noir (bg-foreground) retiré le 27/09/2026 à la demande de Nicolas :
// transparent, laisse voir la photo plein écran de la page d'accueil
// (voir dashboard/page.tsx) au lieu d'un bandeau noir. Texte en
// text-foreground sur les pages à fond texturé (Planning, Entretien...),
// demandé par Nicolas le 28/09/2026 : même couleur que les libellés de
// la grille d'onglets (voir TileNav.tsx).
//
// Sur l'accueil (photo en fond) uniquement : texte en text-background
// ("blanc cassé", le ton crème du fond de page ailleurs sur le site —
// voir globals.css) plutôt que du blanc pur ou du gris. Deux essais
// avant celui-ci, le 29/09/2026 : blanc plein d'abord, puis blanc à 60%
// d'opacité (jugé peu lisible par Nicolas) — voir dashboard/page.tsx
// pour le même historique sur le reste du texte de cette page, qui
// utilise désormais la même couleur.
//
// Graisse normale (font-normal), pas grasse — changé le 29/09/2026 à la
// demande de Nicolas (était en font-bold depuis toujours), sur tous les
// onglets (pas seulement l'accueil).
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = (role === 'admin' ? ADMIN_ITEMS : []).filter(
    (item) => SHOW_SUIVI_PAIEMENTS || item.href !== '/dashboard/admin/paiements'
  )
  const hasPhotoBackground = pathname === '/dashboard'
  // Split fixe (pas de calcul générique sur items.length) : voir le
  // commentaire du 06/10/2026 ci-dessus sur ADMIN_ITEMS.
  const itemsBefore = items.slice(0, 1)
  const itemsAfter = items.slice(1)

  const linkClass = (active: boolean) =>
    cn(
      'text-xs md:text-sm font-normal uppercase tracking-wide transition-opacity',
      hasPhotoBackground
        ? active
          ? 'text-background'
          : 'text-background/60 hover:text-background'
        : active
          ? 'text-foreground'
          : 'text-foreground/60 hover:text-foreground'
    )

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-center gap-6 px-4 md:h-14 md:gap-10',
        // Fond fixe texturé sur ce bandeau aussi, demandé par Nicolas le
        // 28/09/2026 : il restait transparent, laissant le contenu de la
        // page défiler visible dessous (comme TileNav avant sa propre
        // correction, voir son historique). Toujours transparent sur
        // l'accueil : la photo plein écran doit continuer à se voir ici
        // comme partout ailleurs sur cette page.
        !hasPhotoBackground &&
          "bg-background bg-[url('/images/texture-papier.jpg')] bg-repeat bg-[length:307px_205px] dark:bg-none"
      )}
    >
      {itemsBefore.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
          {item.label}
        </Link>
      ))}
      <form action="/auth/signout" method="post">
        <button type="submit" className={linkClass(false)}>
          Se déconnecter
        </button>
      </form>
      {itemsAfter.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
