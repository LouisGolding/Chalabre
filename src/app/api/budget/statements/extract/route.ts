import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_IDS } from '@/lib/budget-categories'

// Onglet "Budget" -- extraction IA des transactions d'un relevé déjà
// déposé (POST /api/budget/statements), demandée par Nicolas le
// 25/10/2026 : l'IA lit le relevé (PDF, CSV ou photo JPEG), en sort
// chaque opération (date, libellé, montant, sens) et lui attribue une
// catégorie de src/lib/budget-categories.ts. Les lignes sont
// enregistrées dans `budget_transactions` (migration_budget_transactions.sql,
// PAS encore appliquée -- en attente de l'accord de Louis), rattachées
// au relevé source : relancer l'extraction d'un relevé REMPLACE ses
// lignes au lieu de les doubler.
//
// Appelée par BudgetBoard.tsx juste après un dépôt réussi, et à la
// demande depuis la liste des relevés (bouton "Extraire"). Réservée aux
// admins, comme le dépôt.
//
// Même pattern que /api/local-events/extract : nécessite
// ANTHROPIC_API_KEY côté serveur (pas encore configurée sur Vercel au
// 25/10/2026) -- en son absence, erreur claire plutôt qu'un plantage.
//
// Modèle : claude-opus-5-5 plutôt que claude-haiku-5-5 (choisi pour
// Activités) -- il s'agit d'argent, une erreur de montant ou de sens
// fausse tout le budget, et le volume (un relevé par mois et par compte)
// rend l'écart de coût négligeable. Sortie structurée (JSON Schema) pour
// ne jamais avoir à deviner le format de la réponse, et repli serveur
// ("fallbacks: default") si le modèle refuse la requête.

export const maxDuration = 120

const BUCKET = 'budget-statements'

const TRANSACTIONS_SCHEMA = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date de l’opération, au format AAAA-MM-JJ' },
          label: { type: 'string', description: 'Libellé de l’opération, tel qu’il apparaît sur le relevé' },
          amount: { type: 'number', description: 'Montant en euros, toujours positif' },
          direction: { type: 'string', enum: ['in', 'out'] },
          category: { type: 'string', enum: BUDGET_CATEGORY_IDS },
        },
        required: ['date', 'label', 'amount', 'direction', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['transactions'],
  additionalProperties: false,
}

const SYSTEM_PROMPT =
  `Tu lis un relevé bancaire mensuel du compte commun d'une maison de famille ` +
  `(La Bâtisse) et tu en extrais TOUTES les opérations, une par ligne du relevé.\n\n` +
  `Pour chaque opération :\n` +
  `- date : la date de l'opération au format AAAA-MM-JJ. Si le relevé n'indique ` +
  `que le jour et le mois, déduis l'année de la période du relevé.\n` +
  `- label : le libellé tel qu'il apparaît, sans le reformuler.\n` +
  `- amount : le montant en euros, toujours positif.\n` +
  `- direction : "in" pour un crédit (argent reçu), "out" pour un débit (argent versé).\n` +
  `- category : une des catégories ci-dessous.\n\n` +
  `Catégories :\n` +
  BUDGET_CATEGORIES.map((c) => `- ${c.id} : ${c.label}`).join('\n') +
  `\n\nRepères : "cotisation" pour les virements mensuels des membres de la famille ` +
  `vers le compte ; "taxe_sejour" pour les taxes de séjour encaissées ou reversées ; ` +
  `"abonnements" pour le téléphone et internet récurrents (ex. Orange fibre) ; ` +
  `"remboursement" pour une somme versée à un particulier ou reçue d'un particulier, ` +
  `en particulier un membre de la famille, hors cotisation ; "autre" pour tout ce ` +
  `qui ne correspond clairement à aucune autre catégorie.\n\n` +
  `N'inclus PAS les lignes qui ne sont pas des opérations : soldes ` +
  `("SOLDE CRÉDITEUR", "ANCIEN SOLDE"...), totaux ("TOTAL DES OPÉRATIONS"...), ` +
  `en-têtes ou reports. N'invente aucune opération. Si le document ne contient ` +
  `aucune opération, renvoie une liste vide.`

type FileKind = 'pdf' | 'csv' | 'image'

type ExtractedTransaction = {
  date: string
  label: string
  amount: number
  direction: 'in' | 'out'
  category: string
}

// Le schéma garantit la forme, pas les valeurs : une ligne à date
// invalide ou à libellé vide est écartée (et comptée) plutôt
// qu'enregistrée faussée.
function isValidTransaction(t: unknown): t is ExtractedTransaction {
  if (typeof t !== 'object' || t === null) return false
  const { date, label, amount, direction } = t as Record<string, unknown>
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    typeof label === 'string' &&
    label.trim().length > 0 &&
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    (direction === 'in' || direction === 'out')
  )
}

