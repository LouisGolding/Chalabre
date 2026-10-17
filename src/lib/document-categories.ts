// Dossiers de l'onglet "Documents". Liste donnée par Aurélie le 17/09/2026,
// à compléter avec elle plus tard ("nous pourrons l'agrémenter plus tard").
// "Relevés bancaires (Lalande)" ajoutée le 17/10/2026 à la demande de
// Nicolas, pour y déposer les relevés BNP Paribas du compte Lalande
// collectés et vérifiés en conversation (voir
// claude/points-a-regler-avec-louis.md) — c'est à cette occasion que
// l'onglet "Documents" est passé en admin uniquement pour tout le monde
// (voir dashboard/documents/page.tsx), les relevés bancaires étant des
// données plus sensibles que le reste de ce qui y est déjà déposé.
// "(Lalande)" dans le libellé car le compte "Canat" (voir
// src/lib/budget-categories.ts) aura vraisemblablement besoin de la
// même chose plus tard — catégorie séparée à ajouter à ce moment-là
// plutôt que de mélanger les deux comptes dans un seul dossier.
export const DOCUMENT_CATEGORIES = [
  { id: 'notaries', label: 'Documents notariés' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'edf', label: 'Contrat EDF' },
  { id: 'devis_factures', label: 'Devis / Factures' },
  { id: 'releves_bancaires_lalande', label: 'Relevés bancaires (Lalande)' },
] as const

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORIES)[number]['id']

export const DOCUMENT_CATEGORY_IDS: string[] = DOCUMENT_CATEGORIES.map((c) => c.id)

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.id, c.label])
)
