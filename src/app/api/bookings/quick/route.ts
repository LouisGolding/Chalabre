import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Crée ou met à jour un séjour saisi depuis le widget "Prochain séjour" de
// la page d'accueil (celui du titulaire du compte, ou un séjour ajouté pour
// un accompagnant via guestName). Gère aussi le recalcul du solde de taxe
// de séjour (TS) si les dates changent après un premier paiement : le
// paiement déjà réglé n'est jamais modifié (traçabilité), un second
// paiement "en attente" est créé/ajusté pour représenter le solde restant.
// Si le solde est négatif (trop perçu), aucun paiement n'est créé — seul
// l'affichage côté client le montre.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { checkIn, checkOut, amount, bookingId, guestName } = await request.json()

  if (!checkIn || !checkOut || typeof amount !== 'number' || amount < 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json(
      { error: 'La date de départ doit être après la date d’arrivée' },
      { status: 400 }
    )
  }

  const normalizedGuestName: string | null =
    typeof guestName === 'string' && guestName.trim() ? guestName.trim() : null

  let targetBookingId: string

  if (bookingId) {
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ check_in: checkIn, check_out: checkOut, guest_name: normalizedGuestName })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    targetBookingId = bookingId
  } else {
    const { data: created, error: insertError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        check_in: checkIn,
        check_out: checkOut,
        guest_name: normalizedGuestName,
      })
      .select()
      .single()

    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message ?? 'Erreur' }, { status: 500 })
    }

    targetBookingId = created.id
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('ts_payments')
    .select('*')
    .eq('booking_id', targetBookingId)

  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  }

  const paidAmount = (payments ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const pendingRow = (payments ?? []).find((p) => p.status === 'pending') ?? null
  const due = Math.round((amount - paidAmount) * 100) / 100

  let pendingPayment = pendingRow

  if (due > 0) {
    if (pendingRow) {
      const { data: updated, error: updateError } = await supabase
        .from('ts_payments')
        .update({ amount: due })
        .eq('id', pendingRow.id)
        .select()
        .single()
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      pendingPayment = updated
    } else {
      const { data: created, error: insertError } = await supabase
        .from('ts_payments')
        .insert({ booking_id: targetBookingId, user_id: user.id, amount: due, status: 'pending' })
        .select()
        .single()
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      pendingPayment = created
    }
  } else if (pendingRow) {
    // Rien (ou plus rien) à régler : on retire le paiement en attente devenu obsolète.
    await supabase.from('ts_payments').delete().eq('id', pendingRow.id)
    pendingPayment = null
  }

  return NextResponse.json({
    bookingId: targetBookingId,
    paidAmount,
    pendingPayment,
  })
}

// Retire un séjour saisi depuis le widget (utilisé pour annuler une entrée
// "+" ajoutée par erreur). Refusé si un paiement a déjà été réglé dessus,
// pour ne jamais perdre une trace de paiement.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('id')

  if (!bookingId) {
    return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('id, ts_payments(status)')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 })
  }

  const hasPaidPayment = (existing.ts_payments ?? []).some(
    (p: { status: string }) => p.status === 'paid'
  )
  if (hasPaidPayment) {
    return NextResponse.json(
      { error: 'Ce séjour a déjà un paiement réglé, il ne peut pas être supprimé.' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await supabase.from('bookings').delete().eq('id', bookingId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
