-- ============================================================
-- MIGRATION : cotisation mensuelle (TM) à montant libre
-- À appliquer dans Supabase → SQL Editor, après schema.sql
-- (et après les migrations déjà en place : migration_auth_fix.sql,
-- migration_view_security.sql, etc.)
-- ============================================================
--
-- Jusqu'ici, profiles.tm_tier ne pouvait valoir que 40, 80 ou 120
-- (3 paliers fixes). En pratique, le montant de la cotisation
-- mensuelle de chaque propriétaire est amené à changer au cas par
-- cas (ex. 100 €) et ne colle pas forcément à ces 3 paliers.
--
-- On retire donc cette contrainte à paliers fixes et on autorise
-- n'importe quel montant entier positif (ou vide, si non renseigné).
-- Le type de la colonne (integer) ne change pas : ce n'est qu'un
-- assouplissement de la règle de validation.
--
-- La protection déjà en place (migration_auth_fix.sql) reste
-- inchangée : seul un admin peut modifier ce champ, un propriétaire
-- ordinaire ne peut pas changer sa propre cotisation lui-même.
alter table public.profiles
  drop constraint if exists profiles_tm_tier_check;

alter table public.profiles
  add constraint profiles_tm_tier_check check (tm_tier is null or tm_tier >= 0);
