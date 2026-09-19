'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
// déconnecter" (19/09/2026) reste ici, en dernier, pour tous les comptes.
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = role === 'admin' ? ADMIN_ITEMS : []

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
