import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBanner } from '@/components/layout/TopBanner'
import { BottomNav } from '@/components/layout/BottomNav'
import { isProfileIncomplete } from '@/lib/profile'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Signed in but no profiles row — the handle_new_user trigger did not fire.
  // Redirecting to /auth/login here would ping-pong forever, since the proxy
  // sends a signed-in visitor straight back to /dashboard.
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-stone-800">Profil introuvable</h1>
          <p className="text-stone-500 text-sm">
            Votre compte existe ({user.email}) mais aucun profil ne lui est associé.
            Contactez un administrateur de La Bâtisse pour le créer.
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Google supplies no birth date or family group, so an OAuth signup lands
  // here with placeholder data that feeds the booking rate. Collect it first.
  if (isProfileIncomplete(profile)) redirect('/auth/completer-profil')

  return (
    <div className="min-h-screen">
      <TopBanner role={profile.role} />
      <main className="max-w-5xl mx-auto p-6 pt-20 pb-20 md:pt-32 md:pb-24">
        {children}
      </main>
      {/* Bandeau du bas : "Membres" / "Suivi paiements" pour les admins
          seuls, "Se déconnecter" en dernier pour tout le monde (jamais
          dans le bandeau du haut) — voir BottomNav. "Adresse" y a vécu du
          18/09 au 19/09/2026 avant d'être repris dans "Guide de la
          maison" ; "Réalisations" est resté dans le bandeau du haut
          (TopBanner) avec les autres onglets. Rendu pour tout le monde
          depuis le 18/09/2026, d'où le padding-bas du <main> toujours
          actif, plus seulement pour les admins. */}
      <BottomNav role={profile.role} />
    </div>
  )
}
