-- ============================================================
-- MIGRATION: Payment tracking & audit trail
-- À appliquer dans Supabase → SQL Editor
-- ============================================================

-- 1. Ajouter stripe_checkout_session_id aux tables de paiement
alter table public.ts_payments
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_amount_received integer, -- en centimes
  add column if not exists payment_method text, -- 'card', 'sepa_debit', etc.
  add column if not exists failure_reason text;

alter table public.tm_payments
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_amount_received integer,
  add column if not exists payment_method text,
  add column if not exists failure_reason text;

-- 2. Table d'audit : log de tous les événements Stripe
create table if not exists public.payment_events (
  id uuid default uuid_generate_v4() primary key,
  stripe_event_id text unique not null,     -- ID Stripe (évite les doublons)
  stripe_event_type text not null,          -- 'checkout.session.completed', etc.
  payment_type text,                        -- 'ts' ou 'tm'
  payment_id uuid,                          -- id dans ts_payments ou tm_payments
  user_id uuid references public.profiles(id) on delete set null,
  amount numeric(10,2),
  currency text default 'eur',
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text not null,                     -- 'success', 'failed', 'refunded'
  raw_payload jsonb,                        -- payload Stripe complet
  processed_at timestamptz default now()
);

-- Index pour recherches rapides
create index if not exists idx_payment_events_user on public.payment_events(user_id);
create index if not exists idx_payment_events_type on public.payment_events(payment_type, payment_id);
create index if not exists idx_payment_events_date on public.payment_events(processed_at desc);

-- RLS
alter table public.payment_events enable row level security;
create policy "payment_events_admin" on public.payment_events
  for select to authenticated
  using (get_user_role(auth.uid()) in ('admin', 'family'));

-- 3. Vue consolidée de tous les paiements (utile pour l'admin)
create or replace view public.all_payments as
  select
    'ts' as payment_type,
    t.id,
    t.user_id,
    p.first_name || ' ' || p.last_name as user_name,
    p.family_group,
    t.amount,
    t.status,
    t.paid_at,
    t.created_at,
    t.stripe_payment_intent_id,
    t.stripe_checkout_session_id,
    t.payment_method,
    b.check_in as reference_date,
    b.check_out,
    null::text as month
  from public.ts_payments t
  join public.profiles p on p.id = t.user_id
  left join public.bookings b on b.id = t.booking_id

  union all

  select
    'tm' as payment_type,
    tm.id,
    tm.user_id,
    p.first_name || ' ' || p.last_name as user_name,
    p.family_group,
    tm.amount,
    tm.status,
    tm.paid_at,
    tm.created_at,
    tm.stripe_payment_intent_id,
    tm.stripe_checkout_session_id,
    tm.payment_method,
    null::date as reference_date,
    null::date as check_out,
    tm.month
  from public.tm_payments tm
  join public.profiles p on p.id = tm.user_id;

-- 4. Solde par utilisateur (vue pratique)
create or replace view public.user_balances as
  select
    p.id as user_id,
    p.first_name || ' ' || p.last_name as user_name,
    p.family_group,
    p.role,
    coalesce(sum(case when t.status != 'paid' then t.amount else 0 end), 0) as ts_pending,
    coalesce(sum(case when t.status = 'paid' then t.amount else 0 end), 0) as ts_paid_total,
    coalesce(sum(case when tm.status != 'paid' then tm.amount else 0 end), 0) as tm_pending,
    coalesce(sum(case when tm.status = 'paid' then tm.amount else 0 end), 0) as tm_paid_total
  from public.profiles p
  left join public.ts_payments t on t.user_id = p.id
  left join public.tm_payments tm on tm.user_id = p.id
  group by p.id, p.first_name, p.last_name, p.family_group, p.role;
