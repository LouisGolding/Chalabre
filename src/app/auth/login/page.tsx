'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BatisseMark } from '@/components/layout/BatisseMark'
import { Eye, EyeOff } from 'lucide-react'

// Codes set by /auth/callback when a Google or email link fails.
const callbackErrors: Record<string, string> = {
  oauth: 'La connexion Google a échoué. Veuillez réessayer.',
  exchange: 'Session impossible à ouvrir. Veuillez vous reconnecter.',
  otp: 'Ce lien a expiré ou a déjà été utilisé.',
  invalid: 'Lien de connexion invalide.',
}

function CallbackError() {
  const code = useSearchParams().get('error')
  if (!code) return null
  return (
    <p className="text-sm text-red-600 mb-2">
      {callbackErrors[code] ?? 'La connexion a échoué. Veuillez réessayer.'}
    </p>
  )
}

// Page de connexion : même direction artistique que l'accueil — même photo
// de fond (mêmes réglages), logo + wordmark + tagline centrés au-dessus
// d'un bloc "Connexion" aligné à gauche (email/mot de passe en champs
// soulignés transparents, comme les dates du widget "Prochain séjour"),
// pastille "Se connecter" noire, puis le lien d'inscription — repris du
// montage envoyé par Aurélie le 17/09/2026. L'ancien logo couleur
// (public/images/logo.jpeg) a été retiré définitivement à cette occasion.
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message === 'Invalid login credentials') {
        setError('Email ou mot de passe incorrect.')
      } else if (error.message === 'Email not confirmed') {
        setError('Adresse e-mail non confirmée — vérifie ta boîte mail (et les spams).')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      router.push('/dashboard')
      // Server components cached the signed-out session; drop that cache.
      router.refresh()
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Photo de fond — identique à l'accueil (mêmes fichiers, mêmes
          recadrages, même voile de lecture), en CSS background-image plutôt
          qu'en next/image (voir dashboard/page.tsx : le composant Image ne
          chargeait pas de façon fiable une photo de fond plein écran). */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 md:hidden"
          style={{
            backgroundImage: "url('/images/accueil-bg-mobile.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: '43% 38%',
          }}
        />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            backgroundImage: "url('/images/accueil-bg-desktop.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: '39% 40%',
          }}
        />
        <div className="absolute inset-0 bg-background/40" />
      </div>

      <div className="flex min-h-screen justify-center px-6 py-16 md:py-24">
        <div className="w-full max-w-sm">
          {/* Logo + "La Bâtisse" + tagline, centrés — comme le montage. */}
          <div className="flex flex-col items-center text-center text-foreground">
            <BatisseMark className="h-16 w-auto md:h-20" />
            <h1 className="mt-4 font-bold text-2xl md:text-3xl tracking-[0.15em] uppercase">
              La Bâtisse
            </h1>
            <p className="mt-1 font-normal text-sm tracking-[0.1em]">
              5 generations family house
            </p>
          </div>

          {/* Formulaire — aligné à gauche. */}
          <div className="mt-10">
            <h2 className="font-semibold text-xl text-foreground">Connexion</h2>

            <Suspense fallback={null}>
              <CallbackError />
            </Suspense>

            <form onSubmit={handleLogin} className="mt-4 space-y-5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
                className="block w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-2 font-light text-base text-foreground outline-none focus:border-foreground placeholder:text-muted-foreground"
              />

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mot de passe"
                  autoComplete="current-password"
                  required
                  className="block w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-2 pr-8 font-light text-base text-foreground outline-none focus:border-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <p className="mt-6 text-sm text-foreground">
              Pas encore de compte ?{' '}
              <Link href="/auth/register" className="font-medium hover:opacity-60 transition-opacity">
                S&apos;inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
