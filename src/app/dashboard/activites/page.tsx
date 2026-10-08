import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ActivitesBoard } from '@/components/activites/ActivitesBoard'
import type { LocalEvent } from '@/types'

// Onglet "Activités" (événements locaux à Chalabre et alentours), session
// de test lancée le 08/10/2026 après accord de Nicolas et Louis sur le
// principe : coller un texte brut (affiche, programme...), une IA en
// extrait une liste structurée, un admin relit/corrige avant d'enregistrer
// (voir claude/prompt-onglet-evenements.md). Contrairement aux autres
// onglets réservés aux admins qui ne restreignent que les actions
// d'écriture, celui-ci est réservé aux admins dans son intégralité (page
// comprise) -- demandé explicitement par Nicolas, d'où le redirect
// systématique ci-dessous pour tout compte non-admin (pas seulement
// 'friend' comme documents/page.tsx).
export default async function ActivitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: events } = await supabase
    .from('local_events')
    .select('*')
    .order('event_date', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle>Activités</PageTitle>
      <ActivitesBoard initialEvents={(events ?? []) as LocalEvent[]} />
    </div>
  )
}
