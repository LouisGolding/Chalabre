import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Association tâche <-> contact (Services), demandée par Aurélie le
// 19/10/2026 : une tâche peut avoir plusieurs contacts (ex. plombier +
// électricien). Voir migration_task_notes_contacts.sql (pas encore
// appliquée).

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { task_id, contact_id } = await request.json()
  if (!task_id || typeof task_id !== 'string' || !contact_id || typeof contact_id !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { error } = await supabase
    .from('task_contacts')
    .insert({ task_id, contact_id, created_by: user.id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')
  const contactId = searchParams.get('contact_id')
  if (!taskId || !contactId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { error } = await supabase
    .from('task_contacts')
    .delete()
    .eq('task_id', taskId)
    .eq('contact_id', contactId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
