import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONTACT_CATEGORY_IDS } from '@/lib/contact-categories'

// Ajout / modification / suppression de contacts (onglet "Contacts").
// Réservé aux admins côté base (policy "contacts_admin") — tout le monde
// peut lire et trier la liste, seul un admin peut l'éditer.
//
// Mode développement : tant que NODE_ENV !== 'production', ces routes ne
// touchent jamais Supabase — elles simulent la réponse attendue pour que
// l'interface réagisse normalement pendant les tests.
const isDev = process.env.NODE_ENV !== 'production'

type ContactFields = {
  name?: string
  role?: string
  category?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

function sanitize(fields: ContactFields) {
  const out: ContactFields = {}
  if (typeof fields.name === 'string') out.name = fields.name.trim()
  if (typeof fields.role === 'string') out.role = fields.role.trim()
  if (typeof fields.category === 'string') out.category = fields.category
  if (fields.phone === null || typeof fields.phone === 'string') out.phone = fields.phone?.trim() || null
  if (fields.email === null || typeof fields.email === 'string') out.email = fields.email?.trim() || null
  if (fields.address === null || typeof fields.address === 'string') out.address = fields.address?.trim() || null
  if (fields.notes === null || typeof fields.notes === 'string') out.notes = fields.notes?.trim() || null
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

  const body = await request.json()
  const fields = sanitize(body)
  const category = fields.category ?? ''
  if (!CONTACT_CATEGORY_IDS.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  if (isDev) {
    return NextResponse.json({
      contact: {
        id: `dev-${crypto.randomUUID()}`,
        name: fields.name ?? '',
        role: fields.role ?? '',
        category,
        phone: fields.phone ?? null,
        email: fields.email ?? null,
        address: fields.address ?? null,
        notes: fields.notes ?? null,
        created_at: new Date().toISOString(),
      },
      dev: true,
    })
  }

  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: fields.name ?? '',
      role: fields.role ?? '',
      category,
      phone: fields.phone ?? null,
      email: fields.email ?? null,
      address: fields.address ?? null,
      notes: fields.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ contact: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id, ...rest } = await request.json()
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }
  const fields = sanitize(rest)
  if (fields.category && !CONTACT_CATEGORY_IDS.includes(fields.category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  if (isDev || id.startsWith('dev-')) {
    return NextResponse.json({ ok: true, dev: true })
  }

  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { error } = await supabase.from('contacts').update(fields).eq('id', id)
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

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Paramètre "id" manquant' }, { status: 400 })
  }

  if (isDev || id.startsWith('dev-')) {
    return NextResponse.json({ ok: true, dev: true })
  }

  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
