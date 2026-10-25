-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Demande d'Aurelie le 25/10/2026 : "il faut que le widget 'entretien et
-- reparations' soit accessible aussi aux comptes famille. il faut que
-- dans la liste des taches, chacun puisse editer/corriger la ligne qu'il
-- a rentre. Et il faut que les admins, puisse corriger chaque ligne si
-- ils le souhaitent".
--
-- L'onglet "Entretien" (dashboard/taches/page.tsx) autorisait deja les
-- comptes famille a OUVRIR la page (role admin/family) et le code de
-- TasksBoard.tsx/api/tasks/route.ts n'a jamais reserve l'ajout/la coche
-- aux seuls admins cote applicatif (voir le commentaire en tete de
-- route.ts : "le PATCH (coche) n'a volontairement pas de verification de
-- role ici"). Mais verifie en base le 25/10/2026 (pg_policies) : la table
-- `tasks` n'a en realite que deux policies, `tasks_select` (lecture
-- ouverte a tous) et `tasks_admin` (ALL, admin uniquement) -- AUCUNE
-- policy ne permettait donc reellement a un compte famille d'ajouter ou
-- de modifier une tache, malgre l'intention affichee dans le code. Cette
-- migration ajoute les deux policies manquantes, sur le meme modele que
-- `task_notes_insert`/`task_notes_delete` (migration_task_notes_contacts.sql) :
-- famille autorisee a creer une tache, et a modifier UNIQUEMENT celles
-- qu'elle a elle-meme creees (created_by = auth.uid()) -- les admins
-- gardent la possibilite de tout modifier via la policy `tasks_admin`
-- (ALL) deja existante, inchangee par cette migration. La suppression
-- reste reservee aux admins (verification explicite dans le DELETE de
-- /api/tasks/route.ts, non touchee par cette migration non plus --
-- Aurelie n'a pas demande a changer ce point).
--
-- `tasks` n'a pas de colonne `user_id` (contrairement a `task_notes`) :
-- la colonne existante `created_by` joue ce role ici.

create policy "tasks_family_insert" on public.tasks for insert to authenticated with check (
  get_user_role(auth.uid()) = 'family'
);

create policy "tasks_family_update_own" on public.tasks for update to authenticated using (
  created_by = auth.uid() and get_user_role(auth.uid()) = 'family'
);
