-- ============================================================
-- MIGRATION : onglet "Activités" (événements locaux à Chalabre et
-- alentours), à usage interne — à ne pas confondre avec la table
-- `events` déjà existante (événements internes à la maison : séjours
-- famille/amis, entretien, jardinier...).
-- A appliquer dans Supabase -> SQL Editor, apres schema.sql et les
-- migrations deja en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a discuté avec Louis le 08/10/2026 du principe de
-- l'onglet "Activités" (voir claude/prompt-onglet-evenements.md) :
-- Nicolas colle en vrac un texte (affiche, programme, bulletin
-- municipal...) listant des événements locaux, une IA (API Anthropic,
-- clé encore à mettre en place côté Louis) en extrait une liste
-- structurée, qu'un admin relit/corrige avant d'enregistrer. L'onglet
-- est réservé aux comptes admin dans son intégralité (page, pas
-- seulement les actions d'écriture) ; un widget "Aujourd'hui"/"Demain"
-- sur l'accueil (déjà prévu dans dashboard/page.tsx) reste lui visible
-- de tous les comptes connectés.
--
-- `source_text` conserve le texte brut collé à l'origine de chaque
-- événement, pour permettre de retrouver le contexte/la source en cas de
-- doute lors d'une relecture ultérieure.
--
-- `event_time` est un texte libre (et non un type `time`) car le texte
-- collé ne donne pas toujours une heure au format strict ("en soirée",
-- "à partir de 10h") -- l'IA d'extraction est invitée à recopier la
-- formulation la plus proche du texte source plutôt qu'à deviner un
-- horaire précis.
--
-- `category` : liste fermée (cohérente avec le reste du site -- voir
-- `contacts`/`documents` qui suivent la même convention de check
-- constraint), à ajuster avec Nicolas/Louis si besoin : la session de
-- test démarre avec cette liste par défaut plutôt que d'attendre une
-- validation qui bloquerait le début du test.

create table if not exists public.local_events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  event_date date not null,
  event_end_date date,
  event_time text,
  location text,
  category text not null default 'autre' check (
    category in ('marche', 'brocante', 'fete', 'concert', 'sport', 'autre')
  ),
  source_text text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.local_events enable row level security;

-- Onglet intégralement réservé aux admins (page + actions) : la lecture
-- "grand public" (widget Aujourd'hui/Demain de l'accueil) ne passe pas
-- par une policy RLS mais par une route serveur dédiée utilisant le
-- client service-role (src/lib/supabase/admin.ts, même principe que le
-- webhook Stripe), qui ne renvoie que le strict nécessaire (titre, date,
-- horaire, lieu, catégorie) pour les événements d'aujourd'hui/demain --
-- jamais `source_text` ni `created_by`. Cela évite d'ouvrir la lecture de
-- toute la table à tous les comptes, y compris les amis.
create policy "local_events_select_admin" on public.local_events
  for select to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "local_events_insert_admin" on public.local_events
  for insert to authenticated with check (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "local_events_update_admin" on public.local_events
  for update to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "local_events_delete_admin" on public.local_events
  for delete to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create index if not exists local_events_event_date_idx on public.local_events (event_date);
