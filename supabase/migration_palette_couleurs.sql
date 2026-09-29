-- ============================================================
-- MIGRATION : palette de couleurs par famille (Argile) + couleurs
-- proches pour les "familles nucléaires" (profiles.nuclear_family)
-- À appliquer dans Supabase → SQL Editor, après schema.sql,
-- migration_auth_fix.sql, migration_profile_colors.sql et
-- migration_guest_people.sql.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé, le 29/09/2026, de remplacer le cercle
-- chromatique continu utilisé jusqu'ici (un angle en degrés, commun à
-- tout le monde) par une PALETTE DISCRÈTE de 50 teintes réelles PAR
-- FAMILLE, choisies dans un nuancier "Argile" qu'il a fourni en image :
-- VERT → Lalande, BLEU → Canat, ROUGE → invités (family_group = 'friend').
-- Voir l'en-tête de src/lib/colors.ts pour le détail complet (les 3
-- palettes y sont codées en dur, mêmes valeurs qu'ici).
--
-- Deuxième demande, le même jour : au sein d'un même foyer proche (une
-- "famille nucléaire", ex. Aurélie / Nicolas / Otto), les couleurs
-- doivent être PROCHES les unes des autres plutôt que maximalement
-- dispersées comme le reste de la famille élargie. Nicolas a fourni une
-- liste de familles nucléaires pour Lalande et Canat (aucune pour les
-- invités à ce jour) — reprise ci-dessous dans _nuclear_family_lookup().
--
-- ⚠️ La colonne `profiles.color_hue` GARDE SON NOM (pas de renommage,
-- pour ne pas casser une colonne déjà en production) mais contient
-- désormais un INDEX DE PALETTE (0-49) à lire conjointement avec
-- `family_group`, plus un angle en degrés — voir l'en-tête de
-- src/lib/colors.ts pour le détail. Cette migration RECALCULE donc la
-- valeur de `color_hue` pour tous les comptes déjà inscrits (pas
-- seulement les nouveaux) : c'est la "migration de recalcul" annoncée
-- dès la mise en place du premier système de couleurs (19/09/2026).
--
-- ⚠️ Correspondance des familles nucléaires par PRÉNOM SEUL (Nicolas n'a
-- donné que des prénoms pour la plupart des personnes, pas de nom de
-- famille) : en cas d'homonymie au sein d'une même family_group, la
-- mauvaise personne pourrait être rattachée à tort à une famille
-- nucléaire. À VÉRIFIER PAR LOUIS/NICOLAS avant de considérer cette
-- migration comme définitive — par exemple avec :
--   select first_name, last_name, family_group, nuclear_family
--   from public.profiles
--   where nuclear_family is not null
--   order by family_group, nuclear_family;
-- juste après avoir joué ce script (dans la même session SQL Editor,
-- avant de passer à autre chose), pour confirmer que chaque personne
-- listée est bien la bonne.

-- --- 1. Nouvelle colonne -------------------------------------------
alter table public.profiles
  add column if not exists nuclear_family text;

