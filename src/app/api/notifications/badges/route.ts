import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { colorForPaletteIndex, fallbackIndexForName } from '@/lib/colors'
import type { FamilyGroup } from '@/types'

// Pastilles de nouveauté des tuiles Accueil (Entretien / Réalisations) --
// voir src/components/layout/TileNav.tsx (appelant) et
// supabase/migration_item_seen.sql (table item_seen, déjà appliquée).
// Design retenu (Artifact "notif-nouveaute-mockup", validé par Nicolas le
// 03/11/2026) : "le chiffre aligné de la proposition B, coloré selon le
// profil de la personne" -- un seul chiffre par tuile (nombre d'éléments
// non vus créés par quelqu'un d'autre), coloré avec la couleur du profil
// ayant créé le plus récent d'entre eux.
//
// Jamais de pastille pour ses propres ajouts (AskUserQuestion du
// 03/11/2026, "Non, jamais pour son propre auteur") : .neq('created_by',
// user.id) ci-dessous exclut aussi les lignes created_by=null (NULL
// != x vaut NULL en SQL, donc jamais retenu -- comportement voulu, une
// ligne sans auteur connu n'a pas de couleur à afficher).

type Badge = { count: number; color: string } | null

function pickBadge(
  rows: { id: string; created_at: string; profile: { first_name: string; last_name: string; color_hue: number | null; family_group: FamilyGroup } | null }[],
  seenIds: Set<string>
): Badge {
  const unseen = rows.filter((r) => !seenIds.has(r.id))
  if (unseen.length === 0) return null
  // Couleur du profil ayant créé le plus récent des éléments non vus.
  const mostRecent = unseen.reduce((a, b) => (a.created_at > b.created_at ? a : b))
  const p = mostRecent.profile
  if (!p) return { count: unseen.length, color: '#8a8a8a' }
  const index = typeof p.color_hue === 'number' ? p.color_hue : fallbackIndexForName(`${p.first_name} ${p.last_name}`)
  return { count: unseen.length, color: colorForPaletteIndex(p.family_group, index) }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const [tasksRes, houseLogRes, seenTaskRes, seenHouseLogRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, created_at, profile:profiles!tasks_created_by_fkey(first_name, last_name, color_hue, family_group)')
      .eq('completed', false)
      .neq('created_by', user.id),
    supabase
      .from('house_log')
      .select('id, created_at, profile:profiles(first_name, last_name, color_hue, family_group)')
      .neq('created_by', user.id),
    supabase.from('item_seen').select('item_id').eq('user_id', user.id).eq('item_type', 'task'),
    supabase.from('item_seen').select('item_id').eq('user_id', user.id).eq('item_type', 'house_log'),
  ])

  const seenTasks = new Set((seenTaskRes.data ?? []).map((r) => r.item_id))
  const seenHouseLog = new Set((seenHouseLogRes.data ?? []).map((r) => r.item_id))

  return NextResponse.json({
    taches: pickBadge((tasksRes.data ?? []) as unknown as Parameters<typeof pickBadge>[0], seenTasks),
    realisations: pickBadge((houseLogRes.data ?? []) as unknown as Parameters<typeof pickBadge>[0], seenHouseLog),
  })
}
