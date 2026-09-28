'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
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
// le bandeau ... en bas de l'ecran"), au-dessus de BottomNav (le bandeau
// "Membres / Suivi paiements / Se déconnecter", toujours affiché lui
// aussi en position fixe). Position par rapport à BottomNav, essayée
// dans cet ordre le 27/09/2026 : d'abord un vrai espace supplémentaire
// (bottom-24/28, 2x la hauteur de BottomNav) ; puis, visuel annoté à
// l'appui (ligne verte), un accolement complet à BottomNav (bottom-12/
// 14, sa hauteur exacte, donc zéro espace entre les deux conteneurs) ;
// puis, toujours le même jour, Nicolas a trouvé l'espace jusqu'au texte
// "Se déconnecter" encore trop grand (le texte est centré dans
// BottomNav, donc en retrait de son propre bord haut) et a demandé de le
// réduire — d'où bottom-7/md:bottom-9 actuel, qui rapproche la grille de
// BottomNav sans chevaucher son texte. Si Nicolas veut resserrer
// davantage, continuer dans cette direction (diminuer encore
// bottom-7/9), en pensant à ajuster en miroir le padding-bottom du
// contenu de dashboard/page.tsx (pb-[250px]/md:pb-[302px] — voir sa
// propre note de calcul). Fond transparent :
// la photo de la page d'accueil (voir
// dashboard/page.tsx) couvre désormais toute la page et se voit donc
// déjà à travers les espaces entre les tuiles, comme sur le visuel de
// Nicolas — TileNav a eu son propre fond photo un temps
// (public/images/tuiles-bg.jpg) le 27/09/2026, remplacé le même jour par
// cette photo plein écran unique. Seules les tuiles elles-mêmes gardent
// un fond plein (bg-card). Pour l'instant affichée uniquement sur la
// page d'accueil (dashboard/page.tsx) ; Nicolas veut aussi ce bandeau
// sur tous les autres onglets mais réfléchit encore à une version
// réduite et à sa cohabitation avec BottomNav — à étendre une fois ce
// point tranché.
export function TileNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  // Comme TopBanner : seule l'accueil a une photo plein écran en fond
  // (voir dashboard/page.tsx) — les espaces entre les tuiles y restent
  // transparents pour laisser voir la photo, comme prévu à l'origine.
  const hasPhotoBackground = pathname === '/dashboard'
  const isFriend = role === 'friend'
  const tiles = isFriend ? TILES.filter((tile) => !tile.hiddenForFriend) : TILES

  // TEST du 28/09/2026 (demandé par Nicolas : la grille lui paraît trop
  // imposante) : masquée par défaut, réduite à une petite poignée
  // (bouton chevron) ; un clic dessus déploie la grille complète, un
  // second clic la referme. Non persisté (redémarre fermée à chaque
  // navigation/rechargement). L'accueil garde la grille toujours
  // dépliée, sans poignée (demandé par Nicolas le 28/09/2026) : seule la
  // photo plein écran y justifiait une grille imposante en permanence,
  // pas les pages au fond texturé.
  const [isOpen, setIsOpen] = useState(false)
  const showToggle = !hasPhotoBackground
  const isExpanded = showToggle ? isOpen : true

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30',
        // Repliée, la poignée (h-7, 28px) doit laisser 14px d'espace
        // libre au-dessus du bandeau du bas (Membres / Suivi paiements /
        // Se déconnecter, voir BottomNav.tsx, h-12/48px mobile,
        // h-14/56px bureau) plutôt que de le chevaucher — demandé par
        // Nicolas le 28/09/2026, capture d'écran à l'appui montrant la
        // poignée recouvrant "Se déconnecter". D'où bottom-[62px] (48+14)
        // et md:bottom-[70px] (56+14) à l'état replié, contre le
        // bottom-7/md:bottom-9 habituel (accolé à BottomNav sans
        // chevaucher son texte, réglage plus ancien) quand la grille est
        // dépliée ou sur l'accueil.
        isExpanded ? 'bottom-7 md:bottom-9' : 'bottom-[62px] md:bottom-[70px]'
      )}
    >
      {/* Fond fixe derrière la grille (uniquement quand elle est
          déployée), demandé par Nicolas le 28/09/2026 : sur les onglets
          au fond texturé (tous sauf l'accueil), le texte de la page
          défilait alors qu'il se voyait dans les espaces entre les
          tuiles (nav sans fond propre, seules les tuiles sont opaques en
          bg-card) — désormais un fond fixe (même texture papier que le
          reste du site, voir globals.css) passe derrière toute la
          grille, et le texte qui défile disparaît bien en dessous.
          Couvre tout le conteneur (inset-0), y compris sa marge haute de
          14px (py-[14px] plus bas, avant la première tuile) : un essai
          précédent laissait cette bande de 14px transparente, ce qui
          laissait justement passer un filet de contenu (ex. les flèches
          d'un carrousel photo de "Réalisations") juste au-dessus de la
          grille — corrigé le 28/09/2026, capture d'écran annotée à
          l'appui. */}
      {isExpanded && !hasPhotoBackground && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-background bg-[url('/images/texture-papier.jpg')] bg-repeat bg-[length:307px_205px] dark:bg-none"
        />
      )}
      <div className="relative flex flex-col items-center">
        {showToggle && (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Masquer les onglets' : 'Afficher les onglets'}
            className="flex h-7 w-12 items-center justify-center rounded-t-lg border border-b-0 border-border bg-card text-foreground transition-opacity hover:opacity-70"
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
        )}
        {isExpanded && (
          <nav className="grid w-full grid-cols-3 gap-[14px] px-4 py-[14px]">
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
        )}
      </div>
    </div>
  )
}
