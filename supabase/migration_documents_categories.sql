-- ============================================================
-- MIGRATION : nouvelles catégories de documents
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 17/09/2026, que l'onglet "Documents"
-- soit organisé en dossiers simples : Documents notariés, Assurance,
-- Contrat EDF, Devis / Factures — à la place des catégories d'origine
-- (propriete, contrats, factures, plans, autre). Elle a précisé qu'elle
-- complètera cette liste plus tard.
--
-- Cette migration remplace la contrainte de la colonne `category` de
-- `public.documents`. S'il existe déjà des documents dont la catégorie
-- ne correspond à aucune des nouvelles valeurs, la migration échouera à
-- la dernière étape (la contrainte) plutôt que de silencieusement les
-- rendre invisibles : dans ce cas, réattribuer ces documents à une des
-- nouvelles catégories avant de relancer.

alter table public.documents drop constraint if exists documents_category_check;

alter table public.documents
  add constraint documents_category_check
  check (category in ('notaries', 'assurance', 'edf', 'devis_factures'));

alter table public.documents alter column category set default 'devis_factures';
