import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Suivi des tâches d'Entretien (19/10/2026, demandé par Aurélie) :
// plusieurs notes datées par tâche, chacune pouvant porter une date de
// RDV facultative (voir migration_task_notes_contacts.sql, pas encore
// appliquée). Remplace l'ancien champ unique `tasks.comment`. Même
// principe que /api/house-log/comments : append-only, pas de PATCH.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { task_id, text, rdv_date } = await request.json()
  if (!task_id || typeof task_id !== 'string' || !text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('task_notes')
    .insert({
      task_id,
      user_id: user.id,
      text: text.trim(),
      rdv_date: typeof rdv_date === 'string' && rdv_date ? rdv_date : null,
    })
    .select('*, profile:profiles(first_name, last_name)')
    .single()

  if (error) {
    // Table absente tant que la migration n'est pas appliquée : message
    // clair plutôt qu'une 500 brute (même convention que Budget/Activités).
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }

  // RLS (task_notes_delete) limite déjà à l'auteur ou un admin -- une
  // suppression bloquée se traduit ici par 0 ligne affectée, pas une
  // erreur Postgres (même pattern que /api/house-log DELETE).
  const { data, error } = await supabase.from('task_notes').delete().eq('id', id).select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Suppression non autorisée' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