-- --- 2. Table de correspondance "prénom -> famille nucléaire" -------
-- Fournie par Nicolas le 29/09/2026, un groupe par ligne (voir aussi
-- l'en-tête de src/lib/colors.ts). Plusieurs orthographes/variantes de
-- prénom pour une même personne quand Nicolas a donné une hésitation
-- explicite (ex. "Jacquis (ou jacques)") ou un accent qui pourrait
-- manquer selon la saisie du compte (ex. "aurélie"/"aurelie"). Réutilisée
-- à la fois pour le recalcul rétroactif ci-dessous et pour les futures
-- inscriptions (voir handle_new_user() en bas de ce fichier).
create or replace function public._nuclear_family_lookup(p_family_group text, p_first_name text)
returns text
language sql
immutable
as $$
  select m.nuclear_family from (
    values
      -- LALANDE
      ('lalande', 'emmanuelle', 'lal-emmanuelle-barbarin'),
      ('lalande', 'guilhem', 'lal-emmanuelle-barbarin'),
      ('lalande', 'zoé', 'lal-emmanuelle-barbarin'),
      ('lalande', 'zoe', 'lal-emmanuelle-barbarin'),
      ('lalande', 'agathe', 'lal-emmanuelle-barbarin'),
      ('lalande', 'oscar', 'lal-emmanuelle-barbarin'),
      ('lalande', 'olivier', 'lal-olivier'),
      ('lalande', 'claire', 'lal-olivier'),
      ('lalande', 'audrey', 'lal-olivier'),
      ('lalande', 'frédéric', 'lal-frederic'),
      ('lalande', 'frederic', 'lal-frederic'),
      ('lalande', 'véronique', 'lal-frederic'),
      ('lalande', 'veronique', 'lal-frederic'),
      ('lalande', 'chloé', 'lal-frederic'),
      ('lalande', 'chloe', 'lal-frederic'),
      ('lalande', 'mathieu', 'lal-mathieu'),
      ('lalande', 'sabine', 'lal-mathieu'),
      ('lalande', 'charlotte', 'lal-mathieu'),
      ('lalande', 'tabatha', 'lal-mathieu'),
      ('lalande', 'juliette', 'lal-mathieu'),
      ('lalande', 'nicolas', 'lal-nicolas-aurelie'),
      ('lalande', 'aurélie', 'lal-nicolas-aurelie'),
      ('lalande', 'aurelie', 'lal-nicolas-aurelie'),
      ('lalande', 'otto', 'lal-nicolas-aurelie'),
      ('lalande', 'margaux', 'lal-margaux'),
      ('lalande', 'virgil', 'lal-margaux'),
      ('lalande', 'alma', 'lal-margaux'),
      ('lalande', 'antoine', 'lal-antoine'),
      ('lalande', 'sarah', 'lal-antoine'),
      ('lalande', 'joanna', 'lal-antoine'),
      ('lalande', 'nicole', 'lal-nicole-claude'),
      ('lalande', 'claude', 'lal-nicole-claude'),
      ('lalande', 'michel', 'lal-michel-douce'),
      ('lalande', 'douce', 'lal-michel-douce'),
      ('lalande', 'thierry', 'lal-thierry-michele'),
      ('lalande', 'michele', 'lal-thierry-michele'),
      ('lalande', 'michèle', 'lal-thierry-michele'),
      ('lalande', 'fleur', 'lal-fleur-louane'),
      ('lalande', 'louane', 'lal-fleur-louane'),
      -- CANAT
      ('canat', 'jean pierre', 'can-jp-brigitte'),
      ('canat', 'jean-pierre', 'can-jp-brigitte'),
      ('canat', 'brigitte', 'can-jp-brigitte'),
      ('canat', 'antonia', 'can-antonia-xavier'),
      ('canat', 'xavier', 'can-antonia-xavier'),
      ('canat', 'louis', 'can-antonia-xavier'),
      ('canat', 'anaïs', 'can-antonia-xavier'),
      ('canat', 'anais', 'can-antonia-xavier'),
      ('canat', 'valentin', 'can-antonia-xavier'),
      ('canat', 'guillaume', 'can-guillaume'),
      ('canat', 'eva', 'can-guillaume'),
      ('canat', 'viktor', 'can-guillaume'),
      ('canat', 'sofia', 'can-guillaume'),
      ('canat', 'alice', 'can-alice'),
      ('canat', 'greg', 'can-alice'),
      ('canat', 'mickael', 'can-alice'),
      ('canat', 'mickaël', 'can-alice'),
      ('canat', 'samuel', 'can-alice'),
      ('canat', 'clémentine', 'can-clementine'),
      ('canat', 'clementine', 'can-clementine'),
      ('canat', 'eric', 'can-clementine'),
      ('canat', 'éric', 'can-clementine'),
      ('canat', 'amicie', 'can-clementine'),
      ('canat', 'timéo', 'can-clementine'),
      ('canat', 'timeo', 'can-clementine'),
      ('canat', 'matis', 'can-clementine'),
      ('canat', 'claire', 'can-claire-laurent'),
      ('canat', 'laurent', 'can-claire-laurent'),
      ('canat', 'marius', 'can-claire-laurent'),
      ('canat', 'galade', 'can-claire-laurent'),
      ('canat', 'guilhem', 'can-claire-laurent'),
      ('canat', 'manon', 'can-claire-laurent'),
      ('canat', 'jacquis', 'can-jacques-claudie'),
      ('canat', 'jacques', 'can-jacques-claudie'),
      ('canat', 'claudie', 'can-jacques-claudie'),
      ('canat', 'clodie', 'can-jacques-claudie')
  ) as m(family_group, first_name, nuclear_family)
  where m.family_group = p_family_group
    and m.first_name = lower(btrim(coalesce(p_first_name, '')))
  limit 1
$$;

-- --- 3. Backfill de nuclear_family pour les comptes déjà inscrits ----
-- `nuclear_family is null` : ne touche pas une correction manuelle que
-- Louis/Nicolas aurait pu faire entre-temps si ce script est rejoué.
update public.profiles p
set nuclear_family = public._nuclear_family_lookup(p.family_group, p.first_name)
where p.nuclear_family is null
  and public._nuclear_family_lookup(p.family_group, p.first_name) is not null;

-- --- 4. Recalcul de color_hue pour les comptes déjà inscrits --------
-- Chaque "unité" (une famille nucléaire compte pour UNE SEULE unité,
-- une personne seule pour une unité à elle) reçoit un index de palette
-- par angle d'or, dans l'ordre de sa PREMIÈRE apparition (created_at le
-- plus ancien parmi ses membres) au sein de sa famille — même formule
-- que indexForUnit() dans src/lib/colors.ts. Le membre le plus ancien
-- d'une unité ("l'ancre") reçoit cet index directement ; les autres
-- membres de la même famille nucléaire s'en écartent légèrement (même
-- principe que nearbyIndex() côté JS — hash différent, hashtext() de
-- Postgres plutôt que le djb2 utilisé en JS, SANS CONSÉQUENCE : cette
-- valeur est écrite une seule fois ici, jamais recomparée à un calcul
-- JS — voir le modèle "couleur persistée une fois" dans l'en-tête de
-- src/lib/colors.ts).
with units as (
  select
    id,
    family_group,
    coalesce(nuclear_family, id::text) as unit_key,
    created_at,
    first_name,
    last_name
  from public.profiles
),
unit_rank as (
  select
    family_group,
    unit_key,
    row_number() over (partition by family_group order by min(created_at)) - 1 as unit_idx
  from units
  group by family_group, unit_key
),
anchor_per_unit as (
  select
    ur.family_group,
    ur.unit_key,
    floor(
      (ur.unit_idx * 0.6180339887498949 * 50)
      - 50 * floor((ur.unit_idx * 0.6180339887498949 * 50) / 50)
    )::int as anchor_index
  from unit_rank ur
),
per_person as (
  select
    u.id,
    a.anchor_index,
    (row_number() over (partition by u.family_group, u.unit_key order by u.created_at, u.id) = 1) as is_anchor,
    u.first_name,
    u.last_name
  from units u
  join anchor_per_unit a on a.family_group = u.family_group and a.unit_key = u.unit_key
)
update public.profiles p
set color_hue = case
  when pp.is_anchor then pp.anchor_index
  else mod(
    pp.anchor_index
      + round(((abs(mod(hashtext(lower(btrim(pp.first_name || ' ' || pp.last_name)))::bigint, 2000))) / 1000.0 - 1) * 3)::int
      + 50,
    50
  )
