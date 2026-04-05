import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningView } from '@/components/planning/PlanningView'

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name, family_group), rooms(name)')
    .order('check_in', { ascending: true })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-stone-800">Planning</h1>
      <PlanningView bookings={bookings ?? []} events={events ?? []} />
    </div>
  )
}
