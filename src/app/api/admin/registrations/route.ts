import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Validation manuelle des inscriptions (27/10/2026, demande d'Aurélie).
// Bascule profiles.status entre 'pending'/'rejected' et 'active' --
// même pattern que /api/profiles/role (vérification du rôle de
// l'appelant côté serveur, jamais fait confiance au client).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { profileId, decision } = await request.json()

  if (
    !profileId ||
    typeof profileId !== 'string' ||
    (decision !== 'approve' && decision !== 'reject')
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const newStatus = decision === 'approve' ? 'active' : 'rejected'

  const { error } = await supabase
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
