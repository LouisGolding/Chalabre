import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Commentaires sur un post de "Réalisations" (19/10/2026, demandé par
// Aurélie, "à la manière d'Instagram") -- texte libre, pas d'édition,
// suppression par l'auteur ou un admin (même règle que les posts et
// leurs photos, voir house_log_comments_delete dans
// migration_house_log_reactions.sql, pas encore appliquée).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { house_log_id: houseLogId, content } = await request.json()
  if (typeof houseLogId !== 'string' || !houseLogId) {
    return NextResponse.json({ error: 'Paramètre "house_log_id" manquant' }, { status: 400 })
  }
  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Commentaire vide' }, { status: 400 })
  }

  const { data: comment, error } = await supabase
    .from('house_log_comments')
    .insert({ house_log_id: houseLogId, user_id: user.id, content: content.trim() })
    .select('*, profile:profiles(first_name, last_name)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ comment })
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

  // La RLS (house_log_comments_delete) refuse déjà si ce n'est ni
  // l'auteur du commentaire ni un admin ; le count permet de renvoyer un
  // message clair plutôt qu'un succès silencieux à 0 ligne supprimée,
  // même convention que DELETE /api/house-log.
  const { data, error } = await supabase.from('house_log_comments').delete().eq('id', id).select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Suppression non autorisée' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
