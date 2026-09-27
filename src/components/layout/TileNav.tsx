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

// Épinglée en BAS de l'écran (demandé par Nicolas le 27/09/2026 : "place
// le bandeau ... en bas de l'ecran"), juste au-dessus de BottomNav (le
// bandeau noir "Membres / Suivi paiements / Se déconnecter", toujours
// affiché lui aussi en position fixe) — d'où bottom-12/md:bottom-14, qui
// reprend exactement la hauteur de BottomNav pour que les deux bandeaux
// s'empilent sans espace ni chevauchement. Fond transparent : la photo
// de la page d'accueil (voir dashboard/page.tsx) couvre désormais toute
// la page et se voit donc déjà à travers les espaces entre les tuiles,
// comme sur le visuel de Nicolas — TileNav a eu son propre fond photo un
// temps (public/images/tuiles-bg.jpg) le 27/09/2026, remplacé le même
// jour par cette photo plein écran unique. Seules les tuiles elles-mêmes
// gardent un fond plein (bg-card). Pour l'instant affichée uniquement
// sur la page d'accueil (dashboard/page.tsx) ; Nicolas veut aussi ce
// bandeau sur tous les autres onglets mais réfléchit encore à une
// version réduite et à sa cohabitation avec BottomNav — à étendre une
// fois ce point tranché.
export function TileNav({ role }: { role: UserRole }) {
  const isFriend = role === 'friend'
  const tiles = isFriend ? TILES.filter((tile) => !tile.hiddenForFriend) : TILES

  return (
    <nav className="fixed inset-x-0 bottom-12 md:bottom-14 z-30 grid grid-cols-3 gap-[14px] px-4 py-[14px]">
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          // Texte centré (horizontalement et verticalement) dans chaque
          // tuile, demandé par Nicolas le 27/09/2026 — auparavant aligné à
          // gauche (pl-4 pr-2 + items-center ne centrait que verticalement).
          className="flex min-h-[90px] items-center justify-center bg-card px-2 text-center text-sm uppercase tracking-wide text-foreground hover:opacity-70 transition-opacity md:min-h-28 md:text-base"
        >
          {tile.label}
        </Link>
      ))}
    </nav>
  )
}
