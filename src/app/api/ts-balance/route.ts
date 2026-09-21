import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Solde de taxe de séjour en attente pour le compte connecté, réparti
// entre son propre séjour ("Votre solde TS") et, le cas échéant, chacun
// des accompagnants pour lesquels il a saisi un séjour ("TS - <prénom>") —
// demandé par Aurélie le 21/09/2026 : jusqu'ici tout était mélangé dans un
// seul total ("Solde taxe de séjour"), ce qui ne permettait pas de voir ce
// qui restait dû pour soi-même par rapport à un accompagnant (ex. Otto).
// Utilisé pour rafraîchir instantanément les pastilles de l'onglet
// Planning dès qu'un séjour y est enregistré ou supprimé (voir
// ReserverSejour.tsx), sans recharger la page.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('guest_name, ts_payments(amount, status)')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let own = 0
  const guestAmounts = new Map<string, number>()
  const guestOrder: string[] = []

  for (const booking of bookings ?? []) {
    const pending = (booking.ts_payments ?? [])
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const guestName = booking.guest_name?.trim()
    if (!guestName) {
      own += pending
      continue
    }
    if (!guestAmounts.has(guestName)) {
      guestAmounts.set(guestName, 0)
      guestOrder.push(guestName)
    }
    guestAmounts.set(guestName, guestAmounts.get(guestName)! + pending)
  }

  const guests = guestOrder.map((name) => ({ name, pending: guestAmounts.get(name)! }))

  // "pending" conservé pour compatibilité (total tous séjours confondus,
  // ancien comportement de cette pastille avant sa scission).
  return NextResponse.json({ pending: own + guests.reduce((s, g) => s + g.pending, 0), own, guests })
}
