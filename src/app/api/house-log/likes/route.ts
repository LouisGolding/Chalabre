import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// "J'aime" sur un post de "Réalisations" (19/10/2026, demandé par
// Aurélie) -- un j'aime = une ligne dans house_log_likes, contrainte
// unique (house_log_id, user_id) côté base
// (migration_house_log_reactions.sql, pas encore appliquée). POST ajoute
// son propre j'aime (conflit unique ignoré plutôt que remonté en
// erreur, au cas où deux clics partent avant que l'état local ne se
// mette à jour) ; DELETE retire le sien. Pas de bascule côté serveur :
// le client (RealisationsBoard.tsx) sait déjà s'il a déjà liké ou non
// et appelle la bonne méthode.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { house_log_id: houseLogId } = await request.json()
  if (typeof houseLogId !== 'string' || !houseLogId) {
    return NextResponse.json({ error: 'Paramètre "house_log_id" manquant' }, { status: 400 })
  }

  const { error } = await supabase
    .from('house_log_likes')
    .upsert(
      { house_log_id: houseLogId, user_id: user.id },
      { onConflict: 'house_log_id,user_id', ignoreDuplicates: true }
    )

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
  const houseLogId = searchParams.get('house_log_id')
  if (!houseLogId) {
    return NextResponse.json({ error: 'Paramètre "house_log_id" manquant' }, { status: 400 })
  }

  // RLS (house_log_likes_delete) autoriserait aussi un admin à retirer
  // le j'aime de quelqu'un d'autre, mais ce bouton ne propose jamais
  // cette action -- la requête ci-dessous reste bornée à son propre
  // j'aime.
  const { error } = await supabase
    .from('house_log_likes')
    .delete()
    .eq('house_log_id', houseLogId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
