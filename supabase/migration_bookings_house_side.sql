-- ============================================================
-- MIGRATION : côté de la maison (Canat / Lalande) pour un séjour
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 18/09/2026, d'ajouter une pastille
-- "Canat" / "Lalande" à côté du sélecteur d'âge (0-16 ans / 17 ans et +)
-- du widget "Prochain séjour" de la page d'accueil, pour indiquer de quel
-- côté de la maison la personne dort. La maison étant divisée en deux
-- parties, ce choix détermine sur quel compte bancaire (Canat ou Lalande)
-- la taxe de séjour de ce séjour doit être versée.
--
-- NULL = pas encore renseigné (séjours existants créés avant cette
-- fonctionnalité). Le code applicatif (src/app/api/bookings/quick/route.ts)
-- exige désormais ce choix avant d'enregistrer un NOUVEAU séjour, mais la
-- colonne reste nullable pour ne pas casser les séjours déjà en base.
alter table public.bookings
  add column if not exists house_side text
  check (house_side in ('canat', 'lalande'));
