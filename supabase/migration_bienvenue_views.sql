-- ============================================================
-- MIGRATION : compteur de vues des vidéos tutoriel ("/bienvenue")
-- Appliquée directement en production le 27/10/2026 (Supabase MCP) --
-- ce fichier n'est qu'une trace dans le dépôt, déjà en place en base.
-- ============================================================
--
-- Contexte (demandé par Aurélie le 27/10/2026) : la page /bienvenue
-- (public/bienvenue/index.html) est un lien unique, anonyme, envoyé à
-- toute la famille avant même qu'elle ait un compte -- impossible de
-- savoir qui regarde. Après discussion, Aurélie a choisi de ne PAS
-- identifier les personnes (ni prénom demandé, ni lien personnalisé) :
-- seulement compter le nombre de vues par chapitre.
--
-- Une ligne par événement ("start" = chapitre ouvert, "end" = vidéo
-- regardée jusqu'au bout), écrite par le JS de la page statique via
-- POST /api/bienvenue-view (route publique, sans session -- voir cette
-- route). Lecture réservée aux admins, qui la consultent depuis un
-- nouveau widget sur l'onglet "Gestion" (voir IncidentsHistory.tsx pour
-- le même principe de widget déroulant "barres").
create table public.bienvenue_views (
  id uuid default uuid_generate_v4() primary key,
  chapter_id text not null check (chapter_id in (
    'premiers-pas', 'reserver', 'accompagnant', 'calendrier', 'guide',
    'urgences', 'contacts', 'realisations', 'entretien', 'budget'
  )),
  event text not null check (event in ('start', 'end')),
  created_at timestamptz default now()
);

alter table public.bienvenue_views enable row level security;

-- `anon` (pas de session, visiteur pas encore inscrit) ET `authenticated`
-- (quelqu'un qui revoit un tutoriel une fois son compte créé) peuvent
-- tous les deux écrire -- aucune donnée personnelle, juste un compteur.
create policy "bienvenue_views_insert_anyone" on public.bienvenue_views
for insert to anon, authenticated
with check (true);

create policy "bienvenue_views_select_admin" on public.bienvenue_views
for select to authenticated
using (public.get_user_role(auth.uid()) = 'admin');
