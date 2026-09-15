-- ============================================================
-- MIGRATION: Séjours pour accompagnants (widget "+" sur l'accueil)
-- À appliquer dans Supabase → SQL Editor
-- ============================================================

-- NULL = séjour du titulaire du compte (comportement existant).
-- Renseigné = séjour saisi pour une autre personne (ex: enfant, ami)
-- depuis le widget "Prochain séjour" de la page d'accueil.
alter table public.bookings
  add column if not exists guest_name text;
