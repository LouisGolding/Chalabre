-- ============================================================
-- MIGRATION : titre des posts "Réalisations"
-- À appliquer dans Supabase → SQL Editor, après schema.sql et
-- migration_house_log_realisations.sql. Rejouable sans risque.
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
-- ============================================================
--
-- Contexte : demandé par Nicolas le 30/09/2026 -- le post d'un widget
-- "Réalisations" n'affiche plus le nom de l'auteur comme titre principal,
-- mais un titre libre saisi par l'auteur (ex. "Tonte du jardin"). Le nom
-- de l'auteur est désormais affiché juste avant la date
-- ("Nicolas Lalande, 20 septembre 2026").
--
-- Colonne nullable : les posts déjà existants n'ont pas de titre et
-- continueront de s'afficher (repli sur un libellé générique côté UI).

alter table public.house_log
  add column if not exists title text;

comment on column public.house_log.title is
  'Titre libre du post (ex. "Tonte du jardin"), saisi par l''auteur. Nullable pour les posts créés avant cette migration.';
