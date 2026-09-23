-- Ajout de la catégorie "manutention" pour les tâches.
-- NE PAS APPLIQUER SANS L'ACCORD DE LOUIS.
-- À exécuter dans Supabase > SQL Editor.

alter table public.tasks drop constraint if exists tasks_category_check;

alter table public.tasks add constraint tasks_category_check
  check (category in ('entretien', 'reparation', 'manutention', 'autre'));
