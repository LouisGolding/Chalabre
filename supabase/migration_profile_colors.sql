-- ============================================================
-- MIGRATION : couleur persistée par personne (profiles.color_hue)
-- À appliquer dans Supabase → SQL Editor, après schema.sql,
-- migration_auth_fix.sql et les migrations déjà en place.
-- ============================================================
--
-- Contexte : Nicolas a demandé, le 19/09/2026, que chaque personne ait
-- toujours la même couleur sur le planning (et ailleurs plus tard), au
-- lieu d'une couleur piochée selon l'ordre d'apparition dans la période
-- affichée (donc instable d'une semaine/mois à l'autre). La couleur est
-- calculée une fois, à l'inscription, et enregistrée ici — voir
-- src/lib/colors.ts pour la formule (angle d'or, même calcul des deux
-- côtés). Pour les accompagnants sans compte (ex. enfants), voir la
-- migration séparée migration_guest_people.sql.
--
-- ⚠️ RÉÉCRITE LE 19/09/2026 (audit Louis/Claude) : la première version de
-- ce fichier redéfinissait handle_new_user() en copiant l'ANCIENNE version
-- de schema.sql — celle d'avant migration_auth_fix.sql. L'appliquer aurait
-- silencieusement réintroduit les trois bugs corrigés en septembre :
-- comptes Google créés avec noms vides, date de naissance = jour de
-- l'inscription (donc facturés au tarif enfant), et rôle 'family' attribué
-- à tort aux invités. La version ci-dessous part de la version corrigée
-- (migration_auth_fix.sql) et ne fait qu'y AJOUTER le calcul de color_hue.
-- Règle générale : ne jamais copier handle_new_user depuis schema.sql ;
-- la version qui fait foi est la dernière migration qui la redéfinit.

alter table public.profiles
  add column if not exists color_hue double precision;

-- Attribution rétroactive pour les comptes déjà inscrits, dans l'ordre de
-- création (created_at), avec la même formule que src/lib/colors.ts :
-- hue = 60 + ((rang * 0.6180339887498949 * 260) mod 260)
with ranked as (
  select
    id,
    row_number() over (order by created_at) - 1 as idx
  from public.profiles
  where color_hue is null
),
computed as (
  select
    id,
    (idx * 0.6180339887498949 * 260) as raw_offset
  from ranked
)
update public.profiles p
set color_hue = 60 + (c.raw_offset - 260 * floor(c.raw_offset / 260))
from computed c
where c.id = p.id;

alter table public.profiles
  alter column color_hue set not null;

-- Version corrigée (migration_auth_fix.sql) + color_hue. Trois propriétés
-- à préserver impérativement à chaque future modification :
--   1. lecture des champs Google (full_name/given_name/family_name/picture),
--      pas seulement ceux du formulaire e-mail ;
--   2. date de naissance inconnue → sentinelle 1900-01-01 (adulte), jamais
--      now()::date ;
--   3. un échec du insert ne bloque JAMAIS la création du compte
--      (warning seulement).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
  v_first_name text;
  v_last_name text;
  v_family_group text;
  next_idx integer;
  raw_offset double precision;
  hue double precision;
begin
  v_first_name := coalesce(
    nullif(meta->>'first_name', ''),
    nullif(meta->>'given_name', ''),
    nullif(split_part(full_name, ' ', 1), ''),
    ''
  );

  v_last_name := coalesce(
    nullif(meta->>'last_name', ''),
    nullif(meta->>'family_name', ''),
    nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''),
    ''
  );

  -- Anything other than the two family groups is a friend.
  v_family_group := case
    when meta->>'family_group' in ('lalande', 'canat') then meta->>'family_group'
    else 'friend'
  end;

  -- Couleur stable, attribuée une fois pour toutes à l'inscription
  -- (même formule que src/lib/colors.ts).
  select count(*) into next_idx from public.profiles;
  raw_offset := next_idx * 0.6180339887498949 * 260;
  hue := 60 + (raw_offset - 260 * floor(raw_offset / 260));

  begin
    insert into public.profiles (
      id, email, first_name, last_name, date_of_birth, family_group, role, avatar_url, color_hue
    )
    values (
      new.id,
      coalesce(new.email, meta->>'email'),
      v_first_name,
      v_last_name,
      -- No birth date from an OAuth provider. 1900 reads as an adult, so the
      -- booking rate defaults to the full price rather than the child price.
      coalesce(nullif(meta->>'date_of_birth', '')::date, date '1900-01-01'),
      v_family_group,
      case when v_family_group = 'friend' then 'friend' else 'family' end,
      coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', '')),
      hue
    )
    on conflict (id) do nothing;
  exception when others then
    -- Never block account creation on a profile write; the dashboard shows a
    -- "profil introuvable" screen instead of a broken signup.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
