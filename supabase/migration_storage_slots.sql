-- ============================================================
-- MIGRATION : rangement des placards (Guide de la maison)
-- A appliquer dans Supabase -> SQL Editor, apres schema.sql et les
-- migrations deja en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demande, le 04/10/2026, deux widgets lies dans le
-- Guide de la maison :
-- - "Organisation des placards" (tout le monde) : une pastille Canat/
--   Lalande, et un encadre de recherche ("Ex: draps blancs") qui
--   retrouve, parmi ce qui a ete renseigne ci-dessous, le numero du
--   rangement correspondant et affiche le plan de l'etage concerne.
-- - "Rangement indications" (comptes admin uniquement) : la maison est
--   decoupee en 4 etages (RDC/1er/2e/3e) x 12 emplacements numerotes
--   chacun (ex. "2.07"), chaque emplacement ayant son propre encadre de
--   texte libre, modifiable a volonte par un admin.
--
-- Pour que la recherche du premier widget puisse filtrer par cote de la
-- maison (Canat/Lalande, demande explicitement par Nicolas), chaque
-- emplacement recoit aussi un cote de maison, renseigne par l'admin au
-- meme endroit que le texte libre -- point non detaille mot pour mot par
-- Nicolas mais necessaire pour que le filtre Canat/Lalande ait un sens ;
-- a confirmer avec lui que cette interpretation convient.
--
-- Cle stable `slot_key` (ex. "rdc-01", "2e-07"), comme `room_key` pour
-- `fireplace_status` -- pas de table separee pour les etages/emplacements
-- eux-memes, la liste des 4x12 combinaisons possibles vit dans le code
-- (src/lib/storage-guide.ts), cette table ne stocke qu'une ligne par
-- emplacement qui a deja ete renseigne par un admin (les autres
-- n'existent simplement pas encore en base, traites comme "a completer"
-- cote interface).

create table if not exists public.storage_slots (
  slot_key text primary key,
  floor text not null check (floor in ('rdc', '1er', '2e', '3e')),
  slot_number integer not null check (slot_number between 1 and 12),
  house_side text check (house_side in ('canat', 'lalande')),
  content text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now(),
  unique (floor, slot_number)
);

alter table public.storage_slots enable row level security;

-- Lecture ouverte a tous les comptes connectes : la recherche du widget
-- "Organisation des placards" (ouverte a tout le monde, y compris les
-- amis) a besoin de lire le contenu de chaque emplacement pour y chercher
-- un mot-cle -- meme principe que fireplace_status/gas_bottles_status.
-- Ecriture reservee aux admins uniquement (comme fireplace_status, pas
-- comme gas_bottles_status qui autorise aussi "family").
create policy "storage_slots_select" on public.storage_slots
  for select to authenticated using (true);

create policy "storage_slots_insert" on public.storage_slots
  for insert to authenticated with check (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "storage_slots_update" on public.storage_slots
  for update to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );
