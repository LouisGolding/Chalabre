import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTsBalance } from '@/lib/ts-balance'

// Solde de taxe de séjour en attente pour le compte connecté, réparti
// entre son propre solde ("Votre solde TS" — le sien, plus celui de tout
// séjour saisi ailleurs sous son nom, voir computeTsBalance) et un solde
// par accompagnant pour lequel ce compte a saisi un séjour ("TS -
// <prénom>") — demandé par Aurélie le 21 puis 22/09/2026. Utilisé pour
// rafraîchir instantanément les pastilles de l'onglet Planning dès qu'un
// séjour y est enregistré, supprimé ou réglé (voir ReserverSejour.tsx),
// sans recharger la page.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const balance = await computeTsBalance(supabase, user.id)
  return NextResponse.json(balance)
}
