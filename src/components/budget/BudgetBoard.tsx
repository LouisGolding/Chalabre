'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronDown, Download, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn, formatDate, viewTogglePillClass } from '@/lib/utils'
import { BUDGET_ACCOUNTS, BUDGET_CATEGORY_LABELS, type BudgetAccountId } from '@/lib/budget-categories'
import type { BudgetStatement, BudgetTransaction } from '@/types'

// Composant client de l'onglet "Budget" (voir claude/prompt-onglet-budget.md)
// -- mise en forme posée le 15/10/2026 à la demande de Nicolas, esthétique
// calquée sur "Activités" (ActivitesBoard.tsx) : encadré de saisie en haut,
// cartes "card-canson", pastilles de sélection (viewTogglePillClass).
//
// Mise à jour du 16/10/2026 (Nicolas) :
//   - le dépôt de relevé est un vrai upload de fichier (pas de texte
//     collé, pas d'extraction automatique pour l'instant) -- même
//     pattern de sélection de fichier que "Documents"
//     (DocumentUploadForm.tsx), mais la sélection ENREGISTRE réellement
//     le fichier (POST /api/budget/statements) plutôt que de rester
//     inerte : Nicolas veut pouvoir consulter/télécharger les relevés
//     déposés, indépendamment de l'extraction IA des transactions
//     (toujours en cours de calibrage dans la conversation, voir
//     points-a-regler-avec-louis.md) ;
//   - la table `budget_statements` et le bucket Storage associés
//     viennent de migration_budget_statements.sql, écrite mais PAS
//     appliquée (en attente de l'accord de Louis) -- tant que ce n'est
//     pas fait, la route renvoie une erreur claire affichée ici plutôt
//     que de planter ;
//   - les relevés déposés sont listés du plus récent au plus ancien,
//     avec un lien de téléchargement (URL signée générée côté serveur,
//     voir dashboard/budget/page.tsx, même principe que "Documents") ;
//     ceux des années précédentes sont repliés par défaut, même principe
//     que "Événements passés" sur Activités (ActivitesBoard.tsx) ;
//   - le dépôt de relevé (widget "Déposer le relevé bancaire" plus la
//     liste des relevés déjà déposés qui l'accompagne) reste réservé aux
//     admins -- demandé par Nicolas le 16/10/2026, reconduit le
//     17/10/2026 au moment où le reste de la page s'est ouvert à la
//     famille (voir la prop `isAdmin` plus bas) ; l'onglet n'apparaît
//     toujours que dans la grille des onglets (TileNav), plus dans le
//     bandeau du bas (BottomNav), demandé par Nicolas le 16/10/2026.
//
// Mise à jour du 17/10/2026 (Nicolas) : budget/page.tsx n'est plus
// admin-only dans sa totalité -- ce composant reçoit désormais une prop
// `isAdmin` et c'est lui qui décide quelle partie rester réservée aux
// admins (le widget de dépôt ci-dessous) et quelle partie ouvrir à la
// famille (sélecteur de compte, cartes de synthèse, transactions, bilan
// annuel).
//
// Les cartes de tableau de bord (entrées/sorties/solde/en attente) et le
// bilan annuel affichent toujours des valeurs à blanc ("--") en attendant
// la table `budget_transactions` (migration distincte, pas encore
// écrite -- questions ouvertes du prompt encore en cours avec Nicolas).
export function BudgetBoard({
  isAdmin,
  initialTransactions,
  initialStatements,
}: {
  isAdmin: boolean
  initialTransactions: BudgetTransaction[]
  initialStatements: (BudgetStatement & { downloadUrl: string | null })[]
}) {
  const router = useRouter()
  const [account, setAccount] = useState<BudgetAccountId>('lalande')
  const [transactions] = useState(initialTransactions)
  const [statements] = useState(initialStatements)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pastStatementsOpen, setPastStatementsOpen] = useState(false)

  const accountLabel = BUDGET_ACCOUNTS.find((a) => a.id === account)?.label ?? account

  const accountTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.account === account)
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [transactions, account]
  )

  const currentYear = new Date().getFullYear()
  const { currentStatements, pastStatements } = useMemo(() => {
    const sorted = statements
      .filter((s) => s.account === account)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return {
      currentStatements: sorted.filter((s) => new Date(s.created_at).getFullYear() === currentYear),
      pastStatements: sorted.filter((s) => new Date(s.created_at).getFullYear() !== currentYear),
    }
  }, [statements, account, currentYear])

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('account', account)
      const res = await fetch('/api/budget/statements', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'envoi")
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur de compte -- pas de vue fusionnée par défaut (voir le
          prompt), on affiche toujours un seul compte à la fois. */}
      <div className="flex flex-wrap gap-4">
        {BUDGET_ACCOUNTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAccount(a.id)}
            className={viewTogglePillClass(account === a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Tableau de bord -- valeurs à blanc, pas encore de table
          budget_transactions en base. "Solde année précédente" ajouté le
          16/10/2026 à la demande de Nicolas : point de départ du calcul,
          de sorte que Solde = Solde année précédente + Entrées - Sorties
          (corrélation vérifiée à la main sur les deux premiers relevés
          réels avant d'ajouter cette case, voir points-a-regler-avec-
          louis.md). "Entrées"/"Sorties" sont donc appelés à devenir des
          cumuls depuis le début de l'année (pas juste le dernier relevé)
          une fois la vraie donnée branchée. */}
      {/* DEMO TEMPORAIRE pour Nicolas (16/10/2026) : valeurs cumulées des
          relevés août + septembre simulées en dur sur le compte Lalande,
          à retirer dès que Nicolas confirme avoir vu le rendu -- "Solde
          année précédente" utilise ici le plus ancien solde dont on
          dispose (avant le relevé d'août), pas le vrai solde au
          31/12/2025 qu'on n'a pas encore. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Solde année précédente" value={account === 'lalande' ? '6 381,52 €' : '--'} />
        <SummaryTile label="Entrées" value={account === 'lalande' ? '35 997,09 €' : '--'} />
        <SummaryTile label="Sorties" value={account === 'lalande' ? '38 874,63 €' : '--'} />
        <SummaryTile label="Solde" value={account === 'lalande' ? '3 503,98 €' : '--'} />
        <SummaryTile label="En attente" value={account === 'lalande' ? 'n/a' : '--'} />
      </div>

      {/* Zone de dépôt du relevé -- upload de fichier (Excel/CSV), pas de
          texte collé : même pattern de sélection de fichier que
          "Documents", mais fonctionnel dès maintenant (voir
          /api/budget/statements) pour que les relevés déposés restent
          consultables, indépendamment de l'extraction IA. Réservé aux
          admins (isAdmin) -- demandé par Nicolas le 17/10/2026, le reste
          de la page étant désormais ouvert à la famille. */}
      {isAdmin && (
      <div className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10">
        <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">
          Déposer le relevé bancaire ({accountLabel})
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className={cn(actionPillClass, 'cursor-pointer')}>
            <Plus className="h-3.5 w-3.5" />
            {fileName ?? 'Choisir un fichier (Excel, PDF, JPEG)'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,application/pdf,image/jpeg"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!fileName || uploading}
            className={actionPillClass}
          >
            {uploading ? 'Envoi...' : 'Déposer'}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Relevés déjà déposés pour ce compte -- plus récent en premier,
            ceux des années précédentes repliés (même principe que
            "Événements passés" sur Activités). */}
        {currentStatements.length === 0 && pastStatements.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">Aucun relevé déposé pour ce compte.</p>
        ) : (
          <div className="space-y-2 pt-1">
            {currentStatements.map((s) => (
              <StatementRow key={s.id} statement={s} />
            ))}
            {pastStatements.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPastStatementsOpen((o) => !o)}
                  aria-expanded={pastStatementsOpen}
                  className="flex w-full items-center justify-between gap-2 text-left hover:opacity-80"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Relevés des années précédentes ({pastStatements.length})
                  </p>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      pastStatementsOpen && 'rotate-180'
                    )}
                  />
                </button>
                {pastStatementsOpen &&
                  pastStatements.map((s) => <StatementRow key={s.id} statement={s} />)}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Liste des transactions enregistrées pour ce compte */}
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-foreground">
          Transactions ({accountTransactions.length})
        </p>
        {accountTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">Aucune transaction enregistrée pour ce compte.</p>
        ) : (
          <div className="space-y-2">
            {accountTransactions.map((t) => (
              <TransactionCard key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </div>

      {/* Bilan annuel -- en attente de l'historique en base */}
      <Card className="py-0">
        <CardHeader>
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">Bilan annuel</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground/70">
            Disponible une fois l&apos;historique de l&apos;année enregistré pour ce compte.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-canson rounded-lg p-3 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-medium text-foreground">{value}</p>
    </div>
  )
}

function StatementRow({ statement }: { statement: BudgetStatement & { downloadUrl: string | null } }) {
  return (
    <div className="card-canson flex items-center justify-between gap-3 rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{statement.file_name}</p>
        <p className="text-xs text-muted-foreground">{formatDate(statement.created_at)}</p>
      </div>
      {statement.downloadUrl && (
        <a
          href={statement.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Télécharger ce relevé"
        >
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: BudgetTransaction }) {
  return (
    <div className="card-canson flex items-start justify-between gap-3 rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{transaction.label}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(transaction.transaction_date), 'EEEE d MMMM', { locale: fr })}
          {' · '}
          {BUDGET_CATEGORY_LABELS[transaction.category] ?? transaction.category}
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 text-sm font-medium',
          transaction.direction === 'in' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {transaction.direction === 'in' ? '+' : '-'}
        {transaction.amount.toFixed(2)} €
      </p>
    </div>
  )
}
