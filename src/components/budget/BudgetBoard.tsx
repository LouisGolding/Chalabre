'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronDown, Download, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn, formatCurrency, formatDate, viewTogglePillClass } from '@/lib/utils'
import { BUDGET_ACCOUNTS, BUDGET_CATEGORY_LABELS, type BudgetAccountId } from '@/lib/budget-categories'
import type { BudgetStatement, BudgetStripeTransaction, BudgetTransaction } from '@/types'

// Détail par catégorie du compte Lalande (Entrées/Sorties) -- mêmes
// catégories, montants et couleurs que la maquette Artifact de l'onglet
// Budget (artboard "Main", version validée par Nicolas le 17/10/2026,
// voir aussi claude/categorisation-reelle-lalande-2026.md section C) :
// vérifiés ligne par ligne sur les 9 relevés 2026. Dominante VERTE pour
// les Entrées, ROUGE pour les Sorties, luminosité strictement croissante
// du plus gros montant (le plus sombre) au plus petit (le plus clair) --
// l'intitulé reste toujours affiché à côté de la couleur, jamais la
// couleur seule comme identifiant.
//
// ⚠️ À METTRE À JOUR à chaque nouveau relevé Lalande reçu (tant que la
// table `budget_transactions` n'existe pas en base), en gardant ces deux
// listes synchronisées avec celles de la maquette. SOLDE_FIN_2025_LALANDE
// ne change pas en cours d'année (seulement au 1er janvier suivant, où il
// devra aussi être renommé "fin 2026"). ENTREES_LALANDE/SORTIES_LALANDE
// (les 4 cases du tableau de bord) et SOLDE_LALANDE sont tous calculés à
// partir de ces deux listes, jamais saisis séparément -- impossible donc
// qu'ils divergent du détail par catégorie affiché juste en dessous.
type BudgetCategoryBreakdown = { id: string; label: string; amount: number; color: string }

const ENTREES_CATS_LALANDE: BudgetCategoryBreakdown[] = [
  { id: 'cotisation', label: 'Cotisations mensuelles', amount: 13023.5, color: '#0B3D24' },
  { id: 'aide_harry', label: 'Aide Harry', amount: 8500.0, color: '#25523B' },
  { id: 'remboursement', label: 'Remboursement', amount: 4009.5, color: '#3E6752' },
  { id: 'taxe_sejour', label: 'Taxe de séjour', amount: 3210.0, color: '#587C69' },
  { id: 'fil_nathan', label: 'Fil Nathan', amount: 1570.0, color: '#729180' },
  { id: 'assurance', label: 'Assurance', amount: 1442.51, color: '#8BA697' },
  { id: 'fil_nathan_annule', label: 'Fil Nathan (virement annulé)', amount: 1250.0, color: '#A5BBAE' },
  { id: 'mai_en_attente', label: 'En attente (mai)', amount: 945.0, color: '#BFD0C5' },
  { id: 'entretien_jardin', label: 'Entretien jardin', amount: 625.0, color: '#D8E5DC' },
  { id: 'electricite', label: 'Électricité', amount: 281.58, color: '#F2FAF3' },
]

const SORTIES_CATS_LALANDE: BudgetCategoryBreakdown[] = [
  { id: 'travaux', label: 'Travaux', amount: 14235.0, color: '#3D0000' },
  { id: 'reparations_sinistre', label: 'Réparations sinistre', amount: 4570.0, color: '#4B1111' },
  { id: 'electricite', label: 'Électricité', amount: 4129.52, color: '#582322' },
  { id: 'amenagement', label: 'Aménagement / fournitures maison', amount: 3226.0, color: '#663434' },
  { id: 'taxe_fonciere', label: 'Taxe foncière', amount: 2639.0, color: '#744545' },
  { id: 'assurance', label: 'Assurance', amount: 2130.53, color: '#825656' },
  { id: 'remboursement', label: 'Remboursement', amount: 1773.0, color: '#8F6867' },
  { id: 'fil_nathan', label: 'Fil Nathan', amount: 1429.17, color: '#9D7978' },
  { id: 'fil_nathan_annule', label: 'Fil Nathan (virement annulé)', amount: 1250.0, color: '#AB8A8A' },
  { id: 'charges_merlette', label: 'Charges Merlette', amount: 1200.0, color: '#B89C9B' },
  { id: 'entretien_jardin', label: 'Entretien jardin', amount: 1032.0, color: '#C6ADAC' },
  { id: 'mai_en_attente', label: 'En attente (mai)', amount: 621.0, color: '#D4BEBD' },
  { id: 'abonnements', label: 'Abonnements', amount: 395.91, color: '#E2CFCF' },
  { id: 'menage', label: 'Ménage', amount: 150.0, color: '#EFE1E0' },
  { id: 'frais_bancaires', label: 'Frais bancaires / saisies', amount: 93.5, color: '#FDF2F1' },
]

