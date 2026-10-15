'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn, viewTogglePillClass } from '@/lib/utils'
import { BUDGET_ACCOUNTS, BUDGET_CATEGORY_LABELS, type BudgetAccountId } from '@/lib/budget-categories'
import type { BudgetTransaction } from '@/types'

// Composant client de l'onglet "Budget" (voir claude/prompt-onglet-budget.md)
// -- mise en forme posée le 15/10/2026 à la demande de Nicolas, esthétique
// calquée sur "Activités" (ActivitesBoard.tsx) : encadré de saisie en haut,
// cartes "card-canson", pastilles de sélection (viewTogglePillClass).
//
// Étape de mise en forme uniquement, AVANT la table en base et la route
// d'extraction IA :
//   - la table `budget_transactions` n'existe pas encore (migration
//     écrite mais pas appliquée, voir points-a-regler-avec-louis.md) --
//     BudgetBoard reçoit donc un tableau vide depuis page.tsx ;
//   - le prompt d'extraction est en cours de calibrage directement dans
//     la conversation avec Nicolas (comme cela a été fait pour
//     "Activités" avant de créer une clé API Anthropic) -- le bouton
//     "Analyser" ci-dessous n'appelle donc encore aucune route, il
//     affiche juste un message d'attente ;
//   - les cartes de tableau de bord (entrées/sorties/solde/en attente)
//     affichent des valeurs à blanc ("--") en attendant la vraie table.
// Le sélecteur de compte et la liste des transactions sont en revanche
// fonctionnels dès maintenant (état local), prêts à recevoir de vraies
// données une fois la table créée.
export function BudgetBoard({ initialTransactions }: { initialTransactions: BudgetTransaction[] }) {
  const [account, setAccount] = useState<BudgetAccountId>('lalande')
  const [transactions] = useState(initialTransactions)
  const [pasteText, setPasteText] = useState('')
  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null)

  const accountLabel = BUDGET_ACCOUNTS.find((a) => a.id === account)?.label ?? account

  const accountTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.account === account)
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [transactions, account]
  )

  const handleAnalyze = () => {
    if (!pasteText.trim()) return
    setNotReadyMessage(
      "Extraction pas encore branchée -- le prompt est en cours de calibrage avec Nicolas avant de créer la clé API Anthropic."
    )
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

      {/* Tableau de bord -- valeurs à blanc, pas encore de table en base */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Entrées" value="--" />
        <SummaryTile label="Sorties" value="--" />
        <SummaryTile label="Solde" value="--" />
        <SummaryTile label="En attente" value="--" />
      </div>

      {/* Zone de dépôt du relevé */}
      <div className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10">
        <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">
          Coller le texte du relevé bancaire ({accountLabel})
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Colle ici le texte brut du relevé (une ligne par transaction)..."
          rows={6}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          {notReadyMessage && <p className="text-xs text-muted-foreground">{notReadyMessage}</p>}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!pasteText.trim()}
            className={cn(actionPillClass, 'ml-auto')}
          >
            Analyser
          </button>
        </div>
      </div>

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
