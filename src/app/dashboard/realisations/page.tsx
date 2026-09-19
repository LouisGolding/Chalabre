import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealisationsBoard, type RealisationEntry } from '@/components/realisations/RealisationsBoard'

// Onglet "Réalisations" (nom provisoire, 19/09/2026) : fil façon blog des
// travaux/améliorations entrepris dans la maison (tonte, réparation,
// réfection d'une pièce...), pour que les occupants absents au moment des
// faits soient informés en consultant l'onglet, sans que personne n'ait à
// les prévenir activement. Réservé aux membres de la famille (RLS
// house_log_select, admin + family) — jamais aux amis.
export default async function RealisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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

  const initialEntries: RealisationEntry[] = (entries ?? []).map((e) => ({
    ...e,
    photos: photosByEntry.get(e.id) ?? [],
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">Réalisations</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Ce qui a été entrepris dans la maison, par qui, et quand.
      </p>
      <RealisationsBoard initialEntries={initialEntries} currentUserId={user.id} isAdmin={isAdmin} />
    </div>
  )
}
