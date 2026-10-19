export type UserRole = 'admin' | 'family' | 'friend'
export type FamilyGroup = 'lalande' | 'canat' | 'friend'
// Côté de la maison (ou dépendance) où dort la personne pour un séjour
// donné (jamais 'friend') — détermine sur quel compte bancaire la taxe de
// séjour du séjour est versée. "petite_maison" (demandé par Aurélie le
// 21/09/2026) : une dépendance distincte de la maison principale — sa taxe
// de séjour suit le même circuit de paiement que "lalande", pour arriver
// sur le même compte (aucun routage Stripe par compte n'existe encore dans
// le code à ce jour — un seul compte Stripe pour tous les paiements, voir
// src/app/api/stripe/checkout/route.ts — cette règle s'appliquera donc
// telle quelle le jour où ce routage sera mis en place).
export type HouseSide = 'lalande' | 'canat' | 'petite_maison'
export type PaymentStatus = 'pending' | 'paid' | 'overdue'
export type TMTier = 40 | 80 | 120 // encore utilisé par TMPayment.amount (paiements via Stripe)

export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  date_of_birth: string
  family_group: FamilyGroup
  role: UserRole
  tm_tier: number | null // montant libre depuis migration_tm_amount_libre.sql
  rib: string | null
  avatar_url: string | null
  // Numero de telephone, voir migration_profile_phone.sql (pas encore
  // appliquee) -- saisi librement depuis la page "Mon profil",
  // ajoutee le 19/10/2026 a la demande d'Aurelie. Null pour tout compte
  // qui ne l'a pas encore renseigne (tous, avant cette migration).
  phone: string | null
  created_at: string
  // Couleur assignee a ce compte (voir src/lib/colors.ts) -- recalculee et
  // persistee a l'inscription (handle_new_user) ou par migration pour les
  // comptes deja existants. Depuis le 29/09/2026 (palette Argile), c'est un
  // INDEX DE PALETTE (0-49, pas un angle en degres) a lire conjointement
  // avec family_group (colorForPaletteIndex(family_group, color_hue)) --
  // le nom de colonne n'a pas change pour ne pas renommer une colonne deja
  // en production, voir l'en-tete de src/lib/colors.ts. Peut etre null pour
  // un compte tres ancien jamais recalcule.
  color_hue: number | null
}

export interface Room {
  id: string
  name: string
  family_group: 'lalande' | 'canat'
  capacity: number
  description: string | null
}

export interface Booking {
  id: string
  user_id: string
  room_id: string | null
  check_in: string
  check_out: string
  notes: string | null
  guest_name?: string | null
  house_side?: HouseSide | null
  created_at: string
  profile?: Profile
  room?: Room
  guests?: BookingGuest[]
  ts_payment?: TSPayment
}

export interface BookingGuest {
  id: string
  booking_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  with_parents: boolean
}

export interface TSPayment {
  id: string
  booking_id: string
  user_id: string
  amount: number
  status: PaymentStatus
  stripe_payment_intent_id: string | null
  paid_at: string | null
  created_at: string
}

export interface TMPayment {
  id: string
  user_id: string
  amount: TMTier
  month: string // YYYY-MM
  status: PaymentStatus
  stripe_payment_intent_id: string | null
  paid_at: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  event_type: 'family' | 'friends' | 'maintenance' | 'cleaner' | 'gardener' | 'other'
  created_by: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  category: 'entretien' | 'reparation' | 'manutention' | 'autre'
  priority: 'low' | 'medium' | 'high'
  period: string | null // mois ou saison, voir src/lib/task-periods.ts
  completed: boolean
  created_by: string
  created_at: string
}

export interface Contact {
  id: string
  name: string
  role: string
  category: string // voir src/lib/contact-categories.ts
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface Document {
  id: string
  title: string
  category: 'propriete' | 'contrats' | 'factures' | 'plans' | 'autre'
  file_url: string
  file_name: string
  uploaded_by: string
  created_at: string
}

// Onglet "Budget" (voir claude/prompt-onglet-budget.md) -- table
// `budget_transactions` pas encore créée en base (migration écrite mais
// pas appliquée sans l'accord de Louis, voir points-a-regler-avec-louis.md
// dans le Projet). Type posé dès la mise en forme de l'onglet (15/10/2026)
// pour typer les transactions une fois la table créée ; BudgetBoard reçoit
// un tableau vide en attendant.
export interface BudgetTransaction {
  id: string
  account: 'lalande' | 'canat'
  transaction_date: string
  label: string
  amount: number
  direction: 'in' | 'out'
  category: string // voir src/lib/budget-categories.ts
  reconciled_with: string | null
  source_statement: string | null
  created_by: string | null
  created_at: string
}

// Relevé bancaire déposé sur l'onglet "Budget" (voir
// migration_budget_statements.sql, pas encore appliquée). Distinct de
// BudgetTransaction : ce type suit le FICHIER déposé (pour consultation/
// téléchargement), pas les lignes qu'une future extraction IA en tirera.
export interface BudgetStatement {
  id: string
  account: 'lalande' | 'canat'
  file_name: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

// Transaction Stripe réellement encaissée (cotisation mensuelle ou taxe
// de séjour, statut "paid"), rattachée à un compte Lalande/Canat pour le
// widget dépliable "Transactions Stripe" de BudgetBoard.tsx (demande de
// Nicolas, 17/10/2026). Calculée à chaque chargement de page à partir de
// tm_payments/ts_payments (voir dashboard/budget/page.tsx), jamais
// stockée séparément. Le compte vient :
// - pour une cotisation (tm_payments), de profiles.family_group (le
//   côté de la maison du cotisant) ;
// - pour une taxe de séjour (ts_payments), de bookings.house_side (le
//   côté de la maison OÙ le séjour a eu lieu -- pas forcément celui du
//   payeur, un invité "friend" pouvant séjourner côté Lalande comme côté
//   Canat), "petite_maison" étant routé sur le compte Lalande (même
//   règle que pour la taxe de séjour elle-même, voir
//   migration_house_side_petite_maison.sql).
// ⚠️ Un seul compte Stripe existe à ce jour pour tous les paiements
// (aucun routage bancaire réel par compte) : cette répartition reste
// donc uniquement comptable/d'affichage.
export interface BudgetStripeTransaction {
  id: string
  account: 'lalande' | 'canat'
  kind: 'cotisation' | 'taxe_sejour'
  label: string
  amount: number
  paidAt: string
}

export interface LocalEvent {
  id: string
  title: string
  event_date: string
  event_end_date: string | null
  event_time: string | null
  location: string | null
  category: string // voir src/lib/local-event-categories.ts
  source_text: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface HouseLogEntry {
  id: string
  title: string | null
  content: string
  entry_type: 'info' | 'travaux' | 'evenement'
  created_by: string
  created_at: string
  updated_at: string
  profile?: Profile
  photos?: HouseLogPhoto[]
}

export interface HouseLogPhoto {
  id: string
  house_log_id: string
  storage_path: string
  created_at: string
}

// Likes/commentaires (19/10/2026, demandé par Aurélie, "à la manière
// d'Instagram") -- voir migration_house_log_reactions.sql (pas encore
// appliquée) et RealisationsBoard.tsx.
export interface HouseLogComment {
  id: string
  house_log_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Profile
}
