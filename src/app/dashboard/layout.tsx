import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBanner } from '@/components/layout/TopBanner'
import { TileNav } from '@/components/layout/TileNav'
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
      <TopBanner />
      {/* Padding-bas du <main> = la place prise par TileNav + BottomNav,
          épinglées en fixed par-dessus le bas de l'écran (250px mobile /
          302px bureau — même calcul que celui documenté dans TileNav.tsx :
          sa hauteur propre 222/266px + son décalage bottom-7/9 28/36px),
          pour qu'aucune page ne voie son contenu caché dessous. Valeur
          reprise telle quelle de dashboard/page.tsx (seule page à avoir
          TileNav avant le 27/09/2026) au moment où TileNav est devenue
          commune à tous les onglets (voir TileNav.tsx et BottomNav.tsx).
          Padding-haut passé de pt-20 (80px, = la hauteur du bandeau,
          d'où un titre de page collé à la ligne de séparation du bas du
          bandeau — voir TopBanner.tsx) à pt-28 (112px) le 28/09/2026,
          demandé par Nicolas : plus d'espace entre cette ligne et le
          titre de chaque page (visuel envoyé pour "Planning", appliqué
          à tous les titres de page pour rester cohérent — voir leurs
          classes uppercase tracking-[0.08em] font-normal).

          Plus de max-w-5xl/mx-auto (retiré le 29/09/2026, demandé par
          Nicolas) : sur grand écran, ce plafond centrait le contenu et
          laissait deux marges qui grandissaient avec la largeur de la
          fenêtre. Les widgets doivent au contraire occuper toute la
          largeur disponible, avec un espace gauche/droite constant — le
          padding p-6 (24px) ci-dessous, désormais seul responsable de cet
          espace, quelle que soit la taille de la fenêtre. */}
      <main className="w-full p-6 pt-20 pb-[250px] md:pt-20 md:pb-[302px]">
        {children}
      </main>
      {/* Grille de navigation ("onglets") — commune à toutes les pages du
          tableau de bord depuis le 27/09/2026 (demandé par Nicolas : "le
          même bandeau onglet ... sur tous les onglets"), auparavant
          affichée seulement sur l'accueil (dashboard/page.tsx). Voir
          TileNav.tsx pour son positionnement (fixed, au-dessus de
          BottomNav). */}
      <TileNav role={profile.role} />
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
