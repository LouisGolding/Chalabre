import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DOCUMENT_CATEGORY_IDS } from '@/lib/document-categories'

// Upload / suppression de documents (onglet "Documents").
// Réservé aux admins : les autres comptes peuvent uniquement consulter
// (lecture via la page elle-même, RLS "documents_select"). Les policies
// "documents_admin" côté base autorisent déjà l'admin à tout faire sur la
// table `documents` — il faut en plus un bucket de Storage nommé
// "documents" (voir supabase/migration_documents_storage.sql, à appliquer
// par Louis) pour que l'upload fonctionne réellement en production.
//
// Mode développement : tant que NODE_ENV !== 'production', cette route ne
// touche jamais Supabase (ni la base, ni le Storage). Elle simule la
// réponse attendue pour que l'interface réagisse normalement pendant les
// tests, sans écrire dans la base partagée.
const isDev = process.env.NODE_ENV !== 'production'

const BUCKET = 'documents'
const ALLOWED_CATEGORIES = DOCUMENT_CATEGORY_IDS

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const title = formData.get('title')
  const category = formData.get('category')

  if (!(file instanceof File) || typeof title !== 'string' || !title.trim() || typeof category !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  if (isDev) {
    // Rien n'est écrit (ni Storage, ni base) : on renvoie un document
    // simulé pour que la liste se mette à jour normalement à l'écran.
    return NextResponse.json({
      document: {
        id: `dev-${crypto.randomUUID()}`,
        title: title.trim(),
        category,
        file_url: '#',
        file_name: file.name,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
      },
      dev: true,
    })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined
  const storagePath = `${category}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      title: title.trim(),
      category,
      file_url: publicUrlData.publicUrl,
      file_name: file.name,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    // La ligne n'a pas pu être créée : on retire le fichier orphelin du
    // Storage plutôt que de laisser un fichier non référencé (best effort,
    // on ne bloque pas la réponse d'erreur si ce nettoyage échoue).
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ document })
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

  if (isDev) {
    return NextResponse.json({ ok: true, dev: true })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { data: doc, error: fetchError } = await supabase.from('documents').select('file_url').eq('id', id).single()
  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }

  const { error: deleteError } = await supabase.from('documents').delete().eq('id', id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Best effort : on retire aussi le fichier du Storage. On ne fait pas
  // échouer la requête si ça ne marche pas (la ligne en base est déjà
  // supprimée, ce qui est ce qui compte pour l'utilisateur).
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const idx = doc.file_url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = doc.file_url.slice(idx + marker.length)
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
  } catch {
    // silencieux — nettoyage best effort
  }

  return NextResponse.json({ ok: true })
}
