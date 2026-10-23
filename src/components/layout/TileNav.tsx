'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface Tile {
  href: string
  label: string
  // Comptes "invité" : toute la 2e ligne de la grille (voir plus bas),
  // donc Réalisations, Entretien et Budget depuis le 29/09/2026 (Entretien
  // s'y est ajouté à cette date, auparavant visible pour tous — demandé
  // par Nicolas). Documents n'a pas de tuile pour l'instant : Nicolas
  // réfléchit encore à où le faire apparaître (27/09/2026).
  hiddenForFriend?: boolean
  // Réservée aux comptes admin : masquée aussi pour les comptes
  // "family", pas seulement "friend" -- la page elle-même redirige tout
  // compte non-admin. A servi pour Budget du 16/10/2026 au 17/10/2026
  // (onglet alors admin uniquement) ; depuis le 17/10/2026 Budget est
  // ouvert aux comptes "family" (seul le widget "Déposer le relevé
  // bancaire" y reste réservé aux admins, voir BudgetBoard.tsx) et ne
  // porte donc plus ce flag -- conservé pour un futur onglet qui en
  // aurait besoin.
  adminOnly?: boolean
}

// Grille de navigation de la page d'accueil — refonte du 27/09/2026
// demandée par Nicolas, sur le modèle du visuel qu'il a fourni : 6
// tuiles, 3 colonnes x 2 lignes, qui remplacent les onglets qui étaient
// avant dans le bandeau du haut (TopBanner, désormais réduit au seul
// dessin de la bâtisse). "Entretien" est un renommage de l'ancien onglet
// "Tâches" (même route /dashboard/taches), pas un nouvel onglet.
// Ordre demandé par Nicolas le 29/09/2026 (2 lignes de 3) :
// ligne 1 - Planning / Guide de la maison / Contacts
// ligne 2 - Réalisations / Entretien / Budget
// Toute la 2e ligne est masquée pour les comptes "invité" (hiddenForFriend
// sur ses 3 tuiles) : Entretien rejoint donc Réalisations et Budget dans
// ce qu'un invité ne voit plus du tout, plutôt que de rester affiché seul
// sur une 2e ligne vide.
const TILES: Tile[] = [
  { href: '/dashboard/planning', label: 'Planning' },
  { href: '/dashboard/guide', label: 'Guide de la maison' },
  { href: '/dashboard/contacts', label: 'Contacts' },
  { href: '/dashboard/realisations', label: 'Réalisations', hiddenForFriend: true },
  { href: '/dashboard/taches', label: 'Entretien', hiddenForFriend: true },
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
  const isAdmin = role === 'admin'
  const tiles = TILES.filter((tile) => (!isFriend || !tile.hiddenForFriend) && (!tile.adminOnly || isAdmin))

  // TEST du 28/09/2026 (demandé par Nicolas : la grille lui paraît trop
  // imposante) : masquée par défaut, réduite à une petite poignée
  // (bouton chevron) ; un clic dessus déploie la grille complète, un
  // second clic la referme. Non persisté (redémarre fermée à chaque
  // navigation/rechargement). L'accueil avait jusqu'ici la grille
  // toujours dépliée, sans poignée (demandé par Nicolas le 28/09/2026) ;
  // depuis le 23/10/2026 (demande d'Aurélie), elle a elle aussi la
  // poignée et peut être repliée -- seule différence : elle s'affiche
  // DÉPLIÉE par défaut (hasPhotoBackground au lieu de false), là où
  // toutes les autres pages démarrent repliées.
  const [isOpen, setIsOpen] = useState(hasPhotoBackground)
  // Repliée par défaut à CHAQUE arrivée sur un onglet, pas seulement au tout
  // premier chargement (demandé par Nicolas le 02/10/2026) : TileNav vit
  // dans le layout partagé du tableau de bord (dashboard/layout.tsx) et
  // n'est donc jamais remontée par une navigation interne (Planning -> Guide
  // de la maison, etc.) -- useState(false) seul ne referme la grille qu'au
  // tout premier rendu ; sans ceci, une grille laissée ouverte sur un onglet
  // restait ouverte en changeant d'onglet. Ajustement de state pendant le
  // rendu (motif recommandé par React pour réagir à un changement de prop/
  // route, voir "Adjusting state when a prop changes") plutôt qu'un
  // useEffect, pour rester conforme à la règle eslint
  // react-hooks/set-state-in-effect du projet.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setIsOpen(hasPhotoBackground)
  }
  // Poignée affichée sur toutes les pages, accueil compris depuis le
  // 23/10/2026 (showToggle valait auparavant !hasPhotoBackground, donc
  // false sur l'accueil -- plus de différence de système entre les
  // pages, seul l'état replié/déplié par défaut change).
  const showToggle = true
  const isExpanded = showToggle ? isOpen : true
  // Halo flou derrière la croix : visible seulement quand quelque chose
  // de "chargé" passe dessous (texte/caractères de la page, ou la photo
  // de l'accueil), pas sur le fond beige canson uni (demande d'Aurélie du
  // 23/10/2026, après la mise en place du halo). Sur l'accueil
  // (hasPhotoBackground), la photo est toujours derrière, repliée ou
  // dépliée -- halo toujours visible. Sur les autres pages : repliée
  // (!isExpanded), le fond papier fixe de cette grille est encore à
  // opacity-0 (voir plus bas) donc le contenu de la page défile
  // potentiellement dessous -- halo visible ; dépliée (isExpanded), ce
  // même fond papier recouvre tout en beige uni -- halo masqué.
  const showHalo = hasPhotoBackground || !isExpanded

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 transition-[bottom] duration-[1500ms] ease-in-out',
        // Repliée, la poignée était initialement collée au bord haut du
        // bandeau du bas (bottom-12/md:bottom-14, la hauteur exacte de
        // BottomNav, voir BottomNav.tsx) — rapprochée de moitié du
        // bandeau le 23/10/2026 (demande d'Aurélie, "rapproche la de
        // moitié par rapport au bord du bandeau bas") : bottom-6/
        // md:bottom-7 (24px/28px). Dépliée ou sur l'accueil, la grille
        // garde son ancrage habituel (bottom-7/md:bottom-9, réglage plus
        // ancien, accolé à BottomNav sans chevaucher son texte).
        isExpanded ? 'bottom-7 md:bottom-9' : 'bottom-6 md:bottom-7'
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
          l'appui. Toujours montée (plus de montage conditionnel sur
          isExpanded) et pilotée par opacity, pour s'estomper en 1,5s en
          même temps que la grille se déploie (demandé par Aurélie le
          23/10/2026) plutôt que d'apparaître/disparaître d'un coup. */}
      {!hasPhotoBackground && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-background bg-[url('/images/texture-papier.jpg')] bg-repeat bg-[length:307px_205px] transition-opacity duration-[1500ms] ease-in-out dark:bg-none",
            isExpanded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
      <div className="relative flex flex-col items-center">
        {showToggle && (
          // Poignée sans fond propre (retiré le 23/10/2026, demande
          // d'Aurélie) : seule la croix doit se voir, pas de pastille
          // ni de texture derrière elle. La zone cliquable (h-10 w-14)
          // reste plus grande que l'icône pour un clic confortable.
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Masquer les onglets' : 'Afficher les onglets'}
            className="relative flex h-10 w-14 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            {/* Croix occitane a la place du chevron (23/10/2026, demande
                d'Aurelie, maquette validee), ajustee le meme jour (icone 2x
                plus grosse, sans fond, rotation sur 1.5s au rythme de la
                grille) : -rotate-180 (et non rotate-180) pour que
                l'ouverture tourne dans le sens inverse des aiguilles d'une
                montre et la fermeture dans le sens des aiguilles d'une
                montre, comme demande. La croix etant symetrique, son
                apparence au repos est identique ouverte/fermee ; seul le
                demi-tour signale l'action. Voir .icon-croix-occitane dans
                globals.css. */}
            {/* Halo flou derrière la croix (demandé par Aurélie le
                23/10/2026) : un rond flou, un peu plus grand que la
                croix, aux contours progressifs (jamais nets) -- un
                dégradé radial qui s'estompe vers la transparence, encore
                adouci par un flou CSS, plutôt qu'un cercle plein.
                Masqué sur fond beige canson uni (showHalo plus haut,
                précisé par Aurélie juste après la mise en place du
                halo) : visible seulement quand du texte ou une photo
                passe dessous, pas sur un simple aplat de couleur. */}
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-1/2 top-1/2 h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-md transition-opacity duration-[1500ms] ease-in-out',
                showHalo ? 'opacity-100' : 'opacity-0'
              )}
              style={{
                background:
                  'radial-gradient(circle, rgba(115,52,63,0.16) 0%, rgba(115,52,63,0.07) 45%, rgba(115,52,63,0) 75%)',
              }}
            />
            {/* Croix occitane, agrandie d'un tiers (23/10/2026, demande
                d'Aurélie : 32px -> ~43px). Couleur fixe (ne suit plus le
                thème via currentColor) : blanche sur l'accueil, pour
                rester lisible sur la photo plein écran -- rouge bordeaux
                #73343F (palette Argile "invités", voir src/lib/colors.ts)
                partout ailleurs. */}
            <span
              aria-hidden="true"
              className={cn(
                'icon-croix-occitane relative h-[43px] w-[43px] shrink-0 transition-transform duration-[1500ms] ease-in-out',
                hasPhotoBackground ? 'text-white' : 'text-[#73343F]',
                isOpen && '-rotate-180'
              )}
            />
          </button>
        )}
        {/* Déploiement progressif sur 1,5s (demandé par Aurélie le
            23/10/2026, comme la maquette) : la grille reste toujours
            montée et c'est grid-template-rows qui anime 0fr -> 1fr
            (plutôt qu'un max-height deviné), le <nav> en overflow-hidden
            masquant les tuiles tant que la ligne est à 0fr. */}
        <div
          className={cn(
            'grid w-full transition-[grid-template-rows] duration-[1500ms] ease-in-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <nav
            className={cn(
              'grid grid-cols-3 gap-[14px] overflow-hidden px-4 py-[14px] transition-opacity duration-[1500ms] ease-in-out',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
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
        </div>
      </div>
    </div>
  )
}
