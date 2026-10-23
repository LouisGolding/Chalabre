-- ============================================================
-- MIGRATION : numéro de téléphone sur le profil
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place. Rejouable sans risque.
-- ============================================================
--
-- ✅ DÉJÀ APPLIQUÉE EN PRODUCTION (23/10/2026) ✅
--
-- Appliquée par Aurélie elle-même (guidée pas à pas par Claude, qui n'a
-- exécuté aucune requête lui-même), après que le formulaire "Mon profil"
-- a échoué en production avec l'erreur PostgREST "Could not find the
-- 'phone' column of 'profiles' in the schema cache" -- qui bloquait en
-- réalité TOUT le formulaire (prénom/nom/date/groupe compris), pas
-- seulement le téléphone, puisque ProfileForm.tsx envoie un seul
-- update() qui échoue entièrement si un champ référence une colonne
-- absente. Vérifié en base (lecture seule) le 23/10/2026 après coup :
-- la colonne phone existe bien désormais (text, nullable).
--
-- Contexte original : nouvelle page "Mon profil" (19/10/2026, demandée par
-- Aurélie), accessible depuis le bandeau du bas à la place de
-- "Se déconnecter" (qui vit désormais en bas de cette page, voir
-- ProfileForm.tsx et BottomNav.tsx). Elle reprend les informations déjà
-- saisies à la première connexion (prénom, nom, date de naissance,
-- groupe familial — colonnes déjà existantes, voir
-- CompleteProfileForm.tsx) et ajoute la possibilité de renseigner un
-- numéro de téléphone, qui n'existait pas encore en base.
--
-- Colonne nullable, en texte libre (aucun format imposé côté base) :
-- les comptes déjà existants n'ont pas de numéro et continueront de
-- fonctionner normalement (le champ s'affiche simplement vide tant que
-- la personne ne l'a pas renseigné).
--
-- Modifiable par chacun sur sa propre ligne, comme prénom/nom/date de
-- naissance/groupe : la policy "profiles_update_own" (schema.sql) le
-- permet déjà, et cette colonne n'est pas concernée par le verrou de
-- protect_profile_privileges(), qui ne porte que sur tm_tier et role
-- (voir migration_tm_self_edit.sql) — aucune modification de ce trigger
-- n'est nécessaire pour cette migration.

alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is
  'Numéro de téléphone, saisi librement par la personne elle-même depuis "Mon profil". Nullable, aucun format imposé.';
