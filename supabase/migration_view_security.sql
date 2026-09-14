-- ============================================================
-- MIGRATION: stop the payment views bypassing row-level security
-- Run this immediately. Safe to re-run.
-- ============================================================
--
-- migration_payment_tracking.sql created two views, all_payments and
-- user_balances. A Postgres view executes with its OWNER's privileges unless
-- told otherwise, and these are owned by postgres — so the RLS policies on
-- profiles, ts_payments and tm_payments are never evaluated for the caller.
--
-- Verified against the live project: a request carrying only the publishable
-- key, with no user logged in, returned every member's name, family group,
-- role and payment balances. That key is embedded in the JavaScript served from
-- www.labatisse.art, so this was readable by anyone who looked.
--
-- The underlying tables were never exposed — the same anonymous request against
-- profiles and ts_payments correctly returned zero rows. Only the views leaked.
--
-- security_invoker makes a view run as the caller instead of its owner, so the
-- policies apply again. Requires Postgres 15 or newer.

alter view public.all_payments  set (security_invoker = on);
alter view public.user_balances set (security_invoker = on);

-- Defence in depth: neither view has any business being readable by a caller
-- who has not signed in.
revoke all on public.all_payments  from anon;
revoke all on public.user_balances from anon;

grant select on public.all_payments  to authenticated;
grant select on public.user_balances to authenticated;

-- After running, both of these must come back empty:
--   curl "$SUPABASE_URL/rest/v1/user_balances?select=*" -H "apikey: $ANON_KEY"
--   curl "$SUPABASE_URL/rest/v1/all_payments?select=*"  -H "apikey: $ANON_KEY"
