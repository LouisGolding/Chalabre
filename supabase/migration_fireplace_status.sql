-- ============================================================
-- MIGRATION : statut "Utilisable" / "Ne pas utiliser" des cheminées
-- (Guide de la maison, widget "Cheminées")
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé, le 29/09/2026, que le tableau "Cheminées"
-- du Guide de la maison (une ligne par pièce équipée d'une cheminée,
-- groupées par zone/étage — voir FireplacesTable.tsx) porte deux cases à
-- cocher mutuellement exclusives par ligne, "Utilisable" / "Ne pas
-- utiliser", éditables par les comptes admin uniquement, et fixes (lecture
-- seule) pour tous les autres. Une seule ligne par pièce, identifiée par
-- une clé stable choisie dans le code (`room_key` de FireplacesTable.tsx,
-- ex. "lalande-r2-chambre-patrick") plutôt qu'un id généré, pour rester
-- simple à relier depuis un fichier de configuration en dur (pas de table
-- séparée pour les pièces elles-mêmes).

create table if not exists public.fireplace_status (
  room_key text primary key,
  status text check (status in ('usable', 'not_usable')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now()
);

alter table public.fireplace_status enable row level security;

-- Lecture ouverte à tous les comptes connectés (comme le reste du Guide de
-- la maison) ; écriture réservée aux admins uniquement (contrairement aux
-- "Bouteilles de gaz", ouvertes à family+admin — ici Nicolas a précisé
-- "ADMIN" seul).
create policy "fireplace_status_select" on public.fireplace_status
  for select to authenticated using (true);

create policy "fireplace_status_insert" on public.fireplace_status
  for insert to authenticated with check (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "fireplace_status_update" on public.fireplace_status
  for update to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );
