-- ============================================================
-- MIGRATION : onglet "Réalisations" (journal des travaux/améliorations)
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place. Rejouable sans risque.
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
-- ============================================================
--
-- Contexte : Nicolas a demandé, le 19/09/2026, un nouvel onglet
-- "Réalisations" (nom provisoire), réservé aux membres de la famille
-- (admin + family, PAS les amis) : un fil à la manière d'un blog où
-- n'importe quel membre peut poster ce qu'il a entrepris dans la maison
-- (tonte, réparation, réfection d'une pièce, réagencement d'une pièce...)
-- pendant son séjour, avec date, auteur et photos, pour que les autres
-- occupants soient informés de ce qui a été fait en leur absence sans
-- avoir à demander.
--
-- Réutilise la table house_log déjà présente dans schema.sql (créée pour un
-- usage prévu mais jamais branchée à une UI) plutôt que d'en créer une
-- nouvelle en double. Cette migration :
--   1. resserre house_log_select à admin/family (elle était ouverte à tout
--      le monde, y compris les amis — house_log n'a jamais été exposée
--      nulle part jusqu'ici donc ça n'a jamais eu d'effet visible, mais il
--      faut la corriger avant de brancher une UI dessus) ;
--   2. ajoute les policies update/delete qui manquaient entièrement (règle
--      "auteur du post ou admin", comme documents/incidents) ;
--   3. ajoute une colonne updated_at (utile si un post est modifié après
--      coup) ;
--   4. crée house_log_photos, table des photos attachées à un post, avec
--      les mêmes règles "auteur du post ou admin" ;
--   5. crée le bucket de Storage PRIVÉ "house-log" (même principe que
--      migration_documents_storage.sql : lecture via URLs signées générées
--      côté serveur, jamais d'URL publique) — chemin de fichier attendu :
--      "<house_log.id>/<uuid>.<ext>".

-- 1. house_log : resserrer la lecture à admin/family
drop policy if exists "house_log_select" on public.house_log;
create policy "house_log_select" on public.house_log for select to authenticated using (
  public.get_user_role(auth.uid()) in ('admin', 'family')
);

-- 2. house_log : update/delete — auteur du post ou admin
alter table public.house_log add column if not exists updated_at timestamptz default now();

drop policy if exists "house_log_update_own_or_admin" on public.house_log;
create policy "house_log_update_own_or_admin" on public.house_log for update to authenticated using (
  created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin'
);

drop policy if exists "house_log_delete_own_or_admin" on public.house_log;
create policy "house_log_delete_own_or_admin" on public.house_log for delete to authenticated using (
  created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin'
);

-- 3. house_log_photos : photos attachées à un post
create table if not exists public.house_log_photos (
  id uuid default uuid_generate_v4() primary key,
  house_log_id uuid not null references public.house_log(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table public.house_log_photos enable row level security;

drop policy if exists "house_log_photos_select" on public.house_log_photos;
create policy "house_log_photos_select" on public.house_log_photos for select to authenticated using (
  public.get_user_role(auth.uid()) in ('admin', 'family')
);

-- Écriture (ajout/suppression de photos) : réservée à l'auteur du post
-- parent ou à un admin — même logique que l'édition du texte du post
-- ("les posts faits par d'autres membres ne sont éditables ou
-- supprimables que par les admins").
drop policy if exists "house_log_photos_write_own_or_admin" on public.house_log_photos;
create policy "house_log_photos_write_own_or_admin" on public.house_log_photos for all to authenticated using (
  exists (
    select 1 from public.house_log
    where house_log.id = house_log_photos.house_log_id
      and (house_log.created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin')
  )
) with check (
  exists (
    select 1 from public.house_log
    where house_log.id = house_log_photos.house_log_id
      and (house_log.created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin')
  )
);

-- 4. Bucket de Storage privé "house-log"
insert into storage.buckets (id, name, public)
values ('house-log', 'house-log', false)
on conflict (id) do update set public = false;

drop policy if exists "house_log_storage_select" on storage.objects;
create policy "house_log_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'house-log'
  and public.get_user_role(auth.uid()) in ('admin', 'family')
);

-- Écriture Storage : même règle "auteur du post ou admin", en retrouvant le
-- post via le premier segment du chemin ("<house_log.id>/...").
drop policy if exists "house_log_storage_write_own_or_admin" on storage.objects;
create policy "house_log_storage_write_own_or_admin" on storage.objects
for all to authenticated
using (
  bucket_id = 'house-log'
  and exists (
    select 1 from public.house_log
    where house_log.id::text = (storage.foldername(name))[1]
      and (house_log.created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin')
  )
)
with check (
  bucket_id = 'house-log'
  and exists (
    select 1 from public.house_log
    where house_log.id::text = (storage.foldername(name))[1]
      and (house_log.created_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin')
  )
);
