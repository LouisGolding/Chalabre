-- NE PAS APPLIQUER SANS L'ACCORD DE LOUIS

-- Validation manuelle des inscriptions (demandé par Aurélie le 27/10/2026) :
-- jusqu'ici, n'importe qui pouvait créer un compte via /auth/register (ou
-- "Continuer avec Google") et accéder immédiatement au tableau de bord --
-- seul le groupe familial (Lalande/Canat/invité) était choisi librement
-- dans le formulaire, sans aucune vérification que la personne appartient
-- réellement à la famille. handle_new_user() n'attribue jamais le rôle
-- 'admin' à l'inscription (voir ce trigger, migration_auth_fix.sql) --
-- le risque n'était donc pas une prise d'accès admin, mais un accès
-- "famille" (planning, budget, contacts, documents...) par n'importe qui.
--
-- Nouvelle colonne `status` : 'pending' par défaut (nouvelle inscription,
-- bloquée tant qu'un admin ne l'a pas validée, voir dashboard/layout.tsx),
-- 'active' (validée, accès normal selon le rôle), 'rejected' (refusée par
-- un admin, même blocage que 'pending' -- réversible, aucune suppression
-- de données).
alter table public.profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected'));

-- Les comptes déjà créés avant cette migration ne doivent pas se
-- retrouver bloqués du jour au lendemain : ils sont considérés déjà
-- validés d'office (tous repassent 'active' juste après avoir reçu le
-- défaut 'pending' ci-dessus).
update public.profiles set status = 'active' where status = 'pending';

-- Aucune policy RLS à ajouter : profiles_select (lecture, qual true) et
-- profiles_update_admin (écriture par un admin sur n'importe quel profil,
-- qual get_user_role(auth.uid()) = 'admin') couvrent déjà cette nouvelle
-- colonne comme n'importe quelle autre colonne de la table.
