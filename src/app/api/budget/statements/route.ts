import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Upload des relevés bancaires de l'onglet "Budget" (voir
// claude/prompt-onglet-budget.md) -- suit uniquement le FICHIER déposé
// (nom, compte, qui, quand), pour qu'il reste consultable/téléchargeable
// dans BudgetBoard.tsx, indépendamment de l'extraction IA des
// transactions (toujours en cours de calibrage dans la conversation,
// pas encore de route dédiée). Réservé aux admins -- demandé
// explicitement par Nicolas le 16/10/2026, plus restrictif que le bucket
// "documents" (lecture admin+family) vu la sensibilité des relevés
// bancaires.
//
// Même pattern que /api/documents : bucket Storage PRIVÉ
// ("budget-statements"), budget_statements.storage_path stocke le
// CHEMIN du fichier (pas une URL), la lecture passe par des URLs
// signées générées côté serveur (voir dashboard/budget/page.tsx).
//
// La table `budget_statements` et le bucket "budget-statements"
// viennent de migration_budget_statements.sql, écrite mais PAS
// appliquée (en attente de l'accord de Louis, comme toutes les
// migrations) -- tant que ce n'est pas fait, cette route renvoie une
// erreur claire plutôt que de planter.

const BUCKET = 'budget-statements'
const ALLOWED_ACCOUNTS = ['lalande', 'canat']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const account = formData.get('account')

  if (!(file instanceof File) || typeof account !== 'string') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  if (!ALLOWED_ACCOUNTS.includes(account)) {
    return NextResponse.json({ error: 'Compte invalide' }, { status: 400 })
  }

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined
  const storagePath = `${account}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (uploadError) {
    const notReady = /bucket not found/i.test(uploadError.message)
    return NextResponse.json(
      {
        error: notReady
          ? "Le dépôt de relevés n'est pas encore activé en base (migration_budget_statements.sql pas encore appliquée, en attente de l'accord de Louis)."
          : uploadError.message,
      },
      { status: 500 }
    )
  }

  const { data: statement, error: insertError } = await supabase
    .from('budget_statements')
    .insert({
      account,
      file_name: file.name,
      storage_path: storagePath,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    // La ligne n'a pas pu être créée : on retire le fichier orphelin du
    // Storage plutôt que de laisser un fichier non référencé (best
    // effort, on ne bloque pas la réponse d'erreur si ça échoue).
    await supabase.storage.from(BUCKET).remove([storagePath])
    const notReady = /relation .*budget_statements.* does not exist/i.test(insertError.message)
    return NextResponse.json(
      {
        error: notReady
          ? "La table budget_statements n'existe pas encore en base (migration_budget_statements.sql pas encore appliquée, en attente de l'accord de Louis)."
          : insertError.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ statement })
}
