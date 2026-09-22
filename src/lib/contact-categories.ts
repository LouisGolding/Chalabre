// Catégories de contacts (pastilles de l'onglet "Contacts"). Liste donnée
// par Aurélie le 17/09/2026, puis revue le 22/09/2026 : "Maraîchers" et
// "Fromagers & produits laitiers" fusionnées en "Producteurs locaux", et
// nouvelle catégorie "Visites & Rando".
export const CONTACT_CATEGORIES = [
  { id: 'services', label: 'Services' },
  { id: 'restaurants_bar', label: 'Restaurants & Bar' },
  { id: 'producteurs_locaux', label: 'Producteurs locaux' },
  { id: 'marches_boulangers', label: 'Marchés & boulangers' },
  { id: 'boutiques', label: 'Boutiques, brocantes, potiers' },
  { id: 'bonnes_adresses', label: 'Bonnes adresses' },
  { id: 'visites_rando', label: 'Visites & Rando' },
] as const

export type ContactCategoryId = (typeof CONTACT_CATEGORIES)[number]['id']

export const CONTACT_CATEGORY_IDS: string[] = CONTACT_CATEGORIES.map((c) => c.id)

export const CONTACT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_CATEGORIES.map((c) => [c.id, c.label])
)
