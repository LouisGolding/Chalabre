'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useId } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { colorForName, colorForPaletteIndex, textureMultipliedColor } from '@/lib/colors'
import type { Profile } from '@/types'

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
//
// Fine ligne de séparation en bas du bandeau, demandée par Nicolas le
// 28/09/2026, uniquement sur les onglets SANS photo plein écran en fond
// (planning, entretien, réalisations, etc. — tous sauf l'accueil, seule
// page avec la photo de dashboard/page.tsx) : sur ces pages au fond clair
// uni, le bandeau (même bg-background) se fondait sans démarcation avec
// le contenu en dessous. Couleur demandée : la même que la typo de ces
// pages, donc border-foreground (text-foreground, voir par ex. le <h1>
// de taches/page.tsx) — pas de bordure du tout sur l'accueil, où la
// photo plein écran crée déjà une séparation nette.
export function TopBanner({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const hasPhotoBackground = pathname === '/dashboard'

  // Médaillon "Mon profil" (23/10/2026, demande d'Aurélie) : affiché ici
  // pour TOUS les rôles, admin compris (précisé par Aurélie après un
  // premier essai limité à famille/amis) -- "Mon profil" a disparu de
  // BottomNav pour tout le monde (voir BottomNav.tsx). Seule différence
  // entre rôles : les comptes famille et amis n'ont plus de bandeau du
  // bas du tout (BottomNav ne s'y rend plus), les comptes admin gardent
  // ce bandeau pour Membres/Suivi paiements/Documents/Activités, sans
  // "Mon profil" dedans.
  //
  // Initiale + couleur : demande explicite d'Aurélie le 23/10/2026
  // ("associe la couleur de la pastille à la couleur de sa pastille
  // planning") -- reprend EXACTEMENT la même formule que la couleur
  // d'un séjour propre (pas un accompagnant) dans Planning
  // (resolveColor, voir dashboard/planning/page.tsx) : color_hue
  // enregistré en base avec family_group si connu
  // (colorForPaletteIndex), sinon le même repli que Planning pour un
  // compte sans couleur enregistrée (colorForName('Séjour'), pas un
  // repli par nom propre à ce bandeau -- resterait incohérent avec la
  // couleur affichée pour cette même personne dans Planning sinon).
  //
  // Position verticale : calée sur le CENTRE du dessin de la bâtisse, pas
  // sur le centre du bandeau de 80px (essai initial du 23/10/2026, voir
  // historique git) -- remplacé le même jour par un calage sur le HAUT du
  // dessin, à la nouvelle demande explicite d'Aurélie ("aligne le haut de
  // la medaille avec le haut du logo"). Le haut du dessin est à 29.75px du
  // haut du bandeau (mt-[29.75px] du lien du logo, voir plus bas). Le rond
  // du médaillon mesure 23px et vit dans une zone cliquable de 36px
  // centrée par flex (items-center/justify-center) : pour que le HAUT du
  // rond tombe exactement à 29.75px, la zone de 36px doit donc commencer à
  // 29.75 - (36-23)/2 = 29.75 - 6.5 = 23.25px du haut du bandeau.
  //
  // Aspect "négatif" (23/10/2026, demande d'Aurélie : "fais apparaitre son
  // aspect, en negatif (couleur pleine, lettre transparente)") -- remplace
  // l'ancien rendu (contour + lettre colorés, fond transparent) par un
  // rond ENTIÈREMENT rempli de badgeColor, avec l'initiale découpée en
  // véritable trou transparent (pas juste une lettre d'une autre couleur)
  // qui laisse voir ce qu'il y a dessous (texture papier du bandeau, ou
  // tuile/photo quand le médaillon passe au-dessus). Pas possible en CSS
  // pur (mix-blend-mode ne fait pas de vraie transparence de type
  // Porter-Duff "destination-out" de façon fiable sur tous les
  // navigateurs) -- fait avec un <mask> SVG : un disque blanc + le texte
  // de l'initiale en noir à l'intérieur du mask (le noir = zone retirée),
  // appliqué à un disque plein de badgeColor. `useId()` donne un id de
  // mask garanti unique (évite toute collision si ce composant venait à
  // être rendu plusieurs fois sur une même page).
  const badgeColor =
    typeof profile.color_hue === 'number'
      ? colorForPaletteIndex(profile.family_group, profile.color_hue)
      : colorForName('Séjour')
  const initial = profile.first_name.trim().charAt(0).toUpperCase()
  const maskId = useId()
  // Assombrit badgeColor du même effet moyen que le mélange "multiply"
  // avec la texture papier, pour que ce rond PLEIN (un <svg>, pas un fond
  // CSS) rende la même teinte à l'œil que les séjours de Planning et la
  // bannière "Prochain séjour" de l'accueil, qui appliquent tous deux ce
  // mélange (coloredTextureStyle, voir colors.ts) -- sans ça le médaillon
  // paraissait plus clair que "sa pastille planning" (remarqué par
  // Aurélie le 23/10/2026), alors que la couleur de départ est identique.
  const fillColor = textureMultipliedColor(badgeColor)

  return (
    <header
      className={cn(
        // Même texture papier que le fond des pages (voir globals.css),
        // prolongée dans le bandeau du haut sur tous les onglets — demandé
        // par Nicolas le 28/09/2026. Même répétition en tuile et même
        // échelle (307x205, réduite x5) que body, pour rester cohérent
        // visuellement même si la jointure n'est pas garantie pixel pour
        // pixel avec le contenu en dessous (bandeau fixe, page qui
        // défile). Classe Tailwind arbitraire (pas de style inline) pour
        // que dark:bg-none puisse bien la neutraliser en mode sombre,
        // comme pour body.
        "fixed inset-x-0 top-0 z-40 flex h-20 items-start justify-center bg-background bg-[url('/images/texture-papier.jpg')] bg-repeat bg-[length:307px_205px] dark:bg-none",
        !hasPhotoBackground && 'border-b border-foreground'
      )}
    >
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
      <Link
        href="/dashboard/profil"
        aria-label="Mon profil"
        className="absolute right-4 top-[23.25px] flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-70"
      >
        <svg aria-hidden="true" width="23" height="23" viewBox="0 0 23 23" className="text-xs">
          <mask id={maskId}>
            <circle cx="11.5" cy="11.5" r="11.5" fill="white" />
            <text x="11.5" y="11.5" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="black">
              {initial}
            </text>
          </mask>
          <circle cx="11.5" cy="11.5" r="11.5" fill={fillColor} mask={`url(#${maskId})`} />
        </svg>
      </Link>
    </header>
  )
}
