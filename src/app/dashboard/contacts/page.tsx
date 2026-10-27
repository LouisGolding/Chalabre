import { PageTitle } from '@/components/layout/PageTitle'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { ContactsBoard } from '@/components/contacts/ContactsBoard'

export default async function ContactsPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')
  // Admin ET Famille peuvent editer les contacts depuis le 23/10/2026
  // (demande d'Aurelie) -- voir le commentaire au-dessus de
  // ContactsBoard pour le detail. Les comptes 'friend' restent en
  // lecture seule.
  const canEdit = profile?.role === 'admin' || profile?.role === 'family'

  const { data: contacts } = await supabase.from('contacts').select('*').order('name')

  return (
    // Plus de max-w-3xl (retire le 27/10/2026, demande d'Aurelie : les
    // tableaux de contacts doivent faire toute la largeur de l'ecran en
    // version ordinateur) -- meme convention que /dashboard/admin
    // (MembersTable), <main> donne deja la meme marge a gauche et a
    // droite via son p-6, aucun mx-auto/max-w ici ne doit la perturber.
    <div className="space-y-6">
      <PageTitle>Contacts</PageTitle>
      <ContactsBoard contacts={contacts ?? []} canEdit={canEdit} />
    </div>
  )
}
