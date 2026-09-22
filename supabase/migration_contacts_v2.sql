-- ============================================================
-- MIGRATION : colonne "website", fusion Maraîchers/Fromagers,
-- nouvelle catégorie "Visites & Rando"
-- À appliquer dans Supabase -> SQL Editor, après schema.sql,
-- migration_contacts_extra.sql et seed_contacts_import.sql.
-- ============================================================
--
-- Demandé par Aurélie le 22/09/2026 :
-- 1/ colonne "website" distincte de "email" (jusqu'ici, sites web et
--    adresses email étaient mélangés dans la seule colonne "email" lors
--    de l'import du 22/09) ;
-- 2/ fusion des catégories "Maraîchers" et "Fromagers & produits
--    laitiers" en une seule, "Producteurs locaux" ;
-- 3/ nouvelle catégorie "Visites & Rando".
--
-- Ordre important : les lignes existantes sont d'abord remises dans les
-- bonnes catégories AVANT que la nouvelle contrainte ne soit posée,
-- sinon Postgres refuserait la contrainte (lignes encore sur
-- 'maraichers'/'fromagers', valeurs qui n'existeront plus).

alter table public.contacts add column if not exists website text;

-- Regroupe Maraîchers + Fromagers dans "Producteurs locaux"
update public.contacts set category = 'producteurs_locaux'
  where category in ('maraichers', 'fromagers');

-- Les deux "spots à visiter" importés provisoirement dans "Bonnes
-- adresses" (faute de catégorie dédiée au moment de l'import) rejoignent
-- la nouvelle catégorie "Visites & Rando"
update public.contacts set category = 'visites_rando'
  where category = 'bonnes_adresses' and role = 'Spot à visiter';

-- Nouvelle liste de catégories (toujours 7) : remplace maraichers/
-- fromagers par producteurs_locaux, ajoute visites_rando
alter table public.contacts drop constraint if exists contacts_category_check;
alter table public.contacts add constraint contacts_category_check
  check (category in (
    'services', 'restaurants_bar', 'producteurs_locaux',
    'marches_boulangers', 'boutiques', 'bonnes_adresses', 'visites_rando'
  ));

-- Sépare les deux contacts où l'import du 22/09 avait mis un email ET un
-- site web dans la même case (repérés à la main, cas particuliers)
update public.contacts
  set email = 'uli.laubert@hotmail.fr',
      website = 'https://payrasurlhers.monsite-or... [URL tronquée dans la capture, à compléter]'
  where name = 'Uli Laubert';

update public.contacts
  set email = 'contact@lempotee.fr',
      website = 'http://www.lempotee.fr'
  where name = 'Aurélie Senié';

-- Pour tous les autres contacts importés le 22/09 : la colonne "email"
-- ne contient jamais de site web sans "@" (une adresse email en contient
-- toujours un) -- donc tout ce qui reste dans "email" sans "@" est en
-- réalité un site web, à basculer dans la nouvelle colonne.
update public.contacts set website = email, email = null
  where email is not null and email not like '%@%';
