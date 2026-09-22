-- ============================================================
-- MIGRATION : suivi des bouteilles de gaz (Guide de la maison)
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 22/09/2026, une pastille "Bouteilles
-- de gaz" dans le Guide de la maison (widget "Organisation"), où
-- indiquer le nombre de bouteilles disponibles dans la maison et la date
-- du dernier remplacement — modifiable par tous les comptes famille et
-- admin (pas les amis). C'est une seule valeur partagée pour toute la
-- maison (pas un réglage par personne), d'où une table à une seule ligne
-- plutôt qu'une colonne sur `profiles`.

create table if not exists public.gas_bottles_status (
  id uuid default uuid_generate_v4() primary key,
  count integer not null default 0,
  last_refill_date date,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now()
);

alter table public.gas_bottles_status enable row level security;

-- Lecture ouverte à tous les comptes connectés (comme le reste du Guide
-- de la maison) ; écriture réservée à family/admin, jamais aux amis —
-- même règle que demandée par Aurélie pour cette pastille.
create policy "gas_bottles_status_select" on public.gas_bottles_status
  for select to authenticated using (true);

create policy "gas_bottles_status_insert" on public.gas_bottles_status
  for insert to authenticated with check (
    get_user_role(auth.uid()) in ('admin', 'family')
  );

create policy "gas_bottles_status_update" on public.gas_bottles_status
  for update to authenticated using (
    get_user_role(auth.uid()) in ('admin', 'family')
  );
