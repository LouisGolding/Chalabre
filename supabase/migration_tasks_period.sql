-- ============================================================
-- MIGRATION : période (mois ou saison) sur les tâches
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 17/09/2026, que l'admin qui crée une
-- tâche puisse préciser à quel moment la faire (ex. "couper les têtes
-- d'hortensia" → hiver, "couper les lavandes" → août), pour que la liste
-- affiche "À faire ce mois-ci" séparément de "À faire" (sans date précise).
-- La colonne est facultative : une tâche sans période reste dans "À faire".

alter table public.tasks add column if not exists period text;

alter table public.tasks
  add constraint tasks_period_check
  check (period is null or period in (
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
    'printemps', 'ete', 'automne', 'hiver'
  ));
