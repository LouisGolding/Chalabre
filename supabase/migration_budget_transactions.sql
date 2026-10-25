-- ============================================================
-- MIGRATION : transactions extraites des relevés bancaires (onglet
-- "Budget", voir claude/prompt-onglet-budget.md) -- une ligne par
-- opération lue par l'IA dans un relevé déposé (budget_statements),
-- avec sa catégorie (src/lib/budget-categories.ts).
-- À appliquer dans Supabase → SQL Editor, APRÈS
-- migration_budget_statements.sql (clé étrangère vers budget_statements).
-- Rejouable sans risque.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Nicolas a demandé le 25/10/2026 que le dépôt d'un relevé
-- catégorise automatiquement les transactions avec une clé API
-- Anthropic (route POST /api/budget/statements/extract). Colonnes
-- calquées sur le type BudgetTransaction (src/types/index.ts), posé dès
-- le 15/10/2026 :
-- - `amount` toujours positif, le sens est porté par `direction`
--   ('in' = crédit, 'out' = débit) ;
-- - `source_statement` : le relevé d'où vient la ligne. Supprimer un
--   relevé supprime ses transactions (on delete cascade), et relancer
--   l'extraction d'un relevé remplace ses lignes au lieu de les doubler
--   (voir la route) ;
-- - `reconciled_with` : réservé au rapprochement avec une transaction
--   Stripe, pas encore utilisé.
--
-- Accès : lecture admin ET famille (le reste de l'onglet Budget est
-- ouvert à la famille depuis le 17/10/2026, voir budget/page.tsx),
-- écriture admin uniquement (seuls les admins déposent les relevés).

create table if not exists public.budget_transactions (
  id uuid default uuid_generate_v4() primary key,
  account text not null check (account in ('lalande', 'canat')),
  transaction_date date not null,
  label text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  direction text not null check (direction in ('in', 'out')),
  category text not null default 'autre',
  reconciled_with text,
  source_statement uuid references public.budget_statements(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.budget_transactions enable row level security;

drop policy if exists "budget_transactions_select" on public.budget_transactions;
create policy "budget_transactions_select" on public.budget_transactions
  for select to authenticated using (
    get_user_role(auth.uid()) in ('admin', 'family')
  );

drop policy if exists "budget_transactions_insert_admin" on public.budget_transactions;
create policy "budget_transactions_insert_admin" on public.budget_transactions
  for insert to authenticated with check (
    get_user_role(auth.uid()) = 'admin'
  );

drop policy if exists "budget_transactions_delete_admin" on public.budget_transactions;
create policy "budget_transactions_delete_admin" on public.budget_transactions
  for delete to authenticated using (
    get_user_role(auth.uid()) = 'admin'
  );

create index if not exists budget_transactions_account_date_idx
  on public.budget_transactions (account, transaction_date desc);

create index if not exists budget_transactions_statement_idx
  on public.budget_transactions (source_statement);
