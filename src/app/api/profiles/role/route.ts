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
//
// Mode développement : comme les autres routes admin, rien n'est écrit
// dans Supabase tant que NODE_ENV !== 'production'.
const isDev = process.env.NODE_ENV !== 'production'

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

  if (isDev) {
    return NextResponse.json({ ok: true, role: makeAdmin ? 'admin' : 'family', dev: true })
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
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
