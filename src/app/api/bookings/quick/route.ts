import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fallbackHueForName, nearbyHue } from '@/lib/colors'

// Crée ou met à jour un séjour saisi depuis le widget "Prochain séjour" de
// la page d'accueil (celui du titulaire du compte, ou un séjour ajouté pour
// un accompagnant via guestName). Gère aussi le recalcul du solde de taxe
// de séjour (TS) si les dates changent après un premier paiement : le
// paiement déjà réglé n'est jamais modifié (traçabilité), un second
// paiement "en attente" est créé/ajusté pour représenter le solde restant.
// Si le solde est négatif (trop perçu), aucun paiement n'est créé — seul
// l'affichage côté client le montre.
//
// houseSide ('canat' | 'lalande', demandé par Aurélie le 18/09/2026) :
// indique de quel côté de la maison la personne dort, pour savoir sur
// quel compte bancaire (Canat ou Lalande) verser la taxe de séjour de ce
// séjour. Obligatoire pour enregistrer un séjour (voir migration
// supabase/migration_bookings_house_side.sql, à appliquer par Louis).
//
// Mode développement : tant que NODE_ENV !== 'production' (donc en local,
// via `npm run dev`), cette route ne touche jamais Supabase. Elle simule la
// réponse attendue (même forme que la vraie) uniquement pour que l'interface
// réagisse normalement pendant les tests, sans enregistrer la moindre
// donnée dans la base partagée. En production (Vercel), le comportement
// réel ci-dessous s'applique sans changement.

// Couleur persistée par personne (demandé par Nicolas le 19/09/2026) : dès
// qu'un accompagnant sans compte (ex. Otto) est saisi pour la première
// fois via guestName, on lui attribue une couleur, proche de celle de la
// personne qui saisit le séjour, et on la garde en mémoire (table
// guest_people) pour tous les séjours suivants — voir
// supabase/migration_guest_people.sql et src/lib/colors.ts. Si le nom
// saisi correspond en réalité à un compte existant (ex. un enfant inscrit
// dont un parent saisit les séjours), on ne crée rien : sa couleur de
// compte (profiles.color_hue) sera utilisée directement à la lecture.
// Correspondance par nom complet exact (insensible à la casse/espaces) :
// Nicolas a confirmé que le nom et prénom complets sont toujours saisis,
// donc pas de risque réel d'homonymie à gérer.
async function ensureGuestColor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guestName: string,
  creatorId: string
) {
  const normalized = guestName.trim().toLowerCase()

  const { data: profiles } = await supabase.from('profiles').select('first_name, last_name')
  const matchesExistingAccount = (profiles ?? []).some(
    (p) => `${p.first_name} ${p.last_name}`.trim().toLowerCase() === normalized
  )
  if (matchesExistingAccount) return

  const { data: existingGuest } = await supabase
    .from('guest_people')
    .select('id')
    .ilike('name', guestName.trim())
    .maybeSingle()
  if (existingGuest) return

  const { data: creator } = await supabase
    .from('profiles')
    .select('color_hue, family_group')
    .eq('id', creatorId)
    .single()

  const anchorHue = creator?.color_hue ?? fallbackHueForName(guestName)
  const hue = nearbyHue(anchorHue, normalized)

  await supabase.from('guest_people').insert({
    name: guestName.trim(),
    color_hue: hue,
    family_group: creator?.family_group ?? null,
    created_by: creatorId,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { checkIn, checkOut, amount, bookingId, guestName, houseSide } = await request.json()

  if (!checkIn || !checkOut || typeof amount !== 'number' || amount < 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (houseSide !== 'canat' && houseSide !== 'lalande') {
    return NextResponse.json({ error: 'Merci d’indiquer le côté de la maison (Canat ou Lalande)' }, { status: 400 })
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json(
      { error: 'La date de départ doit être après la date d’arrivée' },
      { status: 400 }
    )
  }

  const normalizedGuestName: string | null =
    typeof guestName === 'string' && guestName.trim() ? guestName.trim() : null

  if (normalizedGuestName) {
    await ensureGuestColor(supabase, normalizedGuestName, user.id)
  }

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
      .update({ check_in: checkIn, check_out: checkOut, guest_name: normalizedGuestName, house_side: houseSide })
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
        house_side: houseSide,
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
