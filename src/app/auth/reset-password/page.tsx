'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BatisseMark } from '@/components/layout/BatisseMark'

// Étape 1 du mot de passe oublié : la personne saisit son email, Supabase lui
// envoie un lien de récupération. Ce lien revient sur /auth/callback (flux PKCE,
// ?code=), qui ouvre une session temporaire de récupération puis redirige vers
// /auth/update-password (via ?next=) où elle choisit un nouveau mot de passe.
//
// On affiche toujours le même message de succès, que l'adresse existe ou non :
// inutile de révéler quels emails ont un compte.
export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })

    // On ne divulgue pas si l'adresse a un compte : succès affiché dans tous les
    // cas sauf erreur technique (réseau, service indisponible).
    if (error && error.status && error.status >= 500) {
      setError('Service momentanément indisponible. Réessaie dans un instant.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
          <h2 className="font-semibold text-xl text-foreground">Mot de passe oublié</h2>

          {sent ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-foreground">
                Si un compte existe pour <span className="font-medium">{email.trim()}</span>, un
                lien de réinitialisation vient d&apos;être envoyé. Clique dessus pour choisir un
                nouveau mot de passe.
              </p>
              <p className="text-sm text-muted-foreground">
                Tu ne trouves pas l&apos;email ? Vérifie tes spams.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Saisis l&apos;adresse e-mail de ton compte : on t&apos;enverra un lien pour en
                choisir un nouveau.
              </p>

              <form onSubmit={handleSubmit} className="mt-4 space-y-5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                  className="block w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-2 font-light text-base text-foreground outline-none focus:border-foreground placeholder:text-muted-foreground"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                >
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>

              <p className="mt-6 text-sm text-foreground">
                Tu t&apos;en souviens finalement ?{' '}
                <Link href="/auth/login" className="font-medium hover:opacity-60 transition-opacity">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
