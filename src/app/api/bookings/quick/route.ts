import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fallbackHueForName, nearbyHue } from '@/lib/colors'
import { findClosestNameMatch } from '@/lib/fuzzy-name'

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

// Couleur persistée par personne (demandé par Nicolas le 19/09/2026) : dès
// qu'un accompagnant sans compte (ex. Otto) est saisi pour la première
// fois via guestName, on lui attribue une couleur, proche de celle de la
// personne qui saisit le séjour, et on la garde en mémoire (table
// guest_people) pour tous les séjours suivants — voir
// supabase/migration_guest_people.sql et src/lib/colors.ts. Si le nom
// saisi correspond en réalité à un compte existant (ex. un enfant inscrit
// dont un parent saisit les séjours), on ne crée rien : sa couleur de
// compte (profiles.color_hue) sera utilisée directement à la lecture.
// Correspondance tolérante aux fautes de frappe (accents/espaces/casse
// ignorés, et jusqu'à 1-3 lettres d'écart selon la longueur du nom — voir
// src/lib/fuzzy-name.ts, demandé par Nicolas le 23/09/2026 : "otot lalanne"
// doit être reconnu comme "Otto Lalande" plutôt que de créer un doublon).
// Renvoie la teinte (color_hue) résolue pour ce nom, pour que le client
// puisse afficher immédiatement la bonne couleur sur la ligne du planning
// dès l'enregistrement (demandé par Aurélie le 21/09/2026 — voir
// PlanningPageClient.tsx), sans attendre un rechargement de page.
interface GuestColorResult {
  hue: number | null
  // Nom "officiel" à enregistrer sur le séjour quand la saisie
  // correspondait (avec tolérance aux fautes de frappe, voir
  // src/lib/fuzzy-name.ts) à un compte ou à un accompagnant déjà connu —
  // pour que la ligne du planning reste groupée avec ses séjours
  // précédents même si cette fois le nom a été mal orthographié. Sinon
  // (première apparition de cette personne), null : on garde le nom tel
  // que saisi.
  canonicalName: string | null
}

