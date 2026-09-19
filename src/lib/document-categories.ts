// Dossiers de l'onglet "Documents". Liste donnée par Aurélie le 17/09/2026,
// à compléter avec elle plus tard ("nous pourrons l'agrémenter plus tard").
export const DOCUMENT_CATEGORIES = [
  { id: 'notaries', label: 'Documents notariés' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'edf', label: 'Contrat EDF' },
  { id: 'devis_factures', label: 'Devis / Factures' },
] as const

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORIES)[number]['id']

export const DOCUMENT_CATEGORY_IDS: string[] = DOCUMENT_CATEGORIES.map((c) => c.id)

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.id, c.label])
)
