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
    <div className="space-y-6 max-w-3xl">
      <PageTitle>Contacts</PageTitle>
      <ContactsBoard contacts={contacts ?? []} canEdit={canEdit} />
    </div>
  )
}