const SOLDE_FIN_2025_LALANDE = 7521.52 // "SOLDE CRÉDITEUR AU 08.01.2026", relevé déc. 2025
const ENTREES_LALANDE = ENTREES_CATS_LALANDE.reduce((sum, c) => sum + c.amount, 0) // = 34 857,09 €
const SORTIES_LALANDE = SORTIES_CATS_LALANDE.reduce((sum, c) => sum + c.amount, 0) // = 38 874,63 €
const SOLDE_LALANDE = SOLDE_FIN_2025_LALANDE + ENTREES_LALANDE - SORTIES_LALANDE // = 3 503,98 €, "SOLDE CRÉDITEUR AU 08.10.2026"

// Liseré de sélection des tuiles Entrées/Sorties et couleur du lien "Voir
// le détail", repris à l'identique de la maquette (demande de Nicolas,
// 17/10/2026).
const ENTREES_ACCENT = '#3F7D4A'
const SORTIES_ACCENT = '#A4402E'

const DETAIL_HINT_ENTREES =
  '10 catégories, extraction ligne par ligne vérifiée au centime le 17/10 — « En attente (mai) » représente les 945,00 € de mai pas encore catégorisés individuellement (page 1/3 manquante), aucune ligne en « Autres ».'
const DETAIL_HINT_SORTIES =
  '15 catégories, extraction ligne par ligne vérifiée au centime le 17/10 — « En attente (mai) » représente les 621,00 € de mai pas encore catégorisés individuellement (page 1/3 manquante), aucune ligne en « Autres ».'

// Géométrie du camembert (même rayon que la maquette).
const DONUT_R = 60
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_R

type BudgetDetailItem = {
  id: string
  label: string
  color: string
  amountLabel: string
  percentLabel: string
  dash: string
  dashoffset: string
  strokeWidth: number
  dimmed: boolean
  barWidthPct: string
}