function fileKind(fileName: string): FileKind | null {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'pdf'
  if (extension === 'csv') return 'csv'
  if (extension === 'jpg' || extension === 'jpeg') return 'image'
  return null
}

// Les exports CSV des banques françaises sont souvent en Windows-1252
// plutôt qu'en UTF-8 : on essaie UTF-8 strict, puis on se replie.
function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const NOT_READY_MESSAGE =
  "La table budget_transactions n'existe pas encore en base (migration_budget_transactions.sql pas encore appliquée, en attente de l'accord de Louis)."

function isMissingTable(message: string): boolean {
  return /budget_transactions/.test(message) && /does not exist|schema cache/i.test(message)
}

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

  const { statementId } = await request.json()
  if (typeof statementId !== 'string' || !statementId) {
    return NextResponse.json({ error: 'Paramètre "statementId" manquant' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Extraction automatique pas encore activée : clé API Anthropic non configurée (ANTHROPIC_API_KEY manquante côté serveur).",
      },
      { status: 500 }
    )
  }

  const { data: statement, error: fetchError } = await supabase
    .from('budget_statements')
    .select('id, account, file_name, storage_path')
    .eq('id', statementId)
    .single()
  if (fetchError || !statement) {
    return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 })
  }

  const kind = fileKind(statement.file_name)
  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Ce format n'est pas pris en charge par l'extraction automatique (Excel notamment) : déposez le relevé en PDF ou en CSV.",
      },
      { status: 415 }
    )
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(statement.storage_path)
  if (downloadError || !blob) {
    return NextResponse.json(
      { error: `Impossible de lire le relevé stocké : ${downloadError?.message ?? 'fichier introuvable'}` },
      { status: 500 }
    )
  }
  const bytes = await blob.arrayBuffer()

  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    kind === 'pdf'
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
        }
      : kind === 'image'
        ? {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(bytes).toString('base64') },
          }
        : { type: 'text', text: decodeText(bytes) }

  const client = new Anthropic({ apiKey })

  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: TRANSACTIONS_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text', text: `Relevé du compte ${statement.account} : extrais les opérations.` }],
        },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: `Erreur lors de l'appel à l'API Anthropic : ${message}` }, { status: 502 })
  }

  if (response.stop_reason === 'refusal') {
    return NextResponse.json({ error: "L'IA a refusé de traiter ce relevé." }, { status: 502 })
  }
  if (response.stop_reason === 'max_tokens') {
    return NextResponse.json(
      { error: "Relevé trop long pour être extrait en une fois : la réponse de l'IA a été coupée." },
      { status: 502 }
    )
  }

  const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Réponse de l'IA illisible (pas un JSON valide) -- réessaie." }, { status: 502 })
  }
  const items = (parsed as { transactions?: unknown })?.transactions
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Réponse de l'IA inattendue (pas de liste de transactions)." }, { status: 502 })
  }

  const rows = items.filter(isValidTransaction).map((t) => ({
    account: statement.account,
    transaction_date: t.date,
    label: t.label.trim(),
    amount: Math.abs(t.amount),
    direction: t.direction,
    category: BUDGET_CATEGORY_IDS.includes(t.category) ? t.category : 'autre',
    source_statement: statement.id,
    created_by: user.id,
  }))
  const skipped = items.length - rows.length

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          items.length === 0
            ? "Aucune transaction trouvée dans ce relevé. Vérifiez qu'il s'agit bien d'un relevé bancaire lisible."
            : `Aucune transaction exploitable : les ${items.length} lignes lues par l'IA étaient incomplètes ou invalides.`,
      },
      { status: 422 }
    )
  }

  // Remplacement des lignes d'une extraction précédente du même relevé :
  // on insère d'abord les nouvelles, puis on retire les anciennes -- si
  // l'insertion échoue, les anciennes lignes restent en place.
  const { data: previous, error: previousError } = await supabase
    .from('budget_transactions')
    .select('id')
    .eq('source_statement', statement.id)
  if (previousError) {
    return NextResponse.json(
      { error: isMissingTable(previousError.message) ? NOT_READY_MESSAGE : previousError.message },
      { status: 500 }
    )
  }

  const { data: inserted, error: insertError } = await supabase.from('budget_transactions').insert(rows).select()
  if (insertError) {
    return NextResponse.json(
      { error: isMissingTable(insertError.message) ? NOT_READY_MESSAGE : insertError.message },
      { status: 500 }
    )
  }

  const previousIds = (previous ?? []).map((p) => p.id)
  if (previousIds.length > 0) {
    const { error: deleteError } = await supabase.from('budget_transactions').delete().in('id', previousIds)
    if (deleteError) {
      return NextResponse.json(
        {
          error: `Nouvelles transactions enregistrées, mais les anciennes de ce relevé n'ont pas pu être retirées (doublons possibles) : ${deleteError.message}`,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ transactions: inserted, skipped })
}
