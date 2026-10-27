import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Compteur de vues des tutoriels vidéo (page statique /bienvenue, voir
// public/bienvenue/index.html) -- demandé par Aurélie le 27/10/2026. Pas
// de vérification d'utilisateur ici (contrairement aux autres routes de
// ce dossier) : /bienvenue est volontairement accessible SANS compte
// (envoyée à la famille avant inscription, voir PUBLIC_PREFIXES dans
// src/lib/supabase/proxy.ts), donc pas de session à exiger -- exclue du
// middleware comme tout /api (voir src/proxy.ts). Après discussion,
// Aurélie a choisi de ne pas identifier qui regarde : juste compter,
// d'où l'absence de reported_by/user_id ici (voir migration
// supabase/migration_bienvenue_views.sql).

const ALLOWED_CHAPTERS = [
  'premiers-pas', 'reserver', 'accompagnant', 'calendrier', 'guide',
  'urgences', 'contacts', 'realisations', 'entretien', 'budget',
]
const ALLOWED_EVENTS = ['start', 'end']

export async function POST(request: Request) {
  const { chapterId, event } = await request.json().catch(() => ({}))
  if (
    typeof chapterId !== 'string' || !ALLOWED_CHAPTERS.includes(chapterId) ||
    typeof event !== 'string' || !ALLOWED_EVENTS.includes(event)
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('bienvenue_views').insert({ chapter_id: chapterId, event })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
