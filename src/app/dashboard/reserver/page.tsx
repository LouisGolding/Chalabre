import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookingForm } from '@/components/booking/BookingForm'

export default async function ReserverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-stone-800">Réserver un séjour</h1>
      <BookingForm profile={profile} rooms={rooms ?? []} />
    </div>
  )
}
