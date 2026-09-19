export type UserRole = 'admin' | 'family' | 'friend'
export type FamilyGroup = 'lalande' | 'canat' | 'friend'
// Côté de la maison où dort la personne pour un séjour donné (jamais
// 'friend' : la maison n'a que deux côtés) — détermine sur quel compte
// bancaire (Canat ou Lalande) la taxe de séjour du séjour est versée.
export type HouseSide = 'lalande' | 'canat'
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
  created_at: string
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
  category: 'entretien' | 'reparation' | 'autre'
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

export interface HouseLogEntry {
  id: string
  content: string
  entry_type: 'info' | 'travaux' | 'evenement'
  created_by: string
  created_at: string
  profile?: Profile
}
