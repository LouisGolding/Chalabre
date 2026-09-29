import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Statut "Utilisable" / "Ne pas utiliser" des cheminées (Guide de la
// maison, widget "Cheminées") — une ligne par pièce (room_key stable,
// voir FireplacesTable.tsx), éditable par les comptes admin uniquement,
// fixe pour tous les autres — demandé par Nicolas le 29/09/2026. Voir
// migration_fireplace_status.sql.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data } = await supabase.from('fireplace_status').select('room_key, status')

  const statuses: Record<string, 'usable' | 'not_usable' | null> = {}
  for (const row of data ?? []) {
    statuses[row.room_key] = row.status as 'usable' | 'not_usable' | null
  }
  return NextResponse.json({ statuses })
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

  const { roomKey, status } = await request.json()
  if (typeof roomKey !== 'string' || !roomKey) {
    return NextResponse.json({ error: 'Pièce invalide' }, { status: 400 })
  }
  if (status !== null && status !== 'usable' && status !== 'not_usable') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('fireplace_status').upsert(
    {
      room_key: roomKey,
      status,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_key' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