end
from per_person pp
where pp.id = p.id;

-- --- 5. Recalcul de color_hue pour les accompagnants sans compte -----
-- Toujours ancrés à la couleur (fraîchement recalculée ci-dessus) de la
-- personne qui a saisi leur tout premier séjour — même mécanisme que
-- ensureGuestColor() dans src/app/api/bookings/quick/route.ts. Les
-- lignes dont le créateur n'existe plus (created_by devenu null, compte
-- supprimé) ne sont pas concernées par cette jointure et gardent leur
-- ancienne valeur — sans conséquence grave : colorForPaletteIndex() côté
-- JS ramène toujours n'importe quelle valeur dans la palette par modulo,
-- jamais d'erreur, juste une teinte pas recalculée.
update public.guest_people g
set
  color_hue = mod(
    round(p.color_hue)::int
      + round(((abs(mod(hashtext(lower(btrim(g.name)))::bigint, 2000))) / 1000.0 - 1) * 3)::int
      + 50,
    50
  ),
  family_group = coalesce(g.family_group, p.family_group)
from public.profiles p
where p.id = g.created_by;

-- --- 6. handle_new_user() : palette + famille nucléaire pour les -----
--        futures inscriptions
-- Part de la dernière version connue de cette fonction (voir
-- migration_profile_colors.sql, elle-même basée sur migration_auth_fix.sql
-- — RÈGLE GÉNÉRALE DU PROJET : ne jamais copier handle_new_user() depuis
-- schema.sql, toujours repartir de la dernière migration qui la
-- redéfinit). Trois propriétés à préserver impérativement, inchangées
-- ici :
--   1. lecture des champs Google (full_name/given_name/family_name/picture),
--      pas seulement ceux du formulaire e-mail ;
--   2. date de naissance inconnue → sentinelle 1900-01-01 (adulte), jamais
--      now()::date ;
--   3. un échec du insert ne bloque JAMAIS la création du compte
--      (warning seulement).
-- Ce qui change : le calcul de color_hue (angle d'or → index de palette,
-- par UNITÉ et non plus par personne) et l'attribution de nuclear_family
-- (correspondance par prénom, voir _nuclear_family_lookup ci-dessus).
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
  v_nuclear_family text;
  v_anchor_hue double precision;
  unit_count integer;
  raw_offset double precision;
  v_color_index double precision;
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

  -- Famille nucléaire : rapprochement par prénom contre la liste fournie
  -- par Nicolas (voir public._nuclear_family_lookup ci-dessus, et
  -- l'avertissement en tête de ce fichier sur le risque d'homonymie).
  -- null si aucune correspondance (personne seule, ou famille 'friend' --
  -- aucune liste fournie pour l'instant pour les invités).
  v_nuclear_family := public._nuclear_family_lookup(v_family_group, v_first_name);

  if v_nuclear_family is not null then
    -- Un membre de cette famille nucléaire est-il déjà inscrit ? Si oui,
    -- on se cale près de sa couleur (le premier inscrit, comme ancre)
    -- plutôt que de piocher une nouvelle couleur maximalement dispersée.
    select color_hue into v_anchor_hue
    from public.profiles
    where family_group = v_family_group and nuclear_family = v_nuclear_family
    order by created_at asc
    limit 1;
  end if;

  if v_anchor_hue is not null then
    -- Décalage proche de l'ancre, même principe que nearbyIndex() côté JS
    -- (src/lib/colors.ts) — hash différent (hashtext() de Postgres plutôt
    -- que djb2), sans conséquence, voir la remarque de la partie 4
    -- ci-dessus : cette valeur est persistée une fois pour toutes.
    v_color_index := mod(
      round(v_anchor_hue)::int
        + round(((abs(mod(hashtext(lower(btrim(v_first_name || ' ' || v_last_name)))::bigint, 2000))) / 1000.0 - 1) * 3)::int
        + 50,
      50
    );
  else
    -- Personne seule, ou premier membre inscrit de sa famille nucléaire :
    -- couleur "normale", répartie par angle d'or parmi toutes les unités
    -- déjà enregistrées dans sa famille (une famille nucléaire déjà
    -- représentée compte pour UNE SEULE unité, voir indexForUnit() côté
    -- JS dans src/lib/colors.ts).
    select count(distinct coalesce(nuclear_family, id::text)) into unit_count
    from public.profiles
    where family_group = v_family_group;

    raw_offset := coalesce(unit_count, 0) * 0.6180339887498949 * 50;
    v_color_index := floor(raw_offset - 50 * floor(raw_offset / 50));
  end if;

  begin
    insert into public.profiles (
      id, email, first_name, last_name, date_of_birth, family_group, role, avatar_url, color_hue, nuclear_family
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
      v_color_index,
      v_nuclear_family
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
