// Catégories de l'onglet "Activités" (événements locaux à Chalabre et
// alentours). Liste fermée par défaut proposée le 08/10/2026, cohérente
// avec la convention déjà suivie par DOCUMENT_CATEGORIES/CONTACT_CATEGORIES
// -- à ajuster avec Nicolas/Louis si besoin, non figée : la session de
// test démarre avec cette liste plutôt que d'attendre une validation qui
// retarderait le début du test (voir migration_local_events.sql).
export const LOCAL_EVENT_CATEGORIES = [
  { id: 'marche', label: 'Marché' },
  { id: 'brocante', label: 'Brocante' },
  { id: 'fete', label: 'Fête' },
  { id: 'concert', label: 'Concert' },
  { id: 'sport', label: 'Sport' },
  { id: 'autre', label: 'Autre' },
] as const

export type LocalEventCategoryId = (typeof LOCAL_EVENT_CATEGORIES)[number]['id']

export const LOCAL_EVENT_CATEGORY_IDS: string[] = LOCAL_EVENT_CATEGORIES.map((c) => c.id)

export const LOCAL_EVENT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  LOCAL_EVENT_CATEGORIES.map((c) => [c.id, c.label])
)
