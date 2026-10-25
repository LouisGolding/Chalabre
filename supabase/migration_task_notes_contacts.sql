-- ✅ CONFIRMÉE APPLIQUÉE EN BASE (vérifié directement en lecture seule
-- le 25/10/2026, table/colonne/contrainte/policies déjà présentes --
-- date d'application réelle inconnue, ni Claude ni ce document ne l'ont
-- vue passer : appliquée hors du circuit habituel, probablement
-- directement par Louis). Conservée telle quelle pour l'historique, y
-- compris la mention "NE PAS APPLIQUER SANS L'ACCORD DE LOUIS"
-- ci-dessous : ne plus la rejouer.

-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Demandé par Aurélie le 19/10/2026 : sur chaque tâche de l'onglet
-- "Entretien", pouvoir (1) tenir un suivi dans le temps (plusieurs notes
-- datées, par ex. "RDV pris pour le 25/10"), chacune pouvant porter une
-- date de rendez-vous -- dès qu'elle tombe à moins de 30 jours, le
-- rendez-vous apparaît sur la page d'accueil -- et (2) associer à la
-- tâche un ou plusieurs contacts déjà enregistrés dans Contacts →
-- Services (plombier, électricien, jardinier...). Maquette validée le
-- 19/10/2026 (Artifact "Entretien — Suivi & Contact").
--
-- Remplace l'ancien champ unique `tasks.comment` (une seule note,
-- proposée uniquement à la coche) -- décision d'Aurélie du 19/10/2026.
-- La colonne `comment` n'est PAS supprimée par cette migration (aucune
-- perte de données, et une suppression de colonne est plus délicate à
-- annuler) : elle devient simplement inutilisée côté application.

create table if not exists public.task_notes (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  -- Date de rendez-vous facultative portée par la note (ex. RDV artisan).
  -- Voir dashboard/page.tsx : la note la plus récente de chaque tâche
  -- portant une rdv_date à moins de 30 jours alimente le widget d'accueil
  -- "RDV à venir".
  rdv_date date,
  created_at timestamptz not null default now()
);

create index if not exists task_notes_task_id_idx on public.task_notes(task_id);
-- Sert au widget d'accueil : retrouver vite la note la plus récente par
-- tâche parmi celles qui portent une date de RDV.
create index if not exists task_notes_rdv_date_idx on public.task_notes(rdv_date) where rdv_date is not null;

-- Liaison tâche <-> contact (plusieurs contacts possibles par tâche,
-- confirmé par Aurélie le 19/10/2026).
create table if not exists public.task_contacts (
  task_id uuid not null references public.tasks(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (task_id, contact_id)
);

alter table public.task_notes enable row level security;
alter table public.task_contacts enable row level security;

-- Même périmètre que l'onglet "Entretien" lui-même (admin + famille,
-- jamais les amis -- voir dashboard/taches/page.tsx) : contrairement à
-- `tasks_select` (ouverte à tous les comptes authentifiés), ces deux
-- tables sont explicitement fermées aux "friend".
create policy "task_notes_select" on public.task_notes for select to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);
-- Ajouter une note : ouvert à la famille (pas réservé aux admins, confirmé
-- par Aurélie le 19/10/2026 -- comme cocher une tâche aujourd'hui).
create policy "task_notes_insert" on public.task_notes for insert to authenticated with check (
  user_id = auth.uid() and get_user_role(auth.uid()) in ('admin', 'family')
);
-- Append-only comme les commentaires de Réalisations (pas de policy
-- update) : une note publiée ne se corrige pas, seulement supprimable par
-- son auteur ou un admin.
create policy "task_notes_delete" on public.task_notes for delete to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) = 'admin'
);

create policy "task_contacts_select" on public.task_contacts for select to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);
-- Associer/retirer un contact : même ouverture que les notes (admin +
-- famille), pas de notion de "propriétaire" ici (c'est une simple
-- étiquette sur la tâche, pas un contenu personnel).
create policy "task_contacts_insert" on public.task_contacts for insert to authenticated with check (
  get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "task_contacts_delete" on public.task_contacts for delete to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);
