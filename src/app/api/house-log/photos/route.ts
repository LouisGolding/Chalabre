import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Photos attachées à un post "Réalisations". Chemin de Storage attendu :
// "<house_log_id>/<uuid>.<ext>" — le premier segment sert à la policy
// Storage (house_log_storage_write_own_or_admin) pour retrouver le post et
// vérifier que l'appelant en est l'auteur ou un admin.
//
// Le bucket "house-log" est privé (migration_house_log_realisations.sql,
// pas encore appliquée en base) : l'affichage passe par des URLs signées
// générées côté serveur dans la page, jamais par une URL publique.

const BUCKET = 'house-log'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const formData = await request.formData()
  const houseLogId = formData.get('house_log_id')
  const files = formData.getAll('files')

  if (typeof houseLogId !== 'string' || !houseLogId || files.length === 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const uploaded: string[] = []
  for (const file of files) {
    if (!(file instanceof File)) continue
    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const storagePath = `${houseLogId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
    // Si l'appelant n'est ni l'auteur du post ni admin, la policy Storage
    // refuse l'upload ici : on arrête et on nettoie ce qui a déjà été
    // envoyé plutôt que de continuer.
    if (uploadError) {
      if (uploaded.length > 0) await supabase.storage.from(BUCKET).remove(uploaded)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }
    uploaded.push(storagePath)
  }

  const { data: rows, error: insertError } = await supabase
    .from('house_log_photos')
    .insert(uploaded.map((storage_path) => ({ house_log_id: houseLogId, storage_path })))
    .select()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove(uploaded)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ photos: rows })
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

  const { data: photo, error: fetchError } = await supabase
    .from('house_log_photos')
    .select('storage_path')
    .eq('id', id)
    .single()
  if (fetchError || !photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }

  const { data, error } = await supabase.from('house_log_photos').delete().eq('id', id).select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Suppression non autorisée' }, { status: 403 })
  }

  try {
    await supabase.storage.from(BUCKET).remove([photo.storage_path])
  } catch {
    // silencieux — nettoyage best effort
  }

  return NextResponse.json({ ok: true })
}
