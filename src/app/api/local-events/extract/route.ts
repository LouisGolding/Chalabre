import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { LOCAL_EVENT_CATEGORY_IDS } from '@/lib/local-event-categories'

// Onglet "Activités" -- étape "coller en vrac puis laisser l'IA extraire"
// (voir claude/prompt-onglet-evenements.md). Nicolas colle le texte brut
// d'une affiche/d'un programme/d'un bulletin municipal, cette route
// appelle l'API Anthropic pour en sortir une liste structurée d'événements,
// renvoyée à l'aperçu éditable côté client -- RIEN n'est encore enregistré
// en base ici, l'admin relit/corrige puis enregistre chaque événement via
// POST /api/local-events.
//
// Nécessite la variable d'environnement ANTHROPIC_API_KEY (clé du Claude
// Developer Platform, platform.claude.com -- voir l'échange du 08/10/2026
// dans points-a-regler-avec-louis.md). Pas encore configurée au moment où
// cette route est écrite : Nicolas regarde le sujet de son côté. En son
// absence, la route renvoie une erreur claire plutôt que de planter.
//
// Modèle choisi : claude-haiku-5-5, le plus rapide/économique de la gamme,
// adapté par Anthropic lui-même aux tâches de classification/extraction --
// largement suffisant ici et nettement moins coûteux qu'un modèle plus
// capable pour ce usage ponctuel.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { text } = await request.json()
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Texte vide' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée (ANTHROPIC_API_KEY manquante côté serveur)." },
      { status: 500 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const categoryList = LOCAL_EVENT_CATEGORY_IDS.join(', ')

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4096,
      system:
        `Tu extrais une liste d'événements locaux à partir d'un texte brut ` +
        `(affiche, programme, bulletin municipal...) pour la commune de ` +
        `Chalabre (Aude, France) et ses environs. Réponds UNIQUEMENT avec un ` +
        `tableau JSON (aucun texte autour, aucun bloc de code), où chaque ` +
        `élément a la forme : ` +
        `{"title": string, "event_date": "YYYY-MM-DD", "event_end_date": "YYYY-MM-DD" | null, ` +
        `"event_time": string | null, "location": string | null, "category": string}. ` +
        `"category" doit être l'une de : ${categoryList} (choisis "autre" si aucune ne convient). ` +
        `"event_time" reprend la formulation la plus proche du texte source ` +
        `("en soirée", "à partir de 10h"...) plutôt que de deviner un horaire ` +
        `précis absent du texte. Résous les dates relatives ("ce samedi", ` +
        `"vendredi prochain"...) par rapport à la date du jour : ${today} ` +
        `(fuseau Europe/Paris). Si une information est absente du texte, mets ` +
        `null plutôt que d'inventer. Si le texte ne contient aucun événement ` +
        `identifiable, réponds [].`,
      messages: [{ role: 'user', content: text }],
    })
    const block = response.content[0]
    raw = block?.type === 'text' ? block.text : ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: `Erreur lors de l'appel à l'API Anthropic : ${message}` }, { status: 502 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: "Réponse de l'IA illisible (pas un JSON valide) -- réessaie, ou corrige le texte collé." },
      { status: 502 }
    )
  }
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: "Réponse de l'IA inattendue (pas une liste)." }, { status: 502 })
  }

  type ExtractedEvent = {
    title: string
    event_date: string
    event_end_date: string | null
    event_time: string | null
    location: string | null
    category: string
  }
  const events: ExtractedEvent[] = parsed
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      title: typeof e.title === 'string' ? e.title : '',
      event_date: typeof e.event_date === 'string' ? e.event_date : today,
      event_end_date: typeof e.event_end_date === 'string' ? e.event_end_date : null,
      event_time: typeof e.event_time === 'string' ? e.event_time : null,
      location: typeof e.location === 'string' ? e.location : null,
      category: LOCAL_EVENT_CATEGORY_IDS.includes(e.category as string) ? (e.category as string) : 'autre',
    }))
    .filter((e) => e.title.trim().length > 0)

  return NextResponse.json({ events })
}
