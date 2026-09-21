-- ============================================================
-- MIGRATION : ajoute "Petite maison" aux côtés possibles d'un séjour
-- À appliquer dans Supabase → SQL Editor, après migration_bookings_house_side.sql
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 21/09/2026, d'ajouter une troisième
-- pastille "Petite maison" à côté de "Canat" et "Lalande" (widget
-- "Prochain séjour" et édition d'un séjour depuis le planning) : une
-- dépendance distincte de la maison principale (dépendance = un autre
-- bâtiment sur la propriété). La taxe de séjour y suit le même barème que
-- pour Canat/Lalande (aucun changement de calcul, indépendant du côté —
-- voir calculateTotalTS dans src/lib/utils.ts), mais son paiement doit
-- arriver sur le même compte que "Lalande" : à ce jour, aucun routage
-- Stripe par compte n'existe encore dans le code (un seul compte Stripe
-- pour tous les paiements, voir src/app/api/stripe/checkout/route.ts) —
-- cette règle (petite_maison → même compte que lalande) s'appliquera donc
-- telle quelle le jour où ce routage sera mis en place.
--
-- La contrainte CHECK posée par migration_bookings_house_side.sql
-- n'autorisait que ('canat', 'lalande') ; on la remplace par une nouvelle
-- contrainte qui autorise aussi 'petite_maison'. Le nom
-- "bookings_house_side_check" est celui que Postgres attribue par défaut à
-- une contrainte CHECK posée sans nom explicite sur une colonne "house_side"
-- (à vérifier dans Supabase → Database → bookings → Constraints si la
-- commande DROP échoue avec "constraint does not exist" : renommer alors
-- cette ligne avec le nom réel avant de relancer la migration).
alter table public.bookings drop constraint if exists bookings_house_side_check;
alter table public.bookings
  add constraint bookings_house_side_check
  check (house_side in ('canat', 'lalande', 'petite_maison'));
