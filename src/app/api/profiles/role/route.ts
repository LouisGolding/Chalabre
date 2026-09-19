import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Bascule le rôle admin d'un membre ("Autorisations" dans l'onglet Membres,
// réservé aux admins) — un peu comme la case admin d'un groupe WhatsApp.
// makeAdmin=true → role='admin'. makeAdmin=false → on rend au membre son
// rôle "naturel" déduit de son family_group (family, ou friend s'il est
// invité), exactement la même logique que protect_profile_privileges()
// applique déjà côté base pour un membre ordinaire.
//
// Aucune nouvelle migration nécessaire ici : un admin peut déjà, dans le
// trigger existant (migration_auth_fix.sql), modifier le rôle de
// n'importe quel profil — y compris le sien — sans restriction.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { profileId, makeAdmin } = await request.json()

  if (!profileId || typeof profileId !== 'string' || typeof makeAdmin !== 'boolean') {
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

  // Garde-fou (audit 19/09/2026) : le dernier admin ne peut pas se retirer
  // lui-même le rôle — sinon plus personne ne peut administrer le site, et
  // il faut repasser par l'éditeur SQL de Supabase pour s'en sortir.
  if (!makeAdmin && profileId === user.id) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Impossible : vous êtes le dernier administrateur.' },
        { status: 400 }
      )
    }
  }

  let newRole: 'admin' | 'family' | 'friend' = 'admin'

  if (!makeAdmin) {
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('family_group')
      .eq('id', profileId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    newRole = target.family_group === 'friend' ? 'friend' : 'family'
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role: newRole })
}
