-- ============================================================
-- MIGRATION : couleur persistée par personne (profiles.color_hue)
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé, le 19/09/2026, que chaque personne ait
-- toujours la même couleur sur le planning (et ailleurs plus tard), au
-- lieu d'une couleur piochée selon l'ordre d'apparition dans la période
-- affichée (donc instable d'une semaine/mois à l'autre). La couleur est
-- désormais calculée une fois, à l'inscription, et enregistrée ici — voir
-- src/lib/colors.ts pour la formule (angle d'or, même calcul des deux
-- côtés). Pour les accompagnants sans compte (ex. enfants), voir la
-- migration séparée migration_guest_people.sql.
--
-- Pour l'instant, tout le monde partage un même grand arc pastel du
-- cercle chromatique (voir ACTIVE_HUE_RANGE dans src/lib/colors.ts). Le
-- jour où la répartition par famille (Lalande / Canat / amis) sera
-- activée, une nouvelle migration de recalcul (par family_group cette
-- fois) sera nécessaire pour les comptes déjà inscrits.

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

-- Le trigger de création de compte (handle_new_user, dans schema.sql)
-- calcule désormais aussi color_hue au moment de l'inscription, avec la
-- même formule, à partir du nombre de comptes déjà existants. On le
-- redéfinit entièrement ici (CREATE OR REPLACE remplace proprement
-- l'ancienne version).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  next_idx integer;
  raw_offset double precision;
  hue double precision;
begin
  select count(*) into next_idx from public.profiles;
  raw_offset := next_idx * 0.6180339887498949 * 260;
  hue := 60 + (raw_offset - 260 * floor(raw_offset / 260));

  insert into public.profiles (id, email, first_name, last_name, date_of_birth, family_group, role, color_hue)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'date_of_birth')::date, now()::date),
    coalesce(new.raw_user_meta_data->>'family_group', 'friend'),
    case
      when new.raw_user_meta_data->>'family_group' = 'friend' then 'friend'
      else 'family'
    end,
    hue
  );
  return new;
end;
$$ language plpgsql security definer;
