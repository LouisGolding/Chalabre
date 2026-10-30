-- Rapprochement automatique à l'inscription (30/10/2026)
--
-- Contexte : le 30/10/2026, 35 "fiches membre sans compte" (has_login = false)
-- ont été créées pour toute la famille (voir
-- supabase/seed_famille_membres_30102026.sql) afin d'alimenter l'option
-- "Famille" sur Réserver un séjour. Ces fiches sont vouées à être remplacées
-- par de vrais comptes au fur et à mesure que chaque adulte s'inscrit
-- réellement (confirmation d'Aurélie : "toutes les personnes adultes auront
-- bien un compte"). Sans rapprochement, chaque inscription créerait un
-- doublon (le vrai profil, en plus de la fiche sans compte, jamais
-- supprimée).
--
-- 1. Corrige une erreur de saisie du 30/10/2026 : la famille de Claire/Laurent
--    Jalabert avait été taguée 'can-claire' au lieu du tag canonique déjà
--    utilisé par _nuclear_family_lookup(), 'can-claire-laurent'.
update public.profiles
set nuclear_family = 'can-claire-laurent'
where nuclear_family = 'can-claire';

-- 2. Complète _nuclear_family_lookup() avec deux orthographes correctes qui
--    manquaient (bug préexistant, pas introduit le 30/10) : "Mathis" (fils de
--    Clémentine, orthographié "matis" dans la table) et "Gallade" (fille de
--    Claire, orthographiée "galade"). Ajout strictement additif.
create or replace function public._nuclear_family_lookup(p_family_group text, p_first_name text)
 returns text
 language sql
 immutable
AS $function$
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
      ('canat', 'mathis', 'can-clementine'),
      ('canat', 'claire', 'can-claire-laurent'),
      ('canat', 'laurent', 'can-claire-laurent'),
      ('canat', 'marius', 'can-claire-laurent'),
      ('canat', 'galade', 'can-claire-laurent'),
      ('canat', 'gallade', 'can-claire-laurent'),
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
$function$;

-- 3. Rapprochement automatique à l'inscription : si une fiche "membre sans
--    compte" (has_login = false) existe déjà pour la même famille nucléaire +
--    le même prénom, le vrai profil créé à l'inscription récupère sa date de
--    naissance (si connue et plausible) et sa couleur déjà établie, puis
--    l'ancienne fiche est supprimée. Aucune table ne peut référencer une fiche
--    has_login = false (elle n'a jamais pu se connecter pour créer une
--    réservation, une tâche, un document, etc.) : sa suppression est donc
--    sans risque pour l'intégrité des données.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
AS $function$
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

  -- Rapprochement automatique (ajouté le 30/10/2026) : une fiche "membre sans
  -- compte" pour cette même famille nucléaire + ce prénom existe-t-elle déjà ?
  -- On ne matche jamais une fiche qui a déjà un compte (has_login = true).
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
    -- Rapprochement trouvé : on garde la couleur déjà établie pour cette
    -- personne plutôt que d'en calculer une nouvelle.
    v_color_index := v_old_color_hue;
  else
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
  end if;

  -- Date de naissance : celle fournie par le fournisseur OAuth si présente,
  -- sinon celle de la fiche "membre sans compte" rapprochée si elle est
  -- plausible (pas le sentinel 1900 utilisé quand on ne connaissait pas la
  -- date), sinon le sentinel 1900 comme avant.
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

    -- Le vrai profil a bien été inséré (et pas ignoré par le "on conflict")
    -- et une fiche "membre sans compte" a été rapprochée : elle est
    -- maintenant remplacée par le vrai profil ci-dessus, on la supprime.
    if found and v_old_id is not null then
      delete from public.profiles where id = v_old_id and has_login = false;
    end if;
  exception when others then
    -- Never block account creation on a profile write; the dashboard shows a
    -- "profil introuvable" screen instead of a broken signup.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$;
