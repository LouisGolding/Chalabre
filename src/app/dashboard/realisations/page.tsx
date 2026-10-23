import { PageTitle } from '@/components/layout/PageTitle'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { RealisationsBoard, type RealisationEntry } from '@/components/realisations/RealisationsBoard'

// Onglet "Réalisations" (nom provisoire, 19/09/2026) : fil façon blog des
// travaux/améliorations entrepris dans la maison (tonte, réparation,
// réfection d'une pièce...), pour que les occupants absents au moment des
// faits soient informés en consultant l'onglet, sans que personne n'ait à
// les prévenir activement. Réservé aux membres de la famille (RLS
// house_log_select, admin + family) — jamais aux amis.
export default async function RealisationsPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')
  if (profile?.role === 'friend') redirect('/dashboard')
  const isAdmin = profile?.role === 'admin'

  const { data: entries } = await supabase
    .from('house_log')
    .select('*, profile:profiles(first_name, last_name, family_group)')
    .order('created_at', { ascending: false })

  const entryIds = (entries ?? []).map((e) => e.id)
  const { data: photos } = entryIds.length > 0
    ? await supabase.from('house_log_photos').select('*').in('house_log_id', entryIds).order('created_at', { ascending: true })
    : { data: [] }

  // Bucket "house-log" privé (migration_house_log_realisations.sql) :
  // mêmes URLs signées 1 h générées côté serveur que pour "Documents"
  // (voir src/app/dashboard/documents/page.tsx).
  const paths = (photos ?? []).map((p) => p.storage_path)
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('house-log').createSignedUrls(paths, 60 * 60)
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl)
    }
  }

  const photosByEntry = new Map<string, { id: string; url: string }[]>()
  for (const p of photos ?? []) {
    const url = signedByPath.get(p.storage_path)
    if (!url) continue
    const list = photosByEntry.get(p.house_log_id) ?? []
    list.push({ id: p.id, url })
    photosByEntry.set(p.house_log_id, list)
  }

  // Likes/commentaires (19/10/2026, demande d'Aurelie, "a la maniere
  // d'Instagram") -- chargement en bloc comme les photos ci-dessus, pas
  // de pagination (le fil Réalisations reste de taille raisonnable).
  const { data: likes } = entryIds.length > 0
    ? await supabase.from('house_log_likes').select('house_log_id, user_id').in('house_log_id', entryIds)
    : { data: [] }
  const { data: comments } = entryIds.length > 0
    ? await supabase
        .from('house_log_comments')
        .select('*, profile:profiles(first_name, last_name)')
        .in('house_log_id', entryIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const likesByEntry = new Map<string, { count: number; likedByMe: boolean }>()
  for (const l of likes ?? []) {
    const current = likesByEntry.get(l.house_log_id) ?? { count: 0, likedByMe: false }
    current.count += 1
    if (l.user_id === user.id) current.likedByMe = true
    likesByEntry.set(l.house_log_id, current)
  }

  const commentsByEntry = new Map<string, typeof comments>()
  for (const c of comments ?? []) {
    const list = commentsByEntry.get(c.house_log_id) ?? []
    list.push(c)
    commentsByEntry.set(c.house_log_id, list)
  }

  const initialEntries: RealisationEntry[] = (entries ?? []).map((e) => ({
    ...e,
    photos: photosByEntry.get(e.id) ?? [],
    likeCount: likesByEntry.get(e.id)?.count ?? 0,
    likedByMe: likesByEntry.get(e.id)?.likedByMe ?? false,
    comments: commentsByEntry.get(e.id) ?? [],
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageTitle>Réalisations</PageTitle>
      <RealisationsBoard initialEntries={initialEntries} currentUserId={user.id} isAdmin={isAdmin} />
    </div>
  )
}
