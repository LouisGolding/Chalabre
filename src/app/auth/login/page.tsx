'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff } from 'lucide-react'
import { getSeason } from '@/lib/utils'

const seasonImage: Record<string, string> = {
  summer: '/images/season_summer.jpeg',
  winter: '/images/season_winter.jpeg',
}

function getCurrentSeasonImage() {
  const season = getSeason(new Date())
  return seasonImage[season] ?? seasonImage.summer
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const bgImage = getCurrentSeasonImage()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — photo de fond */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <Image
          src={bgImage}
          alt="La Bâtisse"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-10 left-10 text-white">
          <p className="text-sm uppercase tracking-widest opacity-70 mb-1">Chalabre, Occitanie</p>
          <h1 className="text-5xl font-bold">La Bâtisse</h1>
        </div>
      </div>

      {/* Right — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-stone-50">
        {/* Logo mobile */}
        <div className="lg:hidden text-center mb-8">
          <Image src="/images/logo.jpeg" alt="La Bâtisse" width={80} height={80} className="mx-auto rounded-xl mb-3 object-contain" />
          <h1 className="text-3xl font-bold text-stone-800">La Bâtisse</h1>
          <p className="text-stone-400 text-sm">Chalabre, Occitanie</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Logo desktop */}
          <div className="hidden lg:flex items-center gap-3 mb-8">
            <Image src="/images/logo.jpeg" alt="Logo" width={44} height={44} className="rounded-lg object-contain" />
            <div>
              <p className="font-semibold text-stone-800">La Bâtisse</p>
              <p className="text-xs text-stone-400">Chalabre</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-stone-800 mb-1">Connexion</h2>
          <p className="text-stone-400 text-sm mb-6">Entrez vos identifiants pour accéder à La Bâtisse</p>

          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-3 mb-4"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirection...' : 'Continuer avec Google'}
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <Separator className="flex-1" />
            <span className="text-xs text-stone-400">ou</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-4">
            Pas encore de compte ?{' '}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
