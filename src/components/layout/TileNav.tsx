import Link from 'next/link'
import type { UserRole } from '@/types'

interface Tile {
  href: string
  label: string
  // Comptes "invité" : mêmes tuiles masquées qu'avant dans TopBanner
  // (Réalisations, Budget — voir l'historique de ce fichier avant le
  // 27/09/2026). Documents n'a pas de tuile pour l'instant : Nicolas
  // réfléchit encore à où le faire apparaître (27/09/2026).
  hiddenForFriend?: boolean
}

// Grille de navigation de la page d'accueil — refonte du 27/09/2026
// demandée par Nicolas, sur le modèle du visuel qu'il a fourni : 6
// tuiles, 3 colonnes x 2 lignes, qui remplacent les onglets qui étaient
// avant dans le bandeau du haut (TopBanner, désormais réduit au seul
// dessin de la bâtisse). "Entretien" est un renommage de l'ancien onglet
// "Tâches" (même route /dashboard/taches), pas un nouvel onglet.
const TILES: Tile[] = [
  { href: '/dashboard/planning', label: 'Planning' },
  { href: '/dashboard/taches', label: 'Entretien' },
  { href: '/dashboard/realisations', label: 'Réalisations', hiddenForFriend: true },
  { href: '/dashboard/guide', label: 'Guide de la maison' },
  { href: '/dashboard/contacts', label: 'Contacts' },
  { href: '/dashboard/budget', label: 'Budget', hiddenForFriend: true },
]

// Fixe sous le bandeau du haut (top-28, même hauteur que TopBanner) et
// toujours visible en scrollant (demandé par Nicolas le 27/09/2026 : "elle
// reste collée en bandeau bas, toujours visible en scrollant"). Pour
// l'instant affichée uniquement sur la page d'accueil (dashboard/page.tsx),
// à l'endroit indiqué sur son visuel — Nicolas veut aussi ce bandeau sur
// tous les autres onglets, mais réfléchit encore à une version réduite
// (une grille 3x2 permanente prendrait beaucoup de place sur les pages
// internes, et il faut décider comment elle cohabite avec BottomNav, le
// bandeau noir du bas qui existe déjà partout). À étendre aux autres pages
// une fois ce point tranché.
export function TileNav({ role }: { role: UserRole }) {
  const isFriend = role === 'friend'
  const tiles = isFriend ? TILES.filter((tile) => !tile.hiddenForFriend) : TILES

  return (
    <nav className="sticky top-28 z-30 -mx-6 grid grid-cols-3 gap-[14px] bg-background px-4 py-[14px] md:mx-0 md:rounded-none">
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className="flex min-h-[90px] items-center bg-card pl-4 pr-2 text-sm uppercase tracking-wide text-foreground hover:opacity-70 transition-opacity md:min-h-28 md:text-base"
        >
          {tile.label}
        </Link>
      ))}
    </nav>
  )
}
