-- ============================================================
-- Renommage terminologique complet : "taxe de séjour" (TS) devient
-- "contribution séjour" (CS), y compris côté base de données.
-- Demande de Nicolas le 02/11/2026 ("on ne parlera plus de TAXE DE SEJOUR,
-- partout TS devient CS").
--
-- Bloqué en attente de confirmation côté outil Supabase au moment où ce
-- fichier est écrit (02/11/2026) -- voir decisions-aurelie-produit.md.
-- À appliquer avant tout déploiement du code qui l'accompagne (ce code
-- référence déjà cs_payments/cs_payer_id, qui n'existent pas en base tant
-- que cette migration n'a pas tourné).
-- ============================================================

-- 1. Table principale
alter table public.ts_payments rename to cs_payments;
alter table public.cs_payments rename constraint ts_payments_pkey to cs_payments_pkey;
alter table public.cs_payments rename constraint ts_payments_booking_id_fkey to cs_payments_booking_id_fkey;
alter table public.cs_payments rename constraint ts_payments_status_check to cs_payments_status_check;
alter table public.cs_payments rename constraint ts_payments_user_id_fkey to cs_payments_user_id_fkey;

-- 2. Policies RLS
alter policy ts_insert on public.cs_payments rename to cs_insert;
alter policy ts_select on public.cs_payments rename to cs_select;
alter policy ts_update on public.cs_payments rename to cs_update;

-- 3. Colonne de délégation de paiement sur profiles
alter table public.profiles rename column ts_payer_id to cs_payer_id;

-- 4. Valeur stockée du discriminant payment_type dans payment_events
update public.payment_events set payment_type = 'cs' where payment_type = 'ts';

-- 5. Vues dépendantes : à recréer (impossible de renommer une colonne de vue
--    ou une table source référencée sans DROP/CREATE). Sécurité reproduite à
--    l'identique de migration_view_security.sql -- ces deux vues ne doivent
--    jamais être lisibles par un appelant non connecté.
drop view if exists public.all_payments;
drop view if exists public.user_balances;

create view public.all_payments as
 select 'cs'::text as payment_type,
    t.id,
    t.user_id,
    ((p.first_name || ' '::text) || p.last_name) as user_name,
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
   from ((public.cs_payments t
     join public.profiles p on ((p.id = t.user_id)))
     left join public.bookings b on ((b.id = t.booking_id)))
union all
 select 'tm'::text as payment_type,
    tm.id,
    tm.user_id,
    ((p.first_name || ' '::text) || p.last_name) as user_name,
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
   from (public.tm_payments tm
     join public.profiles p on ((p.id = tm.user_id)));

create view public.user_balances as
 select p.id as user_id,
    ((p.first_name || ' '::text) || p.last_name) as user_name,
    p.family_group,
    p.role,
    coalesce(sum(
        case
            when (t.status <> 'paid'::text) then t.amount
            else (0)::numeric
        end), (0)::numeric) as cs_pending,
    coalesce(sum(
        case
            when (t.status = 'paid'::text) then t.amount
            else (0)::numeric
        end), (0)::numeric) as cs_paid_total,
    coalesce(sum(
        case
            when (tm.status <> 'paid'::text) then tm.amount
            else 0
        end), (0)::bigint) as tm_pending,
    coalesce(sum(
        case
            when (tm.status = 'paid'::text) then tm.amount
            else 0
        end), (0)::bigint) as tm_paid_total
   from ((public.profiles p
     left join public.cs_payments t on ((t.user_id = p.id)))
     left join public.tm_payments tm on ((tm.user_id = p.id)))
  group by p.id, p.first_name, p.last_name, p.family_group, p.role;

alter view public.all_payments  set (security_invoker = on);
alter view public.user_balances set (security_invoker = on);

revoke all on public.all_payments  from anon;
revoke all on public.user_balances from anon;

grant select on public.all_payments  to authenticated;
grant select on public.user_balances to authenticated;
