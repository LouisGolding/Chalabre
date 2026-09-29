import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ajoute une tâche, ou met à jour son statut fait/à faire et son
// commentaire. Réservé aux admins côté base pour l'ajout/la suppression
// (voir schema.sql, policy "tasks_admin") — tout le monde peut lire la
// liste. Le PATCH (coche + commentaire) n'a volontairement pas de
// vérification de rôle ici : c'était déjà le cas avant la refonte du
// 27/09/2026, et le "reset" automatique des tâches jardin récurrentes
// (TasksBoard.tsx) doit pouvoir tourner depuis n'importe quel compte
// connecté qui ouvre la page.
//
// Commentaire "mode développement" retiré le 29/09/2026 (n'était plus
// vrai) : Louis a supprimé le mode simulé (isDev) de toutes les routes
// d'écriture le 19/09/2026 — cette route écrit donc réellement dans
// Supabase dès qu'elle est appelée, y compris en local (voir tout en haut
// de claude/points-a-regler-avec-louis.md).

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { title, category, priority, period, recurrence } = await request.json()
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      category: category ?? 'reparation',
      priority: priority ?? 'medium',
      period: period ?? null,
      // Uniquement pertinent pour la catégorie "jardin" (voir
      // TasksBoard.tsx) — null pour les autres catégories.
      recurrence: recurrence ?? null,
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

  const { id, completed, comment } = await request.json()
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof completed === 'boolean') {
    update.completed = completed
    // Date de clôture recalculée côté serveur (jamais confiée au client) :
    // sert au passage en archives à 30 jours (tâches non-jardin) et à la
    // réapparition à échéance des tâches jardin récurrentes — voir
    // TasksBoard.tsx.
    update.completed_at = completed ? new Date().toISOString() : null
  }
  if (typeof comment === 'string') {
    update.comment = comment.trim() || null
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { error } = await supabase.from('tasks').update(update).eq('id', id)
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
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
