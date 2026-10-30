-- Permet des fiches "membre de la famille" sans compte de connexion
-- (enfants, conjoints non inscrits sur l'app) : la fiche profiles peut
-- exister sans ligne correspondante dans auth.users. Demandé par
-- Aurélie le 30/10/2026 pour le widget "Réserver en famille" (option
-- "Famille" sur NextStayCard.tsx) : la plupart des membres de la
-- famille (notamment les enfants) n'ont pas et n'auront pas de compte
-- de connexion propre, mais ont bien leur propre fiche dans Gestion >
-- Membres, avec nom, date de naissance et rattachement à leur famille
-- nucléaire (profiles.nuclear_family).
--
-- Appliquée le 30/10/2026 (confirmation explicite d'Aurélie). Effet de
-- bord à surveiller : la suppression en cascade (ON DELETE CASCADE)
-- d'une fiche quand son compte de connexion est supprimé n'existe plus
-- -- supprimer un compte ne supprime plus automatiquement sa fiche.
--
-- Note pour Louis (Aurélie, 30/10/2026) : les adultes de la famille
-- auront in fine tous un compte de connexion propre -- quand l'un
-- d'eux s'inscrira pour de vrai, sa nouvelle inscription créera une
-- DEUXIÈME fiche (via handle_new_user()) à moins qu'on ajoute d'ici là
-- une étape de rapprochement (retrouver par nom une fiche has_login =
-- false existante et la faire pointer vers le nouveau compte plutôt que
-- d'en créer une en double) -- pas encore fait, à construire avant que
-- ça arrive.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column email drop not null;
alter table public.profiles add column has_login boolean not null default true;
alter table public.profiles add constraint profiles_has_login_email_check
  check (has_login = true or email is null);
