import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Suivi partagé des bouteilles de gaz de la maison (pastille du Guide de
// la maison, widget "Organisation") — une seule valeur pour toute la
// maison, modifiable par tout compte famille ou admin (jamais les amis),
// demandé par Aurélie le 22/09/2026. Voir migration_gas_bottles.sql.

async function requireFamilyOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return caller?.role === 'admin' || caller?.role === 'family'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data } = await supabase
    .from('gas_bottles_status')
    .select('id, count, last_refill_date')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ status: data ?? null })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if (!(await requireFamilyOrAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux comptes famille et admin' }, { status: 403 })
  }

  const { count, lastRefillDate } = await request.json()
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return NextResponse.json({ error: 'Nombre de bouteilles invalide' }, { status: 400 })
  }
  if (lastRefillDate !== null && typeof lastRefillDate !== 'string') {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('gas_bottles_status')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    count: Math.round(count),
    last_refill_date: lastRefillDate || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = existing
    ? await supabase.from('gas_bottles_status').update(payload).eq('id', existing.id)
    : await supabase.from('gas_bottles_status').insert(payload)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
