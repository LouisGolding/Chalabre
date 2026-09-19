-- ============================================================
-- MIGRATION : cotisation mensuelle (TM) modifiable par le membre lui-même
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place (migration_auth_fix.sql, migration_view_security.sql,
-- migration_tm_amount_libre.sql, migration_guest_bookings.sql, etc.)
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : migration_auth_fix.sql a délibérément verrouillé tm_tier pour
-- qu'un membre ordinaire ne puisse jamais changer sa propre cotisation,
-- même en cas de bug côté client — seul un admin le pouvait, "exactement
-- comme prévu par Louis" (voir commentaire de protect_profile_privileges()
-- et de EditableTmTier.tsx).
--
-- Aurélie a demandé, le 17/09/2026, que la pastille "Cotisation mensuelle"
-- du tableau de bord devienne éditable par le membre concerné lui-même
-- (uniquement les membres de la famille, pas les amis — la pastille ne
-- s'affiche déjà que pour eux). Cette migration assouplit donc le verrou
-- de base UNIQUEMENT pour ce cas précis : un membre non-ami modifiant sa
-- propre ligne. Un admin garde tous ses droits comme avant. Le rôle
-- (role) et le groupe familial restent verrouillés, seul tm_tier change.
--
-- Si tu préfères garder le fonctionnement d'origine (admin uniquement),
-- ne l'applique pas : la route API et le composant CotisationPill
-- resteront sans effet réel en production (l'ancien trigger continuera
-- à annuler silencieusement le changement), sans rien casser d'autre.

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  -- No JWT: the SQL editor, or the service-role key. Unrestricted, which is
  -- what makes the "promote yourself to admin" statement in the README work.
  if caller is null then
    return new;
  end if;

  -- Admins manage roles and contribution tiers, including their own.
  if public.get_user_role(caller) = 'admin' then
    return new;
  end if;

  -- Ordinary members from here down.
  --
  -- A non-friend member editing their OWN row may now set their own
  -- tm_tier (the dashboard's editable "Cotisation mensuelle" pill) — but
  -- only their own, and only if they aren't a friend (friends never pay
  -- a monthly contribution and never see this control).
  if not (caller = new.id and old.role <> 'friend') then
    new.tm_tier := old.tm_tier;   -- otherwise, still an admin's call only
  end if;

  if old.role = 'admin' then
    new.role := 'admin';        -- an admin never loses the role this way
  else
    new.role := case
      when new.family_group = 'friend' then 'friend'
      else 'family'
    end;
  end if;

  return new;
end;
$$;

-- Le trigger existant pointe déjà vers cette fonction (create or replace
-- suffit, pas besoin de le recréer) :
-- drop trigger if exists profiles_protect_privileges on public.profiles;
-- create trigger profiles_protect_privileges
--   before update on public.profiles
--   for each row execute function public.protect_profile_privileges();
