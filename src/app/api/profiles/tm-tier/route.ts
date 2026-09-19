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
// propre verrou (protect_profile_privileges, version de
// migration_tm_self_edit.sql — validée par Louis et appliquée en
// production le 19/09/2026), qui autorise un membre non-ami à modifier
// SA PROPRE ligne, et un admin à tout faire. Même si cette route était
// contournée, la base ferait donc respecter la même règle.

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

  // Entier requis : la colonne tm_tier est un integer, un décimal serait
  // rejeté par Postgres avec une erreur peu lisible. Borne haute large,
  // simple garde-fou contre les fautes de frappe (ex. un zéro de trop).
  if (amount !== null && (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 10000)) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
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
