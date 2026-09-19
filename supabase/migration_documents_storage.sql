-- ============================================================
-- MIGRATION : bucket de Storage pour l'onglet "Documents"
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place. Rejouable sans risque.
-- ============================================================
--
-- Contexte : Aurélie a demandé, le 17/09/2026, que le compte admin puisse
-- uploader / mettre à jour / supprimer des documents (contrats, factures,
-- plans...) dans l'onglet "Documents", non éditables pour les autres.
--
-- ⚠️ RÉÉCRITE LE 19/09/2026 (audit Louis/Claude) : la première version
-- créait un bucket PUBLIC en lecture — n'importe qui sur Internet ayant
-- l'URL d'un fichier aurait pu lire des documents notariés, contrats ou
-- factures de la famille, sans compte. Or la table documents est justement
-- réservée à admin/family par RLS (documents_select) : le Storage doit
-- suivre la même règle. Le bucket est donc PRIVÉ, la lecture passe par des
-- URLs signées à durée limitée générées côté serveur (voir
-- src/app/dashboard/documents/page.tsx), et les policies Storage
-- reprennent exactement les règles de la table :
--   * lecture : admin et family uniquement (jamais les amis, jamais le
--     public) ;
--   * écriture (insert/update/delete) : admin uniquement.
-- La colonne documents.file_url stocke désormais le CHEMIN du fichier dans
-- le bucket (ex. "notaries/uuid.pdf"), pas une URL publique.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and public.get_user_role(auth.uid()) in ('admin', 'family')
);

drop policy if exists "documents_storage_admin" on storage.objects;
create policy "documents_storage_admin" on storage.objects
for all to authenticated
using (bucket_id = 'documents' and public.get_user_role(auth.uid()) = 'admin')
with check (bucket_id = 'documents' and public.get_user_role(auth.uid()) = 'admin');
