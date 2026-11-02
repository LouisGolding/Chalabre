-- 02/11/2026 -- Bug signale par Aurelie : "quand je teste le widget
-- famille, aurelie s'affiche, mais pas avec la couleur de son profil".
--
-- Cause reelle : indexForUnit()/la formule equivalente cote base
-- (handle_new_user) attribue a la toute PREMIERE unite inscrite dans
-- chaque famille (unit_count = 0) l'index de palette 0 EXACTEMENT
-- (0 * angle d'or = 0). Or l'index 0 est, dans les 3 palettes "Argile"
-- fournies par Nicolas, une teinte quasi blanc/creme (#E0DDD4 pour
-- Lalande, #E0E1DC pour Canat, #FEF0E8 pour les invites) -- visuellement
-- indiscernable du fond "papier canson" des cartes. Nicolas et Aurelie
-- (couple ancre de la famille nucleaire lal-nicolas-aurelie, premiers
-- comptes Lalande crees) avaient tous les deux herite de ce color_hue=0,
-- tout comme Louis Golding (premier compte Canat) et Marius Kronenwett
-- (premier invite) -- le bug touche en realite le "premier de chaque
-- famille", pas seulement Aurelie.
--
-- Correctif applique directement via Supabase MCP le 02/11/2026 (ce
-- fichier documente la migration pour le depot, comme les autres
-- fichiers supabase/migration_*.sql) :
-- 1) handle_new_user() decale sa formule d'un cran (unit_count + 1 au
--    lieu de unit_count) : le premier inscrit d'une famille tombe
--    desormais sur l'index ~30 (une vraie teinte) plutot que 0. Les
--    repartitions suivantes gardent le meme espacement "angle d'or",
--    seul le point de depart change -- aucun impact sur les couleurs
--    deja attribuees aux comptes suivants. Meme correctif applique cote
--    JS dans indexForUnit() (src/lib/colors.ts).
-- 2) Rattrapage ponctuel des 4 comptes deja coinces sur color_hue=0 : on
--    leur applique directement la valeur que la formule corrigee leur
--    aurait donnee (unit_count=0 -> index 30), puisqu'ils etaient
--    chacun effectivement le tout premier compte de leur famille au
--    moment de leur inscription.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
  v_first_name text;
  v_last_name text;
  v_family_group text;
  v_nuclear_family text;
  v_anchor_hue double precision;
  unit_count integer;
  raw_offset double precision;
  v_color_index double precision;
  v_old_id uuid;
  v_old_dob date;
  v_old_color_hue double precision;
  v_dob date;
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

  v_family_group := case
    when meta->>'family_group' in ('lalande', 'canat') then meta->>'family_group'
    else 'friend'
  end;

  v_nuclear_family := public._nuclear_family_lookup(v_family_group, v_first_name);

  if v_nuclear_family is not null then
    select id, date_of_birth, color_hue
      into v_old_id, v_old_dob, v_old_color_hue
    from public.profiles
    where has_login = false
      and family_group = v_family_group
      and nuclear_family = v_nuclear_family
      and lower(btrim(first_name)) = lower(btrim(v_first_name))
    limit 1;
  end if;

  if v_old_id is not null then
    v_color_index := v_old_color_hue;
  else
    if v_nuclear_family is not null then
      select color_hue into v_anchor_hue
      from public.profiles
      where family_group = v_family_group and nuclear_family = v_nuclear_family
      order by created_at asc
      limit 1;
    end if;

    if v_anchor_hue is not null then
      v_color_index := mod(
        round(v_anchor_hue)::int
          + round(((abs(mod(hashtext(lower(btrim(v_first_name || ' ' || v_last_name)))::bigint, 2000))) / 1000.0 - 1) * 3)::int
          + 50,
        50
      );
    else
      -- Correctif du 02/11/2026 : "+ 1" ajoute pour que la toute premiere
      -- unite d'une famille (unit_count = 0) ne tombe plus exactement sur
      -- l'index 0 -- une teinte quasi blanche dans les 3 palettes
      -- "Argile", indiscernable du fond papier des cartes.
      select count(distinct coalesce(nuclear_family, id::text)) into unit_count
      from public.profiles
      where family_group = v_family_group;

      raw_offset := (coalesce(unit_count, 0) + 1) * 0.6180339887498949 * 50;
      v_color_index := floor(raw_offset - 50 * floor(raw_offset / 50));
    end if;
  end if;

  v_dob := coalesce(
    nullif(meta->>'date_of_birth', '')::date,
    case when v_old_dob is not null and v_old_dob <> date '1900-01-01' then v_old_dob end,
    date '1900-01-01'
  );

  begin
    insert into public.profiles (
      id, email, first_name, last_name, date_of_birth, family_group, role, avatar_url, color_hue, nuclear_family
    )
    values (
      new.id,
      coalesce(new.email, meta->>'email'),
      v_first_name,
      v_last_name,
      v_dob,
      v_family_group,
      case when v_family_group = 'friend' then 'friend' else 'family' end,
      coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', '')),
      v_color_index,
      v_nuclear_family
    )
    on conflict (id) do nothing;

    if found and v_old_id is not null then
      delete from public.profiles where id = v_old_id and has_login = false;
    end if;
  exception when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$;

-- Rattrapage des 4 comptes deja coinces sur l'index 0 (teinte quasi
-- blanche) : Nicolas + Aurelie (ancres Lalande), Louis Golding (ancre
-- Canat), Marius Kronenwett (ancre invites/friend).
update public.profiles
set color_hue = 30
where color_hue = 0;
