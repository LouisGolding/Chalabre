import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFrenchDate } from '@/lib/utils'

// Edition de la date de naissance d'un membre depuis "Gestion" (tableau
// Membres), reservee aux admins -- demande par Aurelie le 30/10/2026 :
// nouvelle colonne "Date de naissance" avant "Date de creation", editable
// au cas ou la personne ne l'a pas renseignee elle-meme (ex. inscription
// via "Continuer avec Google", qui ne fournit jamais de date de
// naissance -- voir UNKNOWN_DATE_OF_BIRTH dans src/lib/profile.ts).
//
// Saisie en texte libre JJ/MM/AAAA (meme format et meme validation que le
// formulaire d'inscription, voir parseFrenchDate dans utils.ts), jamais
// un calendrier -- coherent avec la demande d'Aurelie du 27/10/2026 sur
// le formulaire d'inscription.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { profileId, dateOfBirth } = await request.json()

  if (!profileId || typeof profileId !== 'string' || typeof dateOfBirth !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  // Saisie "JJ/MM/AAAA" attendue (voir formatDateInputValue côté client,
  // appliqué pendant la frappe) -- jamais un format déjà ISO ici.
  const iso = parseFrenchDate(dateOfBirth)
  if (!iso) {
    return NextResponse.json({ error: 'Date de naissance invalide. Format attendu : JJ/MM/AAAA.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ date_of_birth: iso })
    .eq('id', profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dateOfBirth: iso })
}
