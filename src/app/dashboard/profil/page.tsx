import { redirect } from 'next/navigation'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { PageTitle } from '@/components/layout/PageTitle'
import { ProfileForm } from '@/components/profil/ProfileForm'

// Page "Mon profil" (19/10/2026, demandée par Aurélie) : accessible à
// tous les comptes connectés (admin, family, friend — pas réservée),
// depuis le bandeau du bas, à la place de "Se déconnecter" qui vit
// désormais en bas de cette page (voir ProfileForm.tsx et
// BottomNav.tsx). Reprend les informations saisies à la première
// connexion (CompleteProfileForm.tsx) avec la possibilité de les
// corriger, plus un numéro de téléphone (nouvelle colonne, voir
// migration_profile_phone.sql, pas encore appliquée).
export default async function ProfilPage() {
  const { user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')

  // Même filet de sécurité que DashboardLayout pour un compte sans ligne
  // `profiles` (le trigger handle_new_user n'a pas tourné) : pas de page
  // à afficher, retour à l'accueil qui porte déjà ce message d'erreur.
  if (!profile) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <PageTitle>Mon profil</PageTitle>
      <ProfileForm profile={profile} />
    </div>
  )
}
