import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Journal des pannes signalées depuis le "Guide de la maison" (rubrique
// "Urgences") : une ligne est créée quand un utilisateur sélectionne une
// zone en panne (POST), puis mise à jour quand il clique "Problème réglé"
// ou "Problème persistant" (PATCH). Objectif : qu'un admin puisse un jour
// être informé qu'un problème est en cours quelque part dans la maison —
// l'affichage côté admin n'existe pas encore (à construire plus tard),
// cette route ne fait que préparer l'enregistrement des données.
//
// Mode développement : tant que NODE_ENV !== 'production', cette route ne
// touche jamais Supabase — elle simule un identifiant pour que le widget
// réagisse normalement pendant les tests.
const isDev = process.env.NODE_ENV !== 'production'

const ALLOWED_CATEGORIES = ['electrique', 'eau']
const ALLOWED_STATUSES = ['in_progress', 'resolved', 'persistent']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { category, zoneId, zoneLabel } = await request.json()
  if (
    typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category) ||
    typeof zoneId !== 'string' || !zoneId ||
    typeof zoneLabel !== 'string' || !zoneLabel
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (isDev) {
    return NextResponse.json({ id: `dev-${crypto.randomUUID()}`, dev: true })
  }

  const { data, error } = await supabase
    .from('incident_reports')
    .insert({ category, zone_id: zoneId, zone_label: zoneLabel, reported_by: user.id })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id, status } = await request.json()
  if (typeof id !== 'string' || !id || typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  if (isDev || id.startsWith('dev-')) {
    return NextResponse.json({ ok: true, dev: true })
  }

  const { error } = await supabase
    .from('incident_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
