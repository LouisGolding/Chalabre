-- ============================================================
-- MIGRATION : refonte de l'onglet "Entretien" (ex-"Tâches")
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place (dont migration_tasks_manutention.sql et
-- migration_tasks_period.sql).
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : refonte demandée par Nicolas le 27/09/2026. Nouvelles
-- catégories (plomberie, électricité, jardin — en plus de réparation /
-- manutention / autre déjà existants ; "entretien", l'ancienne valeur par
-- défaut, reste acceptée pour ne pas casser les lignes déjà en base, mais
-- n'est plus proposée à la création). Ajout d'une récurrence (uniquement
-- pertinente pour la catégorie "jardin"), d'un commentaire optionnel posé
-- à la clôture d'une tâche non récurrente, et de la date de clôture (pour
-- calculer l'archivage à 30 jours / la réapparition à 15 jours — voir
-- TasksBoard.tsx).

alter table public.tasks drop constraint if exists tasks_category_check;

alter table public.tasks add constraint tasks_category_check
  check (category in ('entretien', 'reparation', 'plomberie', 'electricite', 'jardin', 'manutention', 'autre'));

alter table public.tasks add column if not exists recurrence text;

alter table public.tasks
  add constraint tasks_recurrence_check
  check (recurrence is null or recurrence in ('once', 'monthly', 'yearly'));

alter table public.tasks add column if not exists completed_at timestamptz;

alter table public.tasks add column if not exists comment text;
