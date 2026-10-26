-- ============================================================
-- MIGRATION : qui a coché une tâche (tasks.completed_by)
-- Appliquée directement en production le 26/10/2026 (Supabase MCP) --
-- ce fichier n'est qu'une trace dans le dépôt, déjà en place en base.
-- ============================================================
--
-- Contexte (demandé par Aurélie le 26/10/2026) : nouveau widget
-- "Tâches réalisées" (voir TasksBoard.tsx) -- une tâche cochée y
-- affiche désormais "Fait le <date> par <profil>" à la place des
-- pastilles "Contact"/"Suivi". Il manquait jusqu'ici une trace de QUI
-- a coché la tâche (seul completed_at, la date, existait).
--
-- NULL pour toutes les tâches déjà existantes (y compris déjà
-- cochées) au moment de la migration -- "Fait le ... par ..."
-- n'affichera donc le nom qu'à partir de la prochaine fois où
-- chacune sera décochée puis recochée.
alter table public.tasks
  add column if not exists completed_by uuid references public.profiles(id) on delete set null;

comment on column public.tasks.completed_by is 'Compte ayant coché la tâche comme réalisée (affiché "Fait le ... par ..." dans Entretien) -- NULL si jamais cochée ou décochée depuis. Demandé par Aurélie le 26/10/2026.';
