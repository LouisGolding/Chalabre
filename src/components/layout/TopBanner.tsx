'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { BatisseMark } from './BatisseMark'

interface NavItem {
  href: string
  label: string
  // Onglets auxquels les comptes "invité" n'ont pas accès (voir
  // documents/page.tsx et budget/page.tsx, qui redirigent déjà côté
  // serveur — ce flag cache juste le lien pour ne pas les y envoyer pour
  // rien). Demandé par Aurélie le 18/09/2026.
  hiddenForFriend?: boolean
}

// Onglets du site — ordre demandé par Nicolas le 19/09/2026 : Planning,
// Guide de la maison, Tâches, Réalisations, Contacts, Budget, Documents.
// Sur bureau, deux lignes séparées par des tirets, alignées à droite (4
// puis 3, dans cet ordre) ; sur mobile, la même liste à plat dans le menu
// plein écran. Remplace l'ancien montage fixe 2×3 d'Aurélie : Réalisations
// ajoutée le 19/09/2026 en fait volontairement un 7e onglet ici plutôt que
// dans le bandeau noir du bas (BottomNav), à la demande de Nicolas.
const NAV_ROWS: NavItem[][] = [
  [
    { href: '/dashboard/planning', label: 'Planning' },
    { href: '/dashboard/guide', label: 'Guide de la maison' },
    { href: '/dashboard/taches', label: 'Tâches' },
    { href: '/dashboard/realisations', label: 'Réalisations', hiddenForFriend: true },
  ],
  [
    { href: '/dashboard/contacts', label: 'Contact' },
    { href: '/dashboard/budget', label: 'Budget', hiddenForFriend: true },
    { href: '/dashboard/documents', label: 'Documents', hiddenForFriend: true },
  ],
]

// Bandeau fixe présent sur toutes les pages connectées.
// - Bureau / paysage : logo + nom à gauche, onglets en toutes lettres à
//   droite, sur le modèle exact du montage (2 lignes, séparées par des
//   tirets, alignées à droite).
// - Mobile / portrait : logo + nom à gauche, petit bouton à droite qui
//   déroule un plein écran listant les mêmes onglets — la page derrière ne
//   bouge pas, seul ce bandeau apparaît par-dessus.
// Le bandeau garde toujours le même fond que ce qu'il y a juste en dessous :
// la photo (accueil) ou la couleur unie (autres pages), fixées elles aussi.
// Résultat : aucune couleur de bandeau visible, mais le texte de la page
// disparaît bien "derrière la photo" une fois qu'il scrolle sous le bandeau,
// au lieu de rester visible au travers.
export function TopBanner({ role }: { role: 'admin' | 'family' | 'friend' }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === '/dashboard'
  const isFriend = role === 'friend'
  // Les onglets réservés aux admins (Membres, Suivi paiements) ne vivent
  // plus ici : ils sont dans BottomNav, un bandeau séparé en bas de
  // l'écran, sur toutes les pages — y compris le menu mobile plein écran.
  // Pour les comptes "invité", Réalisations, Documents et Budget sont en
  // plus masqués (hiérarchie d'accès demandée par Aurélie le 18/09/2026,
  // étendue à Réalisations le 19/09/2026) — les lignes vides possibles
  // s'affichent normalement, la mise en page ne dépend pas d'un nombre
  // fixe d'onglets.
  const rows = isFriend
    ? NAV_ROWS.map((row) => row.filter((item) => !item.hiddenForFriend)).filter((row) => row.length > 0)
    : NAV_ROWS
  const flatItems = rows.flat()

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-16 md:h-24 items-center justify-between px-4 md:px-10 overflow-hidden ${
          isHome ? '' : 'bg-background'
        }`}
      >
        {isHome && (
          <>
            <div
              className="absolute inset-0 -z-10 md:hidden"
              style={{
                backgroundImage: "url('/images/accueil-bg-mobile.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: '43% 38%',
                backgroundAttachment: 'fixed',
              }}
            />
            <div
              className="absolute inset-0 -z-10 hidden md:block"
              style={{
                backgroundImage: "url('/images/accueil-bg-desktop.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: '39% 40%',
                backgroundAttachment: 'fixed',
              }}
            />
            <div className="absolute inset-0 -z-10 bg-background/40" />
          </>
        )}

        <Link href="/dashboard" className="flex items-start gap-3 text-foreground shrink-0">
          <BatisseMark className="h-7 w-auto md:h-9 shrink-0" />
          <span className="flex flex-col justify-between h-7 md:h-9">
            <span className="font-bold text-lg md:text-2xl leading-none tracking-[0.15em] uppercase">
              La Bâtisse
            </span>
            <span className="font-normal text-[10px] md:text-xs leading-none tracking-[0.1em] text-foreground translate-y-[2px]">
              5 generations family house
            </span>
          </span>
        </Link>

        {/* Bureau : onglets, 2 lignes séparées par des tirets, alignées à droite.
            Hauteur calée sur celle du logo (h-9) + justify-between : la 1re
            ligne colle en haut, la 2e en bas, exactement comme le logo — au
            lieu d'être centrées comme groupe (demandé par Nicolas le
            19/09/2026). "Se déconnecter" a été déplacé dans BottomNav. */}
        <nav className="hidden md:flex md:h-9 flex-col items-end justify-between">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap leading-none">
              {row.map((item, j) => (
                <span key={item.href} className="flex items-center gap-2">
                  {j > 0 && <span className="text-sm font-bold text-foreground leading-none">-</span>}
                  <Link
                    href={item.href}
                    className="text-sm font-bold text-foreground uppercase tracking-wide hover:opacity-60 transition-opacity leading-none"
                  >
                    {item.label}
                  </Link>
                </span>
              ))}
            </div>
          ))}
        </nav>

        {/* Mobile : petit rectangle qui ouvre le bandeau déroulant */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden flex h-7 w-7 items-center justify-center rounded-md border border-foreground/40 bg-transparent"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Menu mobile plein écran : fond blanc uni, rien ne bouge derrière */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex h-14 items-center justify-between px-4 shrink-0">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 text-foreground"
            >
              <BatisseMark className="h-7 w-auto shrink-0" />
              <span className="flex flex-col justify-between h-7">
                <span className="font-bold text-lg leading-none tracking-[0.15em] uppercase">
                  La Bâtisse
                </span>
                <span className="font-normal text-[10px] leading-none tracking-[0.1em] text-foreground translate-y-[2px]">
                  5 generations family house
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-7 px-6 pb-14">
            {flatItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-2xl font-bold text-foreground uppercase"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
