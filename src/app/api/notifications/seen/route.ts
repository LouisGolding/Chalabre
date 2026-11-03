import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Marquage "vu" automatique (Entretien / Réalisations) -- voir
// TasksBoard.tsx / RealisationsBoard.tsx (appelé au montage, sur les
// éléments visibles créés par quelqu'un d'autre) et
// supabase/migration_item_seen.sql. Upsert idempotent : revoir une tâche
// déjà vue ne fait rien de plus (ignoreDuplicates), pas d'erreur non plus.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { item_type, item_ids } = await request.json()
  if ((item_type !== 'task' && item_type !== 'house_log') || !Array.isArray(item_ids) || item_ids.length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const rows = item_ids
    .filter((id): id is string => typeof id === 'string')
    .map((item_id) => ({ user_id: user.id, item_type, item_id }))
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { error } = await supabase.from('item_seen').upsert(rows, { ignoreDuplicates: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
