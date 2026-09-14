-- Auth fixes — run after schema.sql (safe to re-run).
--
-- What was wrong with the original handle_new_user():
--  * It only read first_name / last_name / date_of_birth / family_group, which
--    the email+password form sends. Google sends given_name / family_name /
--    full_name / picture instead, so every Google account landed in profiles
--    with empty names.
--  * date_of_birth fell back to now()::date, i.e. "born today". BookingForm
--    derives the guest age from it, so a Google user was billed the under-16
--    TS rate. The fallback is now a 1900 sentinel, which reads as an adult.
--  * Any exception in the trigger aborts the whole signup with the opaque
--    "Database error saving new user". It now degrades to a warning instead.
--  * security definer without a fixed search_path.

create or replace function public.get_user_role(user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = user_id;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
  v_first_name text;
  v_last_name text;
  v_family_group text;
begin
  v_first_name := coalesce(
    nullif(meta->>'first_name', ''),
    nullif(meta->>'given_name', ''),
    nullif(split_part(full_name, ' ', 1), ''),
    ''
  );

  v_last_name := coalesce(
    nullif(meta->>'last_name', ''),
    nullif(meta->>'family_name', ''),
    nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''),
    ''
  );

  -- Anything other than the two family groups is a friend.
  v_family_group := case
    when meta->>'family_group' in ('lalande', 'canat') then meta->>'family_group'
    else 'friend'
  end;

  begin
    insert into public.profiles (
      id, email, first_name, last_name, date_of_birth, family_group, role, avatar_url
    )
    values (
      new.id,
      coalesce(new.email, meta->>'email'),
      v_first_name,
      v_last_name,
      -- No birth date from an OAuth provider. 1900 reads as an adult, so the
      -- booking rate defaults to the full price rather than the child price.
      coalesce(nullif(meta->>'date_of_birth', '')::date, date '1900-01-01'),
      v_family_group,
      case when v_family_group = 'friend' then 'friend' else 'family' end,
      coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', ''))
    )
    on conflict (id) do nothing;
  exception when others then
    -- Never block account creation on a profile write; the dashboard shows a
    -- "profil introuvable" screen instead of a broken signup.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill anyone who signed up while the trigger was failing.
insert into public.profiles (id, email, first_name, last_name, date_of_birth, family_group, role)
select
  u.id,
  coalesce(u.email, u.raw_user_meta_data->>'email'),
  coalesce(
    nullif(u.raw_user_meta_data->>'first_name', ''),
    nullif(u.raw_user_meta_data->>'given_name', ''),
    ''
  ),
  coalesce(
    nullif(u.raw_user_meta_data->>'last_name', ''),
    nullif(u.raw_user_meta_data->>'family_name', ''),
    ''
  ),
  coalesce(nullif(u.raw_user_meta_data->>'date_of_birth', '')::date, date '1900-01-01'),
  case
    when u.raw_user_meta_data->>'family_group' in ('lalande', 'canat')
      then u.raw_user_meta_data->>'family_group'
    else 'friend'
  end,
  case
    when u.raw_user_meta_data->>'family_group' in ('lalande', 'canat')
      then 'family'
    else 'friend'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and coalesce(u.email, u.raw_user_meta_data->>'email') is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Privilege guard on profiles.
--
-- profiles_update_own lets a member update their own row, and Postgres reuses
-- the USING clause as the check when WITH CHECK is absent — so every column was
-- writable, including role and tm_tier. Anyone could POST themselves to
-- role='admin' or drop their monthly tier from 120 to 40.
--
-- role is not something the client sends at all any more: it is derived here
-- from the family group the member declares, exactly as signup does.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  -- No JWT: the SQL editor, or the service-role key. Unrestricted, which is
  -- what makes the "promote yourself to admin" statement in the README work.
  if caller is null then
    return new;
  end if;

  -- Admins manage roles and contribution tiers, including their own.
  if public.get_user_role(caller) = 'admin' then
    return new;
  end if;

  -- Ordinary members from here down.
  new.tm_tier := old.tm_tier;   -- the contribution tier is an admin's call

  if old.role = 'admin' then
    new.role := 'admin';        -- an admin never loses the role this way
  else
    new.role := case
      when new.family_group = 'friend' then 'friend'
      else 'family'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
