-- ✅ CONFIRMÉE APPLIQUÉE EN BASE (vérifié directement en lecture seule
-- le 25/10/2026, table/colonne/contrainte/policies déjà présentes --
-- date d'application réelle inconnue, ni Claude ni ce document ne l'ont
-- vue passer : appliquée hors du circuit habituel, probablement
-- directement par Louis). Conservée telle quelle pour l'historique, y
-- compris la mention "NE PAS APPLIQUER SANS L'ACCORD DE LOUIS"
-- ci-dessous : ne plus la rejouer.

-- ============================================================
-- MIGRATION : likes et commentaires sur les posts "Réalisations"
-- À appliquer dans Supabase → SQL Editor, après schema.sql,
-- migration_house_log_realisations.sql et migration_house_log_title.sql.
-- Rejouable sans risque.
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
-- ============================================================
--
-- Contexte : Aurélie a demandé, le 19/10/2026, de pouvoir "liker" et
-- commenter chaque post de l'onglet "Réalisations", à la manière
-- d'Instagram. Deux nouvelles tables, même principe d'accès que
-- house_log lui-même (réservé aux membres de la famille -- admin et
-- family, jamais les amis, voir house_log_select) :
--
--   - house_log_likes : une ligne par (post, personne) qui a "liké" --
--     contrainte unique pour qu'on ne puisse pas liker deux fois le
--     même post, et pour que "j'aime / je n'aime plus" se résume à
--     insérer ou supprimer sa propre ligne (pas de colonne "liked" à
--     mettre à jour).
--   - house_log_comments : un commentaire texte libre par ligne,
--     auteur et date, jamais d'édition prévue (comme Instagram) --
--     seule la suppression existe, par son auteur ou un admin, même
--     règle que pour les posts eux-mêmes et leurs photos.
--
-- Les deux tables suppriment leurs lignes en cascade si le post
-- (house_log) ou le compte (profiles) correspondant est supprimé.

create table if not exists public.house_log_likes (
  id uuid default uuid_generate_v4() primary key,
  house_log_id uuid not null references public.house_log(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (house_log_id, user_id)
);

create table if not exists public.house_log_comments (
  id uuid default uuid_generate_v4() primary key,
  house_log_id uuid not null references public.house_log(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.house_log_likes enable row level security;
alter table public.house_log_comments enable row level security;

-- Lecture : mêmes comptes que house_log_select (admin + family).
drop policy if exists "house_log_likes_select" on public.house_log_likes;
create policy "house_log_likes_select" on public.house_log_likes for select to authenticated using (
  public.get_user_role(auth.uid()) in ('admin', 'family')
);

drop policy if exists "house_log_comments_select" on public.house_log_comments;
create policy "house_log_comments_select" on public.house_log_comments for select to authenticated using (
  public.get_user_role(auth.uid()) in ('admin', 'family')
);

-- Likes : on ne peut liker qu'en son propre nom (user_id = auth.uid()),
-- et seulement avec un rôle autorisé à voir l'onglet. Un "j'aime" se
-- retire en supprimant sa propre ligne (ou par un admin, en
-- modération) -- jamais de mise à jour.
drop policy if exists "house_log_likes_insert" on public.house_log_likes;
create policy "house_log_likes_insert" on public.house_log_likes for insert to authenticated with check (
  user_id = auth.uid() and public.get_user_role(auth.uid()) in ('admin', 'family')
);

drop policy if exists "house_log_likes_delete" on public.house_log_likes;
create policy "house_log_likes_delete" on public.house_log_likes for delete to authenticated using (
  user_id = auth.uid() or public.get_user_role(auth.uid()) = 'admin'
);

-- Commentaires : même principe que les posts eux-mêmes -- on écrit en
-- son propre nom, on supprime le sien ou, pour un admin, n'importe
-- lequel (modération). Pas de policy update : un commentaire ne
-- s'édite pas, comme sur Instagram.
drop policy if exists "house_log_comments_insert" on public.house_log_comments;
create policy "house_log_comments_insert" on public.house_log_comments for insert to authenticated with check (
  user_id = auth.uid() and public.get_user_role(auth.uid()) in ('admin', 'family')
);

drop policy if exists "house_log_comments_delete" on public.house_log_comments;
create policy "house_log_comments_delete" on public.house_log_comments for delete to authenticated using (
  user_id = auth.uid() or public.get_user_role(auth.uid()) = 'admin'
);

comment on table public.house_log_likes is
  'Un "j''aime" par (post, personne) sur un post de "Réalisations". Unique par post+personne.';
comment on table public.house_log_comments is
  'Commentaires texte libre sur un post de "Réalisations", à la manière d''Instagram -- pas d''édition, suppression par l''auteur ou un admin.';
