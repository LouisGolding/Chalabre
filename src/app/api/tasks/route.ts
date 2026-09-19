import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ajoute une tâche, ou bascule son statut fait/à faire. Réservé aux admins
// côté base (voir schema.sql, policy "tasks_admin") — tout le monde peut
// lire la liste, seul un admin peut la modifier.
//
// Mode développement : comme les autres routes d'écriture de l'app, rien
// n'est enregistré dans Supabase tant que NODE_ENV !== 'production'.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { title, category, priority, period } = await request.json()
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      category: category ?? 'entretien',
      priority: priority ?? 'medium',
      period: period ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id, completed } = await request.json()
  if (!id || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { error } = await supabase.from('tasks').update({ completed }).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
