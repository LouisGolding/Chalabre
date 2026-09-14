import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isProfileIncomplete } from '@/lib/profile'
import { CompleteProfileForm } from './CompleteProfileForm'
import type { Profile } from '@/types'

export default async function CompleteProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/dashboard')
  if (!isProfileIncomplete(profile)) redirect('/dashboard')

  return <CompleteProfileForm profile={profile} />
}
