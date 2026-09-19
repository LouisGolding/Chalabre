'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types'

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', label: 'Membres' },
  { href: '/dashboard/admin/paiements', label: 'Suivi paiements' },
]

// "Adresse" est commun à tous les comptes (demandé par Aurélie le
// 18/09/2026) ; Membres et Suivi paiements restent réservés aux admins.
const COMMON_ITEMS = [
  { href: '/dashboard/adresse', label: 'Adresse' },
]

// Bandeau fixe en BAS de l'écran. Aurélie a demandé le 17/09/2026 que les
// onglets réservés aux admins n'apparaissent jamais dans le bandeau du
// haut (commun à tout le monde), mais dans ce second bandeau, en bas, pour
// bien les distinguer du reste du site — Membres et Suivi paiements n'y
// figurent donc que pour role === 'admin'.
//
// "Réalisations" (19/09/2026) est finalement rangé dans le menu du haut
// (TopBanner) avec les autres onglets, pas ici, à la demande de Nicolas.
// "Se déconnecter" (19/09/2026) a été déplacé ici, en dernier, depuis le
// bandeau du haut — pour libérer ce dernier des 2 lignes de tirets + une
// 3e ligne, et permettre d'aligner ses onglets pile sur la hauteur du logo.
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = [...(role === 'admin' ? ADMIN_ITEMS : []), ...COMMON_ITEMS]

  const linkClass = (active: boolean) =>
    `text-xs md:text-sm font-bold uppercase tracking-wide transition-opacity ${
      active ? 'text-background' : 'text-background/60 hover:text-background'
    }`

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-center gap-6 bg-foreground px-4 md:h-14 md:gap-10">
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
