import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ContactsBoard } from '@/components/contacts/ContactsBoard'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { data: contacts } = await supabase.from('contacts').select('*').order('name')

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Contacts</h1>
      <ContactsBoard contacts={contacts ?? []} isAdmin={isAdmin} />
    </div>
  )
}
