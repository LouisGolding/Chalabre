'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

// Codes set by /auth/callback quand un lien d'e-mail échoue (connexion par
// Google retirée le 19/09/2026 — 'oauth' ne devrait plus être déclenché en
// pratique, gardé par sécurité si Supabase renvoie une erreur générique).
const callbackErrors: Record<string, string> = {
  oauth: 'La connexion a échoué. Veuillez réessayer.',
  exchange: 'Session impossible à ouvrir. Veuillez vous reconnecter.',
  otp: 'Ce lien a expiré ou a déjà été utilisé.',
  invalid: 'Lien de connexion invalide.',
}

function CallbackError() {
  const code = useSearchParams().get('error')
  if (!code) return null
  return (
    <p className="text-sm text-red-600 mt-3 text-center">
      {callbackErrors[code] ?? 'La connexion a échoué. Veuillez réessayer.'}
    </p>
  )
}

// Page de connexion — refonte du 27/09/2026 demandée par Nicolas à partir
// d'un montage précis qu'il a fourni (voir points-a-regler-avec-louis.md).
// Nouvelle direction artistique, format mobile d'abord :
// - nouvelle photo de fond (fournie par Nicolas), désaturée de 20 %
//   (Pillow, ImageEnhance.Color(0.8) — corrigé le 27/09/2026, la
//   première passe était à -30 %) une seule fois au moment de la
//   préparer, pas en CSS/JS à l'affichage ;
// - nouveau dessin de la bâtisse (PNG détouré, plus détaillé que l'ancien
//   tracé SVG de BatisseMark.tsx — celui-ci n'est PAS touché ici, il reste
//   utilisé ailleurs sur le site tant que ce n'est pas décidé) ;
// - wordmark "LA BÂTISSE" en EB Garamond Regular, tracking 0.1em (= 100 en
//   unités Photoshop, cf. layout.tsx) ;
// - carte crème (email/mot de passe, couleur #F5F1EF pipettée sur le
//   montage) + pastille "SE CONNECTER" dans la teinte olive sombre
//   pipettée sur le montage (#393F2F — légèrement plus verte que le noir
//   --foreground utilisé pour les autres pastilles du site, couleur
//   dédiée à cette page pour coller précisément au montage), légèrement
//   plus large que la carte au-dessus, comme sur le montage ;
// - "Mot de passe oublié" / "S'inscrire" en blanc directement sur la
//   photo, sous la carte.
// Le format bureau/paysage n'est pas encore retravaillé (Nicolas a
// explicitement demandé de commencer par le mobile) : au-delà de md, la
// mise en page reprend telle quelle les classes mobiles pour l'instant,
// à reprendre lors du prochain passage.
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
    <div className="relative flex min-h-screen flex-col">
      {/* Photo de fond — plein écran, déjà désaturée -30 % côté fichier
          (voir commentaire ci-dessus). Une seule image pour l'instant
          (mobile) : `background-size: cover` sur un viewport étroit et
          haut recadre naturellement sur la hauteur, donc le dégradé
          ciel → collines → village → herbe du fichier source (paysage,
          2000×1114) se retrouve entièrement visible malgré le format
          portrait — pas besoin d'un recadrage séparé. */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/login-bg-mobile.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
        />
      </div>

      {/* Logo + wordmark + tagline, centrés en haut. */}
      <div className="flex flex-col items-center px-6 pt-[140px] text-center md:pt-20">
        <Image
          src="/images/logo-batisse-drawing.png"
          alt="La Bâtisse"
          width={1897}
          height={652}
          priority
          className="h-auto w-[48%] max-w-[190px]"
        />
        <h1 className="mt-4 font-serif text-4xl uppercase tracking-[0.1em] text-foreground md:text-5xl">
          La Bâtisse
        </h1>
        <p className="mt-2 font-serif text-xs uppercase tracking-[0.25em] text-foreground md:text-sm">
          Chalabre - 11230
        </p>
      </div>

      {/* Espace ouvert sur la photo, pousse le formulaire vers le bas. */}
      <div className="flex-1" />

      {/* Formulaire. */}
      <form onSubmit={handleLogin} className="pb-8">
        <Suspense fallback={null}>
          <CallbackError />
        </Suspense>

        {/* Carte crème : champs email / mot de passe. */}
        <div className="mx-9 rounded-2xl bg-card px-6 py-3 shadow-lg md:mx-auto md:max-w-sm">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Votre@mail"
            autoComplete="email"
            required
            className="block w-full border-0 bg-transparent py-3 font-serif text-lg text-card-foreground outline-none placeholder:text-card-foreground/70"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
              className="block w-full border-0 bg-transparent py-3 pr-8 font-serif text-lg text-card-foreground outline-none placeholder:text-card-foreground/70"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-card-foreground/60 hover:text-card-foreground"
              tabIndex={-1}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Pastille "SE CONNECTER" — légèrement plus large que la carte
            au-dessus (comme sur le montage), même teinte que les
            pastilles noires du reste du site. */}
        <button
          type="submit"
          disabled={loading}
          className="mx-9 mt-4 block w-[calc(100%-4.5rem)] rounded-2xl bg-[#393F2F] py-4 text-center font-serif text-base uppercase tracking-[0.15em] text-[#F5F1EF] disabled:opacity-50 md:mx-auto md:max-w-sm"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        {error && <p className="mx-9 mt-3 text-sm text-red-600 md:mx-auto md:max-w-sm">{error}</p>}

        {/* Liens, en blanc directement sur la photo, sous la pastille. */}
        <div className="mx-9 mt-4 space-y-0.5 text-sm font-medium text-white md:mx-auto md:max-w-sm">
          <p>
            <Link href="/auth/reset-password" className="hover:opacity-80 transition-opacity">
              Mot de passe oublié
            </Link>
          </p>
          <p>
            <Link href="/auth/register" className="hover:opacity-80 transition-opacity">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
