import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Onglet "Réalisations" : fil façon blog où les membres de la famille
// (admin + family, jamais les amis — RLS house_log_select) postent ce
// qu'ils ont entrepris dans la maison pendant leur séjour (tonte,
// réparation, réfection d'une pièce...), pour informer les autres
// occupants de ce qui a été fait en leur absence.
//
// Un post reste éditable/supprimable par son auteur ; les posts des
// autres ne le sont que par un admin (RLS house_log_update_own_or_admin /
// house_log_delete_own_or_admin — voir migration_house_log_realisations.sql,
// pas encore appliquée en base, cf. points-a-regler-avec-louis.md).

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!caller || !['admin', 'family'].includes(caller.role)) {
    return NextResponse.json({ error: 'Réservé aux membres de la famille' }, { status: 403 })
  }

  const { content } = await request.json()
  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Le contenu du post est vide' }, { status: 400 })
  }

  const { data: entry, error } = await supabase
    .from('house_log')
    .insert({ content: content.trim(), created_by: user.id })
    .select('*, profile:profiles(first_name, last_name, family_group)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ entry })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id, content } = await request.json()
  if (typeof id !== 'string' || !id || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // La RLS (house_log_update_own_or_admin) refuse déjà la mise à jour si ce
  // n'est ni l'auteur ni un admin ; le count permet de renvoyer un message
  // clair côté client plutôt qu'un succès silencieux à 0 ligne modifiée.
  const { data, error } = await supabase
    .from('house_log')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Modification non autorisée' }, { status: 403 })
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

  // On retire d'abord les fichiers du bucket "house-log" (best effort),
  // avant de supprimer la ligne — la suppression en base entraîne de toute
  // façon la suppression en cascade des lignes house_log_photos.
  const { data: photos } = await supabase.from('house_log_photos').select('storage_path').eq('house_log_id', id)
  if (photos && photos.length > 0) {
    try {
      await supabase.storage.from('house-log').remove(photos.map((p) => p.storage_path))
    } catch {
      // silencieux — nettoyage best effort
    }
  }

  const { data, error } = await supabase.from('house_log').delete().eq('id', id).select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Suppression non autorisée' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
