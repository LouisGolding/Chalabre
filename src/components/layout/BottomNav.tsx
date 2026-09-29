'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', label: 'Membres' },
  { href: '/dashboard/admin/paiements', label: 'Suivi paiements' },
]

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
// déconnecter" (19/09/2026) reste ici, en dernier, pour tous les comptes
// — seul lui pour un compte non-admin (items vide), donc centré
// horizontalement par le justify-center du <nav> ci-dessous (seul enfant
// du flex).
//
// Fond noir (bg-foreground) retiré le 27/09/2026 à la demande de Nicolas :
// transparent, laisse voir la photo plein écran de la page d'accueil
// (voir dashboard/page.tsx) au lieu d'un bandeau noir. Texte en blanc
// (comme le reste du contenu sur la photo depuis le retrait du voile)
// plutôt que text-background/text-foreground, pensés pour un fond noir
// opaque — uniquement sur l'accueil : ailleurs (fond texturé, voir
// globals.css), le blanc devenait quasi illisible sur ce fond clair.
// Texte en text-foreground sur ces pages, demandé par Nicolas le
// 28/09/2026 : même couleur que les libellés de la grille d'onglets
// (Planning, Entretien, Réalisations... voir TileNav.tsx).
//
// Graisse normale (font-normal), pas grasse — changé le 29/09/2026 à la
// demande de Nicolas (était en font-bold depuis toujours). Sert aussi de
// référence de couleur pour l'accueil (voir dashboard/page.tsx,
// text-white/60) : les libellés inactifs de ce bandeau utilisent déjà ce
// même blanc à 60% d'opacité sur fond photo.
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = role === 'admin' ? ADMIN_ITEMS : []
  const hasPhotoBackground = pathname === '/dashboard'

  const linkClass = (active: boolean) =>
    cn(
      'text-xs md:text-sm font-normal uppercase tracking-wide transition-opacity',
      hasPhotoBackground
        ? active
          ? 'text-white'
          : 'text-white/60 hover:text-white'
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
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
          {item.label}
        </Link>
      ))}
      <form action="/auth/signout" method="post">
        <button type="submit" className={linkClass(false)}>
          Se déconnecter
        </button>
      </form>
    </nav>
  )
}
