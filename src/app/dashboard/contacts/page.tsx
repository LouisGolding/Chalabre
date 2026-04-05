import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Phone, Mail } from 'lucide-react'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('role')

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-stone-800">Contacts</h1>

      {contacts && contacts.length > 0 ? (
        <div className="space-y-3">
          {contacts.map(contact => (
            <Card key={contact.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-stone-800">{contact.name}</p>
                    <p className="text-sm text-stone-500">{contact.role}</p>
                    {contact.notes && <p className="text-sm text-stone-400 mt-1">{contact.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-stone-400">Aucun contact renseigné. Un administrateur peut en ajouter.</p>
      )}
    </div>
  )
}
