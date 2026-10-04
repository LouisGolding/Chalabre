import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storageSlotKey, type StorageFloorId } from '@/lib/storage-guide'

// Emplacements de rangement (Guide de la maison, widgets "Organisation
// des placards" et "Rangement indications") -- une ligne par emplacement
// deja renseigne par un admin. Lecture ouverte a tous les comptes
// connectes (la recherche du widget "Organisation des placards" est
// ouverte a tout le monde, y compris les amis -- demande par Nicolas le
// 04/10/2026) ; ecriture reservee aux comptes admin, comme pour
// fireplace_status. Voir migration_storage_slots.sql.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('storage_slots')
    .select('slot_key, floor, slot_number, house_side, content')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ slots: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux comptes admin' }, { status: 403 })
  }

  const { floor, slotNumber, houseSide, content } = await request.json()

  const validFloors: StorageFloorId[] = ['rdc', '1er', '2e', '3e']
  if (typeof floor !== 'string' || !validFloors.includes(floor as StorageFloorId)) {
    return NextResponse.json({ error: 'Étage invalide' }, { status: 400 })
  }
  const validatedFloor = floor as StorageFloorId
  if (typeof slotNumber !== 'number' || slotNumber < 1 || slotNumber > 12) {
    return NextResponse.json({ error: 'Emplacement invalide' }, { status: 400 })
  }
  if (houseSide !== null && houseSide !== 'canat' && houseSide !== 'lalande') {
    return NextResponse.json({ error: 'Côté de la maison invalide' }, { status: 400 })
  }
  if (typeof content !== 'string' && content !== null) {
    return NextResponse.json({ error: 'Contenu invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('storage_slots').upsert(
    {
      slot_key: storageSlotKey(validatedFloor, slotNumber),
      floor: validatedFloor,
      slot_number: slotNumber,
      house_side: houseSide,
      content: content || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
