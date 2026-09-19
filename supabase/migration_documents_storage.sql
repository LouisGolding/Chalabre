-- ============================================================
-- MIGRATION : bucket de Storage pour l'onglet "Documents"
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 17/09/2026, que le compte admin
-- puisse uploader / mettre à jour / supprimer des documents (contrats,
-- factures, plans...) dans l'onglet "Documents", ces documents restant
-- non éditables pour tous les autres comptes.
--
-- La table `public.documents` et ses policies RLS existent déjà dans
-- schema.sql (documents_select : lecture pour admin/family ; documents_admin :
-- tout pour admin) — rien à changer de ce côté. Il ne manque que le bucket
-- de Storage lui-même : c'est lui qui stocke physiquement les fichiers
-- envoyés depuis /api/documents (route déjà écrite côté application,
-- actuellement sans effet réel en production tant que ce bucket n'existe
-- pas — en dev local, la route est simulée et n'y touche jamais).
--
-- Ce script :
--   1. crée le bucket "documents" (public en lecture, pour que les liens
--      de téléchargement affichés dans l'app fonctionnent simplement) ;
--   2. autorise en lecture (select) tout le monde sur ce bucket, puisque
--      les fichiers y sont de toute façon publics une fois l'URL connue,
--      et que l'accès à la liste des documents est déjà filtré par la
--      policy documents_select côté table ;
--   3. réserve l'écriture (insert/update/delete) aux comptes admin,
--      exactement comme documents_admin le fait déjà pour la table.
--
-- Si tu préfères repartir sur un bucket privé (URLs signées plutôt que
-- publiques), dis-le à Louis avant d'appliquer : il faudra alors aussi
-- adapter /api/documents (getPublicUrl → createSignedUrl côté lecture).

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "documents_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'documents');

create policy "documents_storage_admin" on storage.objects
for all to authenticated
using (bucket_id = 'documents' and public.get_user_role(auth.uid()) = 'admin')
with check (bucket_id = 'documents' and public.get_user_role(auth.uid()) = 'admin');
