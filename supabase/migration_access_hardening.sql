-- ============================================================
-- MIGRATION: tighten read access on documents / payment_events to
-- match their actual admin-only pages
-- Already applied directly (demande explicite de Nicolas, audit
-- pré-lancement du 18/10/2026 -- voir claude/audit-pre-lancement.md).
-- Safe to re-run.
-- ============================================================
--
-- /dashboard/documents et /dashboard/admin/paiements redirigent déjà tout
-- compte non-admin (voir leurs page.tsx : "role !== 'admin' -> redirect"),
-- mais les policies RLS ci-dessous étaient restées plus permissives
-- (admin + family), un reliquat d'une étape précédente du projet où ces
-- pages étaient encore ouvertes à "family". Rien ne les exploitait dans
-- le code actuel (aucun composant client ne requête ces tables en dehors
-- de ces deux pages, déjà protégées), mais la base restait plus
-- permissive que l'intention réelle du produit -- resserré ici pour que
-- les deux niveaux (page + base) soient cohérents.
--
-- Ne touche PAS à la table `events` (utilisée par Planning, ouverte à
-- tous les comptes -- c'est voulu, Planning n'a aucune restriction de
-- rôle) : à ne pas confondre avec `local_events` (future table derrière
-- "Activités", migration_local_events.sql PAS encore appliquée à ce
-- jour).

alter policy documents_select on public.documents
  using (get_user_role(auth.uid()) = 'admin');

alter policy documents_storage_select on storage.objects
  using (bucket_id = 'documents' and get_user_role(auth.uid()) = 'admin');

alter policy payment_events_admin on public.payment_events
  using (get_user_role(auth.uid()) = 'admin');

-- Nettoyage optionnel, pas encore fait (timeout répété de l'outil au
-- moment de l'audit) : documents_select est désormais entièrement
-- redondante avec documents_admin (ALL, déjà admin-only) -- à supprimer
-- quand l'occasion se présente, aucun impact fonctionnel en attendant.
-- drop policy if exists documents_select on public.documents;
