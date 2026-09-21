import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Total de taxe de séjour en attente pour le compte connecté (somme de
// tous les ts_payments "pending" liés à son user_id — y compris ceux des
// accompagnants qu'il a saisis, voir /api/bookings/quick). Utilisé pour
// rafraîchir instantanément la pastille "Solde taxe de séjour" de l'onglet
// Planning dès qu'un séjour y est enregistré ou supprimé (demandé par
// Aurélie le 21/09/2026 — voir ReserverSejour.tsx), sans recharger la page.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: tsPayments, error } = await supabase
    .from('ts_payments')
    .select('amount, status')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pending = (tsPayments ?? [])
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return NextResponse.json({ pending })
}
