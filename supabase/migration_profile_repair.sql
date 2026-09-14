-- ============================================================
-- MIGRATION: repair profiles created by the original trigger
-- Run AFTER migration_auth_fix.sql. Safe to re-run.
-- ============================================================
--
-- The original handle_new_user() only read first_name / last_name /
-- date_of_birth / family_group from raw_user_meta_data — the four fields the
-- email signup form sends. Google sends full_name / name / given_name /
-- family_name instead, so every Google account was written with:
--
--   * empty first_name and last_name
--   * date_of_birth = the signup date, because the fallback was now()::date.
--     BookingForm derives the guest age from that column, so those members
--     were billed the under-16 taxe de séjour rate (5 €/night in summer
--     instead of 10 €).
--   * role 'family' even where family_group was 'friend', because
--     (NULL = 'friend') evaluates to NULL rather than false, so the CASE fell
--     through to its ELSE branch.
--
-- This file repairs the rows already in the table. The trigger itself is fixed
-- in migration_auth_fix.sql.

-- 1. Recover names from the provider metadata, as a prefill. The member still
--    confirms them on the "Compléter mon profil" screen.
with provider_names as (
  select
    u.id,
    nullif(coalesce(u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name', ''), '') as full_name
  from auth.users u
)
update public.profiles p
set
  first_name = coalesce(
    nullif(split_part(n.full_name, ' ', 1), ''),
    p.first_name
  ),
  last_name = coalesce(
    nullif(substr(n.full_name, length(split_part(n.full_name, ' ', 1)) + 2), ''),
    p.last_name
  )
from provider_names n
where n.id = p.id
  and n.full_name is not null
  and (p.first_name = '' or p.last_name = '');

-- 2. Replace the "born on the day they signed up" placeholder with the 1900
--    sentinel. That reads as an adult, so the booking rate defaults to the full
--    price, and it makes isProfileIncomplete() route the member through the
--    completion form to enter their real date.
--
--    The ±1 day window absorbs any timezone difference between now()::date in
--    the old trigger and created_at::date here. No real birth date can fall in
--    that window, and rows whose date came from the signup form are excluded
--    outright by the metadata test.
update public.profiles p
set date_of_birth = date '1900-01-01'
from auth.users u
where u.id = p.id
  and coalesce(u.raw_user_meta_data->>'date_of_birth', '') = ''
  and p.date_of_birth between p.created_at::date - 1 and p.created_at::date + 1;

-- 3. role is deliberately left alone. Downgrading a member to 'friend' here
--    would guess at who belongs to which family; the completion form asks them
--    and the new trigger derives role from the answer.

-- What the app will do with each row now.
select
  email,
  first_name,
  last_name,
  date_of_birth,
  family_group,
  role,
  case
    when first_name = '' or last_name = '' or date_of_birth = date '1900-01-01'
      then 'will be asked to complete their profile'
    else 'complete'
  end as status
from public.profiles
order by created_at;
