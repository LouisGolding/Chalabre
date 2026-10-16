-- ============================================================
-- MIGRATION : relevés bancaires déposés sur l'onglet "Budget"
-- (voir claude/prompt-onglet-budget.md) -- table de suivi des FICHIERS
-- uploadés, distincte de la future table `budget_transactions` (lignes
-- extraites par l'IA, pas encore créée -- questions ouvertes du prompt
-- encore en cours avec Nicolas).
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place. Rejouable sans risque.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé le 16/10/2026 que les relevés bancaires
-- déposés sur l'onglet "Budget" restent consultables (liste du plus
-- récent au plus ancien, téléchargement), indépendamment de
-- l'extraction IA des transactions (toujours en cours de calibrage,
-- voir points-a-regler-avec-louis.md). Même principe que le bucket de
-- Storage de l'onglet "Documents" (migration_documents_storage.sql) :
-- bucket PRIVÉ, lecture par URLs signées générées côté serveur, jamais
-- d'URL publique.
--
-- Accès réservé aux admins dans sa totalité (lecture ET écriture) : à la
-- différence du bucket "documents" (lecture admin+family), les relevés
-- bancaires sont une donnée plus sensible -- Nicolas a explicitement
-- demandé le 16/10/2026 que le dépôt de relevé reste admin uniquement, et
-- la page `budget/page.tsx` est déjà réservée aux admins dans son
-- intégralité (voir ce fichier).
--
-- `storage_path` stocke le CHEMIN du fichier dans le bucket (ex.
-- "lalande/uuid.xlsx"), pas une URL -- le bucket étant privé, une URL
-- n'aurait de sens qu'à durée limitée (voir
-- src/app/dashboard/budget/page.tsx).

create table if not exists public.budget_statements (
  id uuid default uuid_generate_v4() primary key,
  account text not null check (account in ('lalande', 'canat')),
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.budget_statements enable row level security;

create policy "budget_statements_select_admin" on public.budget_statements
  for select to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "budget_statements_insert_admin" on public.budget_statements
  for insert to authenticated with check (
    get_user_role(auth.uid()) = 'admin'
  );

create policy "budget_statements_delete_admin" on public.budget_statements
  for delete to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create index if not exists budget_statements_account_created_idx
  on public.budget_statements (account, created_at desc);

insert into storage.buckets (id, name, public)
values ('budget-statements', 'budget-statements', false)
on conflict (id) do update set public = false;

drop policy if exists "budget_statements_storage_admin" on storage.objects;
create policy "budget_statements_storage_admin" on storage.objects
for all to authenticated
using (bucket_id = 'budget-statements' and public.get_user_role(auth.uid()) = 'admin')
with check (bucket_id = 'budget-statements' and public.get_user_role(auth.uid()) = 'admin');
