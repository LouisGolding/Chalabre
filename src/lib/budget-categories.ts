// Catégories de l'onglet "Budget" (voir claude/prompt-onglet-budget.md).
// Liste fermée proposée le 06/10/2026, étendue le 15/10/2026 à la demande
// de Nicolas avec "remboursement" (somme versée à un particulier, en
// particulier un membre de la famille), puis le 16/10/2026 avec
// "abonnements" (téléphone/internet récurrents, ex. Orange fibre),
// identifiée lors du test sur le premier relevé réel. Non figée : le
// test démarre avec cette liste, "autre" absorbe tout le reste, et on
// ajoutera des catégories au vu des libellés réellement récurrents sur
// les relevés de Guy/Guillaume (question ouverte 3 du prompt).
export const BUDGET_CATEGORIES = [
  { id: 'taxe_sejour', label: 'Taxe de séjour' },
  { id: 'cotisation', label: 'Cotisation' },
  { id: 'taxe_fonciere', label: 'Taxe foncière' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'electricite', label: 'Électricité' },
  { id: 'eau', label: 'Eau' },
  { id: 'abonnements', label: 'Abonnements' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'travaux', label: 'Travaux' },
  { id: 'remboursement', label: 'Remboursement' },
  { id: 'autre', label: 'Autre' },
] as const

export type BudgetCategoryId = (typeof BUDGET_CATEGORIES)[number]['id']

export const BUDGET_CATEGORY_IDS: string[] = BUDGET_CATEGORIES.map((c) => c.id)

export const BUDGET_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  BUDGET_CATEGORIES.map((c) => [c.id, c.label])
)

// Les deux comptes de la maison (voir claude/prompt-onglet-budget.md) --
// Guy pour Lalande, Guillaume pour Canat, déjà connus du site comme les
// deux comptes Stripe pour la taxe de séjour. Pas de vue fusionnée par
// défaut (décision prise dans le prompt).
export const BUDGET_ACCOUNTS = [
  { id: 'lalande', label: 'Lalande' },
  { id: 'canat', label: 'Canat' },
] as const

export type BudgetAccountId = (typeof BUDGET_ACCOUNTS)[number]['id']
