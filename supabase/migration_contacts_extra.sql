-- ============================================================
-- MIGRATION : catégories et adresse pour les contacts
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 17/09/2026, que l'onglet "Contacts"
-- affiche des pastilles par catégorie (Services, Restaurants & Bar,
-- Maraîchers, Fromagers & produits laitiers, Marchés & boulangers,
-- Boutiques/brocantes/potiers, Bonnes adresses), chaque catégorie
-- dépliant une liste éditable par les admins (type de service = colonne
-- `role` existante, nom, téléphone, adresse, email, commentaire = `notes`
-- existante). Il manquait une colonne pour la catégorie et une pour
-- l'adresse.
--
-- Aucune ligne n'existe encore dans `contacts` au moment d'écrire cette
-- migration (vérifié), donc pas de données existantes à réattribuer.
-- Si ce n'est plus le cas au moment de l'appliquer, il faudra leur donner
-- une catégorie avant que la contrainte ci-dessous ne s'applique.

alter table public.contacts add column if not exists category text;
alter table public.contacts add column if not exists address text;

alter table public.contacts
  add constraint contacts_category_check
  check (category in (
    'services', 'restaurants_bar', 'maraichers', 'fromagers',
    'marches_boulangers', 'boutiques', 'bonnes_adresses'
  ));

alter table public.contacts alter column category set not null;
