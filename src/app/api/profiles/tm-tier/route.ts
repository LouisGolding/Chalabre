import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Met à jour le montant de la cotisation mensuelle (tm_tier) d'un membre.
// Un admin peut modifier n'importe quel profil. Depuis la demande
// d'Aurélie (17/09/2026), un membre non-ami peut aussi modifier SA
// PROPRE cotisation (pastille éditable sur le tableau de bord) — un ami
// ('friend') ne le peut pas, cette pastille ne lui étant de toute façon
// jamais affichée.
//
// Ce verrou côté API n'est que la moitié de l'histoire : la base a son
// propre verrou (voir migration_auth_fix.sql — protect_profile_privileges),
// qui jusqu'ici annulait silencieusement tout changement de tm_tier par un
// non-admin, même sur sa propre ligne. migration_tm_self_edit.sql assouplit
// ce verrou pour l'auto-édition, mais n'est PAS encore appliquée en
// production : tant que Louis ne l'a pas validée et exécutée, cette route
// fonctionnera en local (mode dev, réponse simulée) mais l'écriture réelle
// en production sera silencieusement ignorée par la base pour un membre
// modifiant sa propre cotisation.
//
// Mode développement : comme pour /api/bookings/quick, tant que
// NODE_ENV !== 'production' rien n'est écrit dans Supabase — la réponse
// est simulée pour que l'interface réagisse normalement pendant les tests.
const isDev = process.env.NODE_ENV !== 'production'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { profileId, amount } = await request.json()

  if (!profileId || typeof profileId !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (amount !== null && (typeof amount !== 'number' || amount < 0)) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  if (isDev) {
    return NextResponse.json({ ok: true, dev: true })
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = caller?.role === 'admin'
  const isEditingOwnRow = user.id === profileId
  const canSelfEdit = isEditingOwnRow && caller?.role !== 'friend'

  if (!isAdmin && !canSelfEdit) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ tm_tier: amount })
    .eq('id', profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
