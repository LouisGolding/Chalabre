'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BatisseMark } from '@/components/layout/BatisseMark'
import { Eye, EyeOff } from 'lucide-react'

// Étape 2 du mot de passe oublié : on arrive ici depuis le lien de récupération,
// après que /auth/callback a ouvert une session temporaire. La personne choisit
// un nouveau mot de passe (updateUser). Sans session valide (lien expiré, page
// ouverte directement), on ne montre pas le formulaire.
type Status = 'checking' | 'ready' | 'no-session'

export default function UpdatePasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let active = true

    // La session de récupération est posée par /auth/callback (cookies) juste
    // avant cette page ; getSession la retrouve. On écoute aussi
    // PASSWORD_RECOVERY au cas où le lien arriverait par le flux à fragment.
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setStatus('ready')
      else if (active) setStatus('no-session')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (session) setStatus('ready')
      else if (event === 'SIGNED_OUT') setStatus('no-session')
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    // La session est désormais valide avec le nouveau mot de passe : on entre.
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <BatisseMark className="h-16 w-auto md:h-20" />
          <h1 className="mt-4 font-bold text-2xl md:text-3xl tracking-[0.15em] uppercase">
            La Bâtisse
          </h1>
          <p className="mt-1 font-normal text-sm tracking-[0.1em]">
            5 generations family house
          </p>
        </div>

        <div className="mt-10">
          <h2 className="font-semibold text-xl text-foreground">Nouveau mot de passe</h2>

          {status === 'checking' && (
            <p className="mt-4 text-sm text-muted-foreground">Vérification du lien…</p>
          )}

          {status === 'no-session' && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-foreground">
                Ce lien de réinitialisation est invalide ou a expiré. Demande-en un nouveau.
              </p>
              <Link
                href="/auth/reset-password"
                className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
              >
                Recommencer
              </Link>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisis un nouveau mot de passe (au moins 8 caractères).
              </p>

              <form onSubmit={handleSubmit} className="mt-4 space-y-5">
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="nouveau mot de passe"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="block w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-2 pr-8 font-light text-base text-foreground outline-none focus:border-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="confirmer le mot de passe"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="block w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-2 font-light text-base text-foreground outline-none focus:border-foreground placeholder:text-muted-foreground"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || done}
                  className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : done ? 'Mot de passe changé' : 'Changer le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
