-- ✅ CONFIRMÉE APPLIQUÉE EN BASE (vérifié directement en lecture seule
-- le 25/10/2026, table/colonne/contrainte/policies déjà présentes --
-- date d'application réelle inconnue, ni Claude ni ce document ne l'ont
-- vue passer : appliquée hors du circuit habituel, probablement
-- directement par Louis). Conservée telle quelle pour l'historique, y
-- compris la mention "NE PAS APPLIQUER SANS L'ACCORD DE LOUIS"
-- ci-dessous : ne plus la rejouer.

-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- MIGRATION : nouvelle catégorie de contacts "Médical"
-- À appliquer dans Supabase -> SQL Editor, après migration_contacts_v2.sql.
--
-- Demandé par Aurélie le 23/10/2026 : "dans l'onglet contact, ajouter un
-- widget 'MEDICAL', avec un tableau comme les autres". Le widget lui-même
-- (src/components/contacts/ContactsBoard.tsx) apparaît automatiquement
-- dès que 'medical' est ajouté à la liste CONTACT_CATEGORIES
-- (src/lib/contact-categories.ts, déjà fait côté code) -- seule la
-- contrainte `contacts_category_check` en base doit être mise à jour ici,
-- sinon l'ajout d'un contact dans cette catégorie échoue (violation de
-- contrainte) tant que cette migration n'est pas appliquée.
--
-- Même ordre que migration_contacts_v2.sql : on retire l'ancienne
-- contrainte avant de la reposer, pour pouvoir y ajouter 'medical'.

alter table public.contacts drop constraint if exists contacts_category_check;

alter table public.contacts add constraint contacts_category_check
  check (category in (
    'services', 'restaurants_bar', 'producteurs_locaux',
    'marches_boulangers', 'boutiques', 'bonnes_adresses', 'visites_rando',
    'medical'
  ));

-- Vérification après exécution (doit renvoyer 'medical' dans la liste) :
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'contacts_category_check';
