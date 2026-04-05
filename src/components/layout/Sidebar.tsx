'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Profile } from '@/types'
import {
  Home,
  Calendar,
  Wallet,
  BookOpen,
  Phone,
  FileText,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Accueil', icon: <Home className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/planning', label: 'Planning', icon: <Calendar className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/reserver', label: 'Réserver', icon: <Calendar className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/budget', label: 'Budget', icon: <Wallet className="h-5 w-5" />, roles: ['admin', 'family'] },
  { href: '/dashboard/guide', label: 'Guide', icon: <BookOpen className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/contacts', label: 'Contacts', icon: <Phone className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/mes-paiements', label: 'Mes paiements', icon: <Wallet className="h-5 w-5" />, roles: ['admin', 'family', 'friend'] },
  { href: '/dashboard/documents', label: 'Documents', icon: <FileText className="h-5 w-5" />, roles: ['admin', 'family'] },
  { href: '/dashboard/admin', label: 'Administration', icon: <Settings className="h-5 w-5" />, roles: ['admin'] },
]

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filteredNav = navItems.filter(item => item.roles.includes(profile.role))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.jpeg" alt="La Bâtisse" width={36} height={36} className="rounded-lg object-contain flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-stone-800 leading-tight">La Bâtisse</h1>
            <p className="text-xs text-stone-400">Chalabre</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-stone-200">
        <div className="text-sm font-medium text-stone-700">{profile.first_name} {profile.last_name}</div>
        <div className="text-xs text-stone-400 capitalize">{profile.family_group === 'friend' ? 'Ami(e) de la famille' : `Famille ${profile.family_group}`}</div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-stone-600 hover:bg-stone-100'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-stone-200">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-stone-600"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Se déconnecter
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-stone-200 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 h-full w-64 bg-white border-r border-stone-200 flex flex-col z-50">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
