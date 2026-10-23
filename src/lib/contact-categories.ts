// Catégories de contacts (pastilles de l'onglet "Contacts"). Liste donnée
// par Aurélie le 17/09/2026, puis revue le 22/09/2026 : "Maraîchers" et
// "Fromagers & produits laitiers" fusionnées en "Producteurs locaux", et
// nouvelle catégorie "Visites & Rando". Nouvelle catégorie "Médical"
// ajoutée le 23/10/2026 à la demande d'Aurélie -- ajouter une entrée ici
// suffit à faire apparaître son propre widget (tableau) dans
// ContactsBoard.tsx, qui boucle sur CONTACT_CATEGORIES ; la contrainte
// `contacts_category_check` en base doit en revanche être mise à jour à
// part (voir supabase/migration_contacts_medical.sql), sinon l'ajout d'un
// contact dans cette catégorie échouera tant qu'elle n'est pas appliquée.
export const CONTACT_CATEGORIES = [
  { id: 'services', label: 'Services' },
  { id: 'restaurants_bar', label: 'Restaurants & Bar' },
  { id: 'producteurs_locaux', label: 'Producteurs locaux' },
  { id: 'marches_boulangers', label: 'Marchés & boulangers' },
  { id: 'boutiques', label: 'Boutiques, brocantes, potiers' },
  { id: 'bonnes_adresses', label: 'Bonnes adresses' },
  { id: 'visites_rando', label: 'Visites & Rando' },
  { id: 'medical', label: 'Médical' },
] as const

export type ContactCategoryId = (typeof CONTACT_CATEGORIES)[number]['id']

export const CONTACT_CATEGORY_IDS: string[] = CONTACT_CATEGORIES.map((c) => c.id)

export const CONTACT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_CATEGORIES.map((c) => [c.id, c.label])
)
