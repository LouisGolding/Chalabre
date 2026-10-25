import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ajoute une tâche, ou met à jour son statut fait/à faire (et, depuis le
// 25/10/2026, ses autres champs -- voir plus bas). La suppression reste
// réservée aux admins côté base (voir schema.sql, policy "tasks_admin")
// — tout le monde peut lire la liste. Le PATCH "coche" (`completed`)
// n'a volontairement pas de vérification de rôle ici : c'était déjà le
// cas avant la refonte du 27/09/2026, et le "reset" automatique des
// tâches jardin récurrentes (TasksBoard.tsx) doit pouvoir tourner depuis
// n'importe quel compte connecté qui ouvre la page.
//
// Ajout/édition ouverts aux comptes famille depuis le 25/10/2026
// (demande d'Aurélie : "il faut que le widget 'entretien et
// reparations' soit accessible aussi aux comptes famille. il faut que
// dans la liste des taches, chacun puisse editer/corriger la ligne
// qu'il a rentré. Et il faut que les admins, puisse corriger chaque
// ligne si ils le souhaitent"). Voir migration_tasks_family_access.sql
// (⚠️ pas encore appliquée, voir son en-tête) pour les policies RLS
// correspondantes : POST s'appuie entièrement dessus (aucune
// vérification de rôle ici, comme avant) ; PATCH vérifie en plus
// explicitement l'auteur/l'admin pour l'édition des champs (pas pour la
// coche, voir ci-dessus) afin de renvoyer un message clair plutôt qu'un
// échec RLS générique.
//
// Le champ `comment` (une seule note, proposée à la coche) a été
// retiré de ce PATCH le 19/10/2026 (demandé par Aurélie) : remplacé par
// plusieurs notes datées dans la table `task_notes`, voir
// /api/tasks/notes/route.ts et migration_task_notes_contacts.sql.
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

  const { id, completed, title, category, priority, period, recurrence } = await request.json()
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

  // Édition en place des champs d'une tâche existante (25/10/2026, voir
  // le commentaire en tête de fichier) -- distinct de la coche
  // ci-dessus, qui reste ouverte à tous sans vérification de rôle.
  const editingFields =
    title !== undefined ||
    category !== undefined ||
    priority !== undefined ||
    period !== undefined ||
    recurrence !== undefined
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
    }
    update.title = title.trim()
  }
  if (typeof category === 'string') update.category = category
  if (typeof priority === 'string') update.priority = priority
  if (period !== undefined) update.period = period
  if (recurrence !== undefined) update.recurrence = recurrence

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (editingFields) {
    // Réservé à l'auteur de la tâche ou à un admin (demande d'Aurélie du
    // 25/10/2026) -- vérifié explicitement ici en plus de la RLS (qui
    // refuserait de toute façon l'écriture, voir
    // migration_tasks_family_access.sql), pour un message d'erreur
    // clair plutôt qu'un échec RLS générique.
    const { data: existingTask } = await supabase.from('tasks').select('created_by').eq('id', id).single()
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isOwner = existingTask?.created_by === user.id
    const isAdmin = caller?.role === 'admin'
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que les tâches que vous avez créées' },
        { status: 403 }
      )
    }
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
