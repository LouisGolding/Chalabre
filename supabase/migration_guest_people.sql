-- ============================================================
-- MIGRATION : mémoire des accompagnants sans compte (guest_people)
-- À appliquer dans Supabase → SQL Editor, après schema.sql,
-- migration_guest_bookings.sql et migration_profile_colors.sql.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé, le 19/09/2026, que les personnes saisies
-- comme accompagnant d'un séjour (champ guest_name du widget "Prochain
-- séjour", ex. leur fils Otto qui n'a pas de compte) gardent toujours la
-- même couleur d'un séjour à l'autre. Comme guest_name n'est que du texte
-- libre, rien ne permettait jusqu'ici de relier deux séjours au même
-- accompagnant. Cette table sert de mémoire minimale : un nom complet, une
-- couleur attribuée une seule fois (proche de celle de la personne qui a
-- saisi le tout premier séjour — voir src/lib/colors.ts, nearbyHue), et on
-- s'y réfère ensuite par correspondance exacte du nom. Nicolas a confirmé
-- qu'une correspondance exacte suffit (le nom et prénom complets sont
-- toujours saisis, donc pas de risque réel d'homonymie).
--
-- Si un accompagnant a en réalité déjà un compte (cas d'un enfant inscrit,
-- dont un parent saisit et paie les séjours) et que le nom saisi
-- correspond à un profil existant, aucune entrée n'est créée ici : la
-- couleur du profil existant est utilisée directement (résolu côté
-- application, voir src/app/api/bookings/quick/route.ts).

create table if not exists public.guest_people (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color_hue double precision not null,
  family_group text check (family_group in ('lalande', 'canat', 'friend')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Un seul enregistrement par nom (comparaison insensible à la casse et
-- aux espaces superflus), pour ne jamais dupliquer la même personne.
create unique index if not exists guest_people_name_key
  on public.guest_people (lower(btrim(name)));

alter table public.guest_people enable row level security;

-- Même logique d'accès que les séjours : tout le monde peut lire (pour
-- afficher les couleurs sur le planning), famille/admin/amis peuvent créer
-- une nouvelle entrée (au moment où ils saisissent un séjour pour un
-- nouvel accompagnant). Pas de update/delete depuis l'app : une couleur,
-- une fois attribuée, ne change plus.
create policy "guest_people_select" on public.guest_people for select to authenticated using (true);
create policy "guest_people_insert" on public.guest_people for insert to authenticated with check (
  get_user_role(auth.uid()) in ('admin', 'family', 'friend')
);