async function ensureGuestColor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guestName: string,
  creatorId: string
): Promise<GuestColorResult> {
  const typed = guestName.trim()

  const { data: profiles } = await supabase.from('profiles').select('first_name, last_name, color_hue')
  const profileNames = (profiles ?? []).map((p) => `${p.first_name} ${p.last_name}`.trim())
  const profileMatchIndex = findClosestNameMatch(typed, profileNames)
  if (profileMatchIndex !== -1) {
    const matched = profiles![profileMatchIndex]
    return { hue: matched.color_hue ?? null, canonicalName: profileNames[profileMatchIndex] }
  }

  const { data: guests } = await supabase.from('guest_people').select('name, color_hue')
  const guestNames = (guests ?? []).map((g) => g.name)
  const guestMatchIndex = findClosestNameMatch(typed, guestNames)
  if (guestMatchIndex !== -1) {
    const matched = guests![guestMatchIndex]
    return { hue: matched.color_hue ?? null, canonicalName: matched.name }
  }

  const { data: creator } = await supabase
    .from('profiles')
    .select('color_hue, family_group')
    .eq('id', creatorId)
    .single()

  const anchorHue = creator?.color_hue ?? fallbackHueForName(typed)
  const hue = nearbyHue(anchorHue, typed.toLowerCase())

  const { error: insertError } = await supabase.from('guest_people').insert({
    name: typed,
    color_hue: hue,
    family_group: creator?.family_group ?? null,
    created_by: creatorId,
  })

  if (insertError) {
    // Doublon (contrainte unique guest_people_name_key) : quelqu'un d'autre
    // vient d'enregistrer exactement le même nom entre-temps (ex. deux
    // séjours saisis en même temps pour la même personne). On récupère
    // simplement la couleur déjà attribuée plutôt que de faire échouer tout
    // l'enregistrement du séjour.
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabase
        .from('guest_people')
        .select('name, color_hue')
        .ilike('name', typed)
        .maybeSingle()
      if (raceWinner) return { hue: raceWinner.color_hue ?? null, canonicalName: raceWinner.name }
    }
  }

  return { hue, canonicalName: null }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { checkIn, checkOut, amount, bookingId, guestName, houseSide, notes } = await request.json()

  if (!checkIn || !checkOut || typeof amount !== 'number' || amount < 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (houseSide !== 'canat' && houseSide !== 'lalande' && houseSide !== 'petite_maison') {
    return NextResponse.json(
      { error: 'Merci d’indiquer le côté de la maison (Canat, Lalande ou Petite maison)' },
      { status: 400 }
    )
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json(
      { error: 'La date de départ doit être après la date d’arrivée' },
      { status: 400 }
    )
  }

  const normalizedGuestName: string | null =
    typeof guestName === 'string' && guestName.trim() ? guestName.trim() : null

  // Note libre (ex. "Gare de Pamiers 14h45", demandé par Nicolas le
  // 23/09/2026, pour coordonner les arrivées) — réutilise la colonne
  // `notes` déjà présente sur `bookings` depuis schema.sql, jamais
  // exploitée jusqu'ici. Purement informatif pour l'instant, pas encore
  // affiché ailleurs que dans ce widget.
  const normalizedNotes: string | null = typeof notes === 'string' && notes.trim() ? notes.trim() : null

  // Teinte résolue pour l'affichage instantané côté client (voir
  // ensureGuestColor ci-dessus) : celle de l'accompagnant s'il en saisit
  // un, sinon celle du titulaire du compte lui-même.
  // Nom réellement enregistré pour ce séjour : celui saisi, sauf s'il a
  // été rapproché (tolérance aux fautes de frappe) d'un compte ou d'un
  // accompagnant déjà connu — voir ensureGuestColor.
  let resolvedGuestName = normalizedGuestName
  let colorHue: number | null = null
  if (normalizedGuestName) {
    const result = await ensureGuestColor(supabase, normalizedGuestName, user.id)
    colorHue = result.hue
    if (result.canonicalName) resolvedGuestName = result.canonicalName
  } else {
    const { data: ownProfile } = await supabase.from('profiles').select('color_hue').eq('id', user.id).single()
    colorHue = ownProfile?.color_hue ?? null
  }

  let targetBookingId: string

  if (bookingId) {
    // Un séjour est modifiable par son titulaire, ou par un admin pour le
    // compte de quelqu'un d'autre (demandé par Nicolas le 21/09/2026, pour
    // l'édition depuis la barre colorée du planning — voir PlanningView.tsx
    // et BookingEditModal.tsx) — même règle que la RLS bookings_update
    // (user_id = auth.uid() or role admin), vérifiée ici en plus pour
    // renvoyer une erreur claire plutôt qu'une mise à jour silencieusement
    // ignorée à 0 ligne.
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id')
      .eq('id', bookingId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (caller?.role !== 'admin') {
        return NextResponse.json({ error: 'Non autorisé à modifier ce séjour' }, { status: 403 })
      }
    }

    // Aucune accumulation possible : on écrase simplement les dates de la
    // même ligne (pas de nouvelle ligne créée), et le total de TS ci-dessous
    // est toujours recalculé en intégralité pour les nouvelles dates — rien
    // n'est jamais ajouté à ce qui existait pour les anciennes dates (voir
    // remarque de Nicolas du 21/09/2026 : modifier un séjour du 10-20 vers
    // le 15-24 ne doit pas comptabiliser 2 taxes de séjour sur le 15-20).
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ check_in: checkIn, check_out: checkOut, guest_name: resolvedGuestName, house_side: houseSide, notes: normalizedNotes })
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
        guest_name: resolvedGuestName,
        house_side: houseSide,
        notes: normalizedNotes,
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
    colorHue,
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

  // Même règle que pour la mise à jour ci-dessus (POST) : le titulaire du
  // séjour, ou un admin.
  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('id, user_id, ts_payments(status)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 })
  }

  if (existing.user_id !== user.id) {
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé à supprimer ce séjour' }, { status: 403 })
    }
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
