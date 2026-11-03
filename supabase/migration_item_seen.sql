-- ============================================================
-- Table item_seen : pastilles de nouveauté par profil (Entretien +
-- Réalisations) -- demande de Nicolas (maquette "notification",
-- Artifact validé le 03/11/2026 : "le chiffre aligné de la proposition
-- B, coloré selon le profil de la personne" sur les tuiles Accueil, et
-- "la bande d'accent et le fond teinté de la proposition D" sur les
-- lignes des widgets dépliés -- tâches et réalisations).
--
-- Suite à AskUserQuestion avec Nicolas le 03/11/2026 :
--  - Périmètre : Entretien + Réalisations uniquement.
--  - Marquage "vu" : automatique à l'ouverture de l'onglet concerné
--    (TasksBoard.tsx / RealisationsBoard.tsx), pas de bouton dédié.
--  - Son propre ajout n'est jamais "nouveau" pour soi-même (exclu côté
--    code, pas ici -- voir src/app/api/notifications/badges/route.ts).
--
-- Une ligne = (ce compte a vu cet item). Utilisée pour calculer, par
-- compte, les tâches/réalisations créées par quelqu'un d'autre et pas
-- encore vues (badge coloré sur la tuile Accueil, bande d'accent sur la
-- ligne). Appliquée directement en base via le MCP Supabase (même
-- pratique que les migrations additives récentes, ex.
-- migration_tasks_completed_by.sql) -- ce fichier n'est qu'une trace
-- dans le dépôt.
-- ============================================================

create table if not exists public.item_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'task' (Entretien) ou 'house_log' (Réalisations) -- mêmes valeurs que
  -- les tables réelles, pas de table de jointure dédiée nécessaire pour
  -- si peu de types.
  item_type text not null check (item_type in ('task', 'house_log')),
  item_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.item_seen enable row level security;

-- Chacun ne gère que ses propres lignes "vu" -- aucune notion
-- d'admin/famille/ami ici, ce n'est pas du contenu partagé.
create policy "item_seen_select" on public.item_seen for select to authenticated using (
  user_id = auth.uid()
);
create policy "item_seen_insert" on public.item_seen for insert to authenticated with check (
  user_id = auth.uid()
);

-- Backfill : tout le contenu existant au moment du lancement de la
-- fonctionnalite est marque "deja vu" par tout le monde, pour que seul
-- le contenu reellement NOUVEAU (cree apres ce backfill) declenche une
-- pastille -- sinon chaque compte verrait tout l'historique existant
-- comme "nouveau" a la premiere ouverture. Applique directement en base
-- juste apres la creation de la table (60 profils x 9 taches + 60 x 3
-- realisations au moment du backfill, 03/11/2026).
insert into public.item_seen (user_id, item_type, item_id)
select p.id, 'task', t.id
from public.profiles p
cross join public.tasks t
on conflict do nothing;

insert into public.item_seen (user_id, item_type, item_id)
select p.id, 'house_log', h.id
from public.profiles p
cross join public.house_log h
on conflict do nothing;
