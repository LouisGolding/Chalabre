'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const ADMIN_ITEMS = [
  // Libelle affiche renomme 'Membres' -> 'Gestion' le 26/10/2026
  // (demande d'Aurelie) -- route et logique d'acces (canSeeMembres,
  // canAccessMembresTab) inchangees, seul le texte visible change.
  { href: '/dashboard/admin', label: 'Gestion' },
  { href: '/dashboard/admin/paiements', label: 'Suivi paiements' },
  { href: '/dashboard/documents', label: 'Documents' },
  { href: '/dashboard/activites', label: 'Activités' },
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
// "Activités" ajouté le 08/10/2026 (session de test, voir
// points-a-regler-avec-louis.md) à la toute fin de la liste, pour la
// même raison que Documents ci-dessus : itemsBefore/itemsAfter restent
// corrects sans y toucher, puisque itemsAfter = items.slice(1) absorbe
// automatiquement tout nouvel élément ajouté en fin de tableau — seul un
// ajout AVANT Documents ou un changement d'ordre obligerait à revoir ce
// découpage.
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
//
// "Se déconnecter" devient "Mon profil" (19/10/2026, demande
// d'Aurélie) : menait à une page dédiée (/dashboard/profil) qui reprend les
// informations saisies à la première connexion, modifiables, avec un
// numéro de téléphone en plus -- "Se déconnecter" lui-même n'a pas
// disparu, il a simplement été déplacé en bas de cette nouvelle page
// (voir ProfileForm.tsx).
//
// "Mon profil" retiré de ce bandeau pour TOUS les rôles, admin compris
// (23/10/2026, demande d'Aurélie) : vit désormais exclusivement dans le
// médaillon du bandeau du haut (voir TopBanner.tsx), identique pour tout
// le monde. Seule différence entre rôles désormais : les comptes famille
// et amis n'ont plus aucun bandeau du bas du tout (ADMIN_ITEMS est vide
// pour eux, voir plus haut) ; les comptes admin gardent ce bandeau pour
// Membres / Suivi paiements / Documents / Activités, simplement sans
// "Mon profil" dedans. Le split itemsBefore/itemsAfter qui existait pour
// intercaler "Mon profil" au milieu de la liste n'a donc plus lieu d'être
// -- ADMIN_ITEMS s'affiche désormais directement, dans l'ordre.
// `canSeeMembres` (25/10/2026, demande d'Aurelie) : calcule cote serveur
// par dashboard/layout.tsx via lib/members-access.ts (seul endroit qui a
// deja le profil complet sous la main) -- ce composant n'a donc pas besoin
// de connaitre la logique de la liste des 4 personnes autorisees, juste le
// resultat. "Membres" est ainsi retire du lot "reserve aux admins"
// ci-dessus : desormais reserve a ces 4 personnes precises, meme pour un
// compte admin qui n'en fait pas partie (Suivi paiements/Documents/
// Activites restent, eux, ouverts a tout admin comme avant).
export function BottomNav({ role, canSeeMembres }: { role: UserRole; canSeeMembres: boolean }) {
  const pathname = usePathname()

  // Bandeau retiré entièrement pour les comptes famille et amis
  // (23/10/2026, demande d'Aurélie) : ces deux rôles n'ont plus rien à y
  // afficher (ADMIN_ITEMS vide pour eux, "Mon profil" vit désormais dans
  // TopBanner pour tout le monde, voir plus haut).
  if (role !== 'admin') return null

  const items = ADMIN_ITEMS.filter((item) => {
    if (item.href === '/dashboard/admin' && !canSeeMembres) return false
    if (item.href === '/dashboard/admin/paiements' && !SHOW_SUIVI_PAIEMENTS) return false
    return true
  })
  const hasPhotoBackground = pathname === '/dashboard'

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
      {items.map((item, i) => (
        <Fragment key={item.href}>
          <Link href={item.href} className={linkClass(pathname === item.href)}>
            {item.label}
          </Link>
          {/* Tirets verticaux fins entre les onglets (26/10/2026, demande
              d'Aurélie) : ce bandeau n'existe que pour les comptes admin
              (role !== 'admin' sort plus haut), donc ces séparateurs y
              sont de fait réservés sans condition supplémentaire. Pas
              après le dernier onglet. Même logique de couleur que
              linkClass (blanc cassé sur l'accueil, texture papier
              ailleurs), en plus discret (opacité réduite) qu'un libellé
              actif. */}
          {i < items.length - 1 && (
            <span
              aria-hidden="true"
              className={cn('h-3 w-px shrink-0 md:h-4', hasPhotoBackground ? 'bg-background/40' : 'bg-foreground/30')}
            />
          )}
        </Fragment>
      ))}
    </nav>
  )
}
