import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LOCAL_EVENT_CATEGORY_IDS } from '@/lib/local-event-categories'

// Onglet "Activités" (événements locaux à Chalabre et alentours) :
// réservé aux comptes admin dans son intégralité (page + actions —
// src/app/dashboard/activites/page.tsx redirige tout non-admin), à la
// différence de "Réalisations"/"Documents" qui restent lisibles par
// family/friend. La RLS (migration_local_events.sql) applique déjà la
// même restriction admin-only en lecture/écriture ; les contrôles
// ci-dessous ne font que renvoyer un message clair plutôt qu'un échec
// RLS silencieux.

type LocalEventFields = {
  title?: string
  event_date?: string
  event_end_date?: string | null
  event_time?: string | null
  location?: string | null
  category?: string
  source_text?: string | null
}

function sanitize(fields: LocalEventFields) {
  const out: LocalEventFields = {}
  if (typeof fields.title === 'string') out.title = fields.title.trim()
  if (typeof fields.event_date === 'string') out.event_date = fields.event_date
  if (fields.event_end_date === null || typeof fields.event_end_date === 'string') {
    out.event_end_date = fields.event_end_date?.trim() || null
  }
  if (fields.event_time === null || typeof fields.event_time === 'string') {
    out.event_time = fields.event_time?.trim() || null
  }
  if (fields.location === null || typeof fields.location === 'string') {
    out.location = fields.location?.trim() || null
  }
  if (typeof fields.category === 'string') out.category = fields.category
  if (fields.source_text === null || typeof fields.source_text === 'string') {
    out.source_text = fields.source_text?.trim() || null
  }
  return out
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return caller?.role === 'admin'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const body = await request.json()
  const fields = sanitize(body)
  if (!fields.title) {
    return NextResponse.json({ error: 'Le titre est obligatoire' }, { status: 400 })
  }
  if (!fields.event_date) {
    return NextResponse.json({ error: 'La date est obligatoire' }, { status: 400 })
  }
  const category = fields.category ?? 'autre'
  if (!LOCAL_EVENT_CATEGORY_IDS.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('local_events')
    .insert({
      title: fields.title,
      event_date: fields.event_date,
      event_end_date: fields.event_end_date ?? null,
      event_time: fields.event_time ?? null,
      location: fields.location ?? null,
      category,
      source_text: fields.source_text ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ event: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { id, ...rest } = await request.json()
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }
  const fields = sanitize(rest)
  if (fields.category && !LOCAL_EVENT_CATEGORY_IDS.includes(fields.category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('local_events')
    .update({ ...fields, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }

  const { error } = await supabase.from('local_events').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
