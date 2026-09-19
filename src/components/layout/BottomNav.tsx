'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types'

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', label: 'Membres' },
  { href: '/dashboard/admin/paiements', label: 'Suivi paiements' },
]

// "Réalisations" (19/09/2026) : fil façon blog de ce qui a été entrepris
// dans la maison (tonte, réparation, réfection d'une pièce...), réservé
// aux membres de la famille — jamais aux amis (RLS house_log_select côté
// base : voir migration_house_log_realisations.sql, pas encore appliquée).
const FAMILY_ITEMS = [
  { href: '/dashboard/realisations', label: 'Réalisations' },
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
// figurent donc que pour role === 'admin'. Prend le role complet (plutôt
// qu'un simple isAdmin, depuis l'ajout de "Réalisations" le 19/09/2026)
// pour pouvoir aussi distinguer "family" de "friend".
export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = [
    ...(role === 'admin' ? ADMIN_ITEMS : []),
    ...(role !== 'friend' ? FAMILY_ITEMS : []),
    ...COMMON_ITEMS,
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-center gap-6 bg-foreground px-4 md:h-14 md:gap-10">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-xs md:text-sm font-bold uppercase tracking-wide transition-opacity ${
              active ? 'text-background' : 'text-background/60 hover:text-background'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