function buildBudgetDetailItems(cats: BudgetCategoryBreakdown[], hoverId: string | null): BudgetDetailItem[] {
  const total = cats.reduce((sum, c) => sum + c.amount, 0)
  const sorted = [...cats].sort((a, b) => b.amount - a.amount)
  const maxAmount = sorted.length > 0 ? sorted[0].amount : 1
  const hasHover = hoverId !== null
  let cumulative = 0
  return sorted.map((c) => {
    const pct = total > 0 ? (c.amount / total) * 100 : 0
    const len = (c.amount / total) * DONUT_CIRCUMFERENCE
    const dashoffset = -cumulative
    cumulative += len
    const active = c.id === hoverId
    return {
      id: c.id,
      label: c.label,
      color: c.color,
      amountLabel: formatCurrency(c.amount),
      percentLabel: `${Math.round(pct)} %`,
      dash: `${len.toFixed(2)} ${(DONUT_CIRCUMFERENCE - len).toFixed(2)}`,
      dashoffset: dashoffset.toFixed(2),
      strokeWidth: active ? 32 : 28,
      dimmed: hasHover && !active,
      barWidthPct: `${Math.max(4, (c.amount / maxAmount) * 100).toFixed(1)}%`,
    }
  })
}

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
// Les cartes de tableau de bord : le compte Lalande affiche les 4 vrais
// chiffres vérifiés ligne par ligne sur les 9 relevés 2026 (voir
// claude/categorisation-reelle-lalande-2026.md, section A, 17/10/2026)
// -- "Solde fin [mois]" n'est pas un chiffre séparé mais le RÉSULTAT du
// calcul Solde fin 2025 + Entrées - Sorties, pour qu'il corresponde
// toujours exactement à la ligne "SOLDE CRÉDITEUR" du dernier relevé.
//
// Mise à jour du 17/10/2026 (2), Nicolas ("je veux que notre dernière
// version de la maquette apparaisse") : les tuiles Entrées/Sorties sont
// désormais cliquables (compte Lalande uniquement) et déplient un
// panneau de détail par catégorie -- vue "Barres"/"Camembert"
// (survol/clic pour isoler une catégorie), tableau accessible en
// alternative, mêmes couleurs et mêmes montants que la maquette Artifact.
// Le compte Canat n'a pas ce même travail de vérification et reste à
// blanc partout (tuiles, détail, et la liste des transactions et le
// bilan annuel restent à blanc pour les deux comptes, faute de table
// `budget_transactions`, migration distincte pas encore écrite --
// questions ouvertes du prompt encore en cours avec Nicolas).
export function BudgetBoard({
  isAdmin,
  initialTransactions,
  initialStatements,
  stripeTransactions,
}: {
  isAdmin: boolean
  initialTransactions: BudgetTransaction[]
  initialStatements: (BudgetStatement & { downloadUrl: string | null })[]
  stripeTransactions: BudgetStripeTransaction[]
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

  // Widget dépliable "Transactions Stripe" (cotisations + taxes de
  // séjour réellement encaissées) -- visible par admin ET famille.
  // Filtré sur le compte actuellement sélectionné en haut de page
  // (`account`), comme le reste du tableau de bord -- demande de
  // Nicolas le 17/10/2026, qui remplace le premier comportement
  // (Lalande et Canat toujours affichés séparément ensemble, quel que
  // soit le compte choisi). Voir dashboard/budget/page.tsx pour le
  // calcul de `stripeTransactions`.
  const [stripeOpen, setStripeOpen] = useState(false)
  const accountStripeTx = useMemo(
    () => stripeTransactions.filter((t) => t.account === account),
    [stripeTransactions, account]
  )

  // Panneau de détail Entrées/Sorties (compte Lalande uniquement) --
  // state propre à ce panneau, réinitialisé (table fermée, survol levé)
  // à chaque ouverture/fermeture/changement de catégorie, même principe
  // que la maquette.
  const [openDetail, setOpenDetail] = useState<'entrees' | 'sorties' | null>(null)
  const [detailChartType, setDetailChartType] = useState<'barres' | 'camembert'>('barres')
  const [detailTableOpen, setDetailTableOpen] = useState(false)
  const [detailHoverId, setDetailHoverId] = useState<string | null>(null)

  const toggleDetail = (key: 'entrees' | 'sorties') => {
    setOpenDetail((prev) => (prev === key ? null : key))
    setDetailTableOpen(false)
    setDetailHoverId(null)
  }

  const detailItems = useMemo(() => {
    if (openDetail === 'entrees') return buildBudgetDetailItems(ENTREES_CATS_LALANDE, detailHoverId)
    if (openDetail === 'sorties') return buildBudgetDetailItems(SORTIES_CATS_LALANDE, detailHoverId)
    return []
  }, [openDetail, detailHoverId])

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

      {/* Tableau de bord Lalande -- les 3 chiffres d'entrée viennent de la
          vérification ligne par ligne des 9 relevés janvier-septembre
          2026 (totaux officiels "TOTAL DES OPÉRATIONS"/"SOLDE
          CRÉDITEUR" de chaque relevé, voir
          claude/categorisation-reelle-lalande-2026.md section A,
          17/10/2026). "Solde fin septembre" n'est PAS un 4e chiffre
          codé en dur : c'est le résultat de SOLDE_FIN_2025_LALANDE +
          ENTREES_LALANDE - SORTIES_LALANDE, ce qui garantit qu'il colle
          toujours exactement à la ligne "SOLDE CRÉDITEUR AU 08.10.2026"
          du dernier relevé (3 503,98 €, vérifié). Les tuiles Entrées et
          Sorties sont cliquables (compte Lalande uniquement) et
          déplient le panneau de détail par catégorie juste en dessous.
          Le compte Canat n'a pas ce même travail de vérification et
          reste à blanc.

          ⚠️ Toujours des constantes codées en dur (voir en tête de
          fichier), pas une vraie requête sur une table
          `budget_transactions` (migration pas encore écrite) -- à
          mettre à jour à la main (les deux listes
          ENTREES_CATS_LALANDE/SORTIES_CATS_LALANDE, et
          SOLDE_FIN_2025_LALANDE au 1er janvier) à chaque nouveau relevé
          reçu, tant que cette table n'existe pas. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Solde fin 2025" value={account === 'lalande' ? formatCurrency(SOLDE_FIN_2025_LALANDE) : '--'} />
        {account === 'lalande' ? (
          <BudgetDetailTile
            label="Entrées"
            value={formatCurrency(ENTREES_LALANDE)}
            accent={ENTREES_ACCENT}
            open={openDetail === 'entrees'}
            onClick={() => toggleDetail('entrees')}
          />
        ) : (
          <SummaryTile label="Entrées" value="--" />
        )}
        {account === 'lalande' ? (
          <BudgetDetailTile
            label="Sorties"
            value={formatCurrency(SORTIES_LALANDE)}
            accent={SORTIES_ACCENT}
            open={openDetail === 'sorties'}
            onClick={() => toggleDetail('sorties')}
          />
        ) : (
          <SummaryTile label="Sorties" value="--" />
        )}
        <SummaryTile label="Solde fin septembre" value={account === 'lalande' ? formatCurrency(SOLDE_LALANDE) : '--'} />
        <SummaryTile label="En attente" value={account === 'lalande' ? 'n/a' : '--'} />
      </div>

      {/* Panneau de détail Entrées/Sorties par catégorie -- mêmes vues
          (Barres/Camembert + tableau accessible) et mêmes données que la
          maquette Artifact, portées ici le 17/10/2026 à la demande de
          Nicolas. */}
      {openDetail && account === 'lalande' && (
        <div className="card-canson space-y-4 rounded-xl p-4 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {openDetail === 'entrees' ? 'Entrées' : 'Sorties'} par catégorie
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDetailChartType('barres')}
                className={viewTogglePillClass(detailChartType === 'barres')}
              >
                Barres
              </button>
              <button
                type="button"
                onClick={() => setDetailChartType('camembert')}
                className={viewTogglePillClass(detailChartType === 'camembert')}
              >
                Camembert
              </button>
            </div>
          </div>

          {detailChartType === 'camembert' ? (
            <div className="flex flex-wrap items-center justify-center gap-5">
              <svg width="170" height="170" viewBox="0 0 160 160" className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="80" cy="80" r={DONUT_R} fill="none" stroke="#f1eae3" strokeWidth={28} />
                {detailItems.map((item) => (
                  <circle
                    key={item.id}
                    cx="80"
                    cy="80"
                    r={DONUT_R}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={item.strokeWidth}
                    strokeDasharray={item.dash}
                    strokeDashoffset={item.dashoffset}
                    className="cursor-pointer transition-all"
                    style={{ opacity: item.dimmed ? 0.4 : 1 }}
                    onClick={() => setDetailHoverId((prev) => (prev === item.id ? null : item.id))}
                  />
                ))}
              </svg>
              <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                {detailItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDetailHoverId((prev) => (prev === item.id ? null : item.id))}
                    className="flex items-center gap-2 text-left transition-opacity"
                    style={{ opacity: item.dimmed ? 0.4 : 1 }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="min-w-0 flex-1 text-sm text-foreground">{item.label}</span>
                    <span className="text-sm font-medium tabular-nums text-foreground">{item.percentLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {detailItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDetailHoverId((prev) => (prev === item.id ? null : item.id))}
                  className="flex flex-col gap-1 text-left transition-opacity"
                  style={{ opacity: item.dimmed ? 0.4 : 1 }}
                >
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 text-foreground">{item.label}</span>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">{item.amountLabel}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ background: item.color, width: item.barWidthPct }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setDetailTableOpen((o) => !o)}
              className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {detailTableOpen ? 'Masquer le tableau' : 'Voir en tableau'}
            </button>
            {detailTableOpen && (
              <div className="mt-2 overflow-x-auto border-t border-foreground/10 pt-2">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="px-1.5 py-1 font-medium">Catégorie</th>
                      <th className="px-1.5 py-1 text-right font-medium">Montant</th>
                      <th className="px-1.5 py-1 text-right font-medium">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item) => (
                      <tr key={item.id} className="border-t border-foreground/10">
                        <td className="px-1.5 py-1 text-foreground">{item.label}</td>
                        <td className="px-1.5 py-1 text-right tabular-nums text-foreground">{item.amountLabel}</td>
                        <td className="px-1.5 py-1 text-right tabular-nums text-foreground">{item.percentLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {openDetail === 'entrees' ? DETAIL_HINT_ENTREES : DETAIL_HINT_SORTIES}
          </p>
        </div>
      )}

      {/* Transactions Stripe (cotisations + taxes de séjour réellement
          encaissées) -- widget dépliable, visible par admin ET famille
          (demande de Nicolas, 17/10/2026), compte Lalande et compte
          Canat toujours affichés séparément à l'intérieur, même quand un
          seul des deux comptes est sélectionné plus haut sur la page. */}
      <Card className="py-0">
        {/* Entete repliee calee a 40px (Card sans padding vertical propre
            + bouton h-10), meme pattern exact que GuideCard.tsx (Guide
            de la maison) -- demande de Nicolas le 17/10/2026 ("meme
            espacements haut bas que les autres widgets"), l'ancienne
            version (simple div + p-4 fixe) n'etait pas calee sur ce
            standard. */}
        <CardHeader>
          <button
            type="button"
            onClick={() => setStripeOpen((o) => !o)}
            aria-expanded={stripeOpen}
            className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
          >
            <CardTitle className="text-sm md:text-base uppercase tracking-wide">
              Transactions Stripe ({accountStripeTx.length})
            </CardTitle>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', stripeOpen && 'rotate-180')}
            />
          </button>
        </CardHeader>
        {stripeOpen && (
          <CardContent className="pb-4">
            {accountStripeTx.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">Aucune transaction Stripe pour ce compte.</p>
            ) : (
              <div className="space-y-2">
                {accountStripeTx.map((t) => (
                  <div
                    key={t.id}
                    className="card-canson flex items-start justify-between gap-3 rounded-lg p-3 ring-1 ring-foreground/10"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.paidAt ? formatDate(t.paidAt) : 'Date inconnue'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-foreground">{formatCurrency(t.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

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

      {/* Liste des transactions enregistrées pour ce compte -- titre
          "Transactions" retiré le 17/10/2026 (demande de Nicolas,
          devenu redondant avec le titre du widget "Transactions
          Stripe" juste au-dessus) */}
      <div className="space-y-2">
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

      {/* "Bilan annuel" renommé "Bilan année 2025" -- demande de Nicolas,
          17/10/2026 : un widget par année CIVILE COMPLÈTE ("Bilan année
          2026" s'ajoutera à côté de celui-ci, pas à sa place, une fois
          2026 terminée -- donc à partir de janvier 2027). Reste un
          placeholder pour l'instant : seul le solde de clôture au
          31.12.2025 est un chiffre vérifié (voir SOLDE_FIN_2025_LALANDE
          plus haut, et claude/categorisation-reelle-lalande-2026.md,
          section A) -- aucune donnée Entrées/Sorties 2025 n'a été
          vérifiée ligne par ligne à ce jour, contrairement à 2026. */}
      <Card className="py-0">
        <CardHeader>
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">Bilan année 2025</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground/70">
            Disponible une fois les relevés de l&apos;année 2025 vérifiés pour ce compte.
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

// Variante cliquable de SummaryTile pour Entrées/Sorties (compte Lalande
// uniquement) : même habillage, plus un chevron qui pivote et un lien
// "Voir le détail" dans la couleur d'accent de la catégorie
// (vert/Entrées, rouge/Sorties), plus un liseré de la même couleur
// quand le panneau de détail est ouvert -- repris de la maquette
// Artifact (17/10/2026).
function BudgetDetailTile({
  label,
  value,
  accent,
  open,
  onClick,
}: {
  label: string
  value: string
  accent: string
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="card-canson rounded-lg p-3 text-left ring-1 ring-foreground/10 transition-shadow"
      style={open ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </div>
      <p className="text-lg font-medium text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px]" style={{ color: accent }}>
        Voir le détail
      </p>
    </button>
  )
}

// Compte Lalande/Canat affiché à l'intérieur du widget "Transactions
// Stripe" -- même liste vide/non-vide que StatementRow, pour rester
// cohérent avec le reste du fichier.
// Relevé déposé -- demande de Nicolas le 17/10/2026 : le titre ouvre le
// relevé (consultation, même URL signée que le téléchargement), l'icône
// de téléchargement reste à côté, et un bouton de suppression (admin
// uniquement -- ce composant n'est de toute façon rendu que dans le bloc
// {isAdmin && (...)} de BudgetBoard) retire le relevé.
function StatementRow({ statement }: { statement: BudgetStatement & { downloadUrl: string | null } }) {
  return (
    <div className="card-canson flex items-center justify-between gap-3 rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="min-w-0">
        {statement.downloadUrl ? (
          <a
            href={statement.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium text-foreground hover:underline"
          >
            {statement.file_name}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{statement.file_name}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDate(statement.created_at)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {statement.downloadUrl && (
          <a
            href={statement.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Télécharger ce relevé"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
        <DeleteStatementButton id={statement.id} />
      </div>
    </div>
  )
}

function DeleteStatementButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleDelete = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/budget/statements?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la suppression')
      }
      router.refresh()
    } catch {
      // silencieux -- même convention que DeleteDocumentButton
      // (DocumentsAdmin.tsx) : le relevé reste affiché si la suppression échoue.
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Supprimer ce relevé"
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
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
