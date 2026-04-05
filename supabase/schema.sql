-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  family_group text not null check (family_group in ('lalande', 'canat', 'friend')),
  role text not null default 'family' check (role in ('admin', 'family', 'friend')),
  tm_tier integer check (tm_tier in (40, 80, 120)),
  rib text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Rooms table
create table public.rooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  family_group text not null check (family_group in ('lalande', 'canat')),
  capacity integer not null default 2,
  description text,
  created_at timestamptz default now()
);

-- Bookings table
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete set null,
  check_in date not null,
  check_out date not null,
  notes text,
  created_at timestamptz default now(),
  constraint valid_dates check (check_out > check_in)
);

-- Booking guests
create table public.booking_guests (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  with_parents boolean not null default true
);

-- TS Payments
create table public.ts_payments (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- TM Payments
create table public.tm_payments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null check (amount in (40, 80, 120)),
  month text not null, -- YYYY-MM format
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, month)
);

-- Events
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  event_type text not null default 'other' check (event_type in ('family', 'friends', 'maintenance', 'cleaner', 'gardener', 'other')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Tasks
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  category text not null default 'entretien' check (category in ('entretien', 'reparation', 'autre')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Contacts
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  role text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

-- Documents
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  category text not null default 'autre' check (category in ('propriete', 'contrats', 'factures', 'plans', 'autre')),
  file_url text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- House log
create table public.house_log (
  id uuid default uuid_generate_v4() primary key,
  content text not null,
  entry_type text not null default 'info' check (entry_type in ('info', 'travaux', 'evenement')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Budget entries
create table public.budget_entries (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  amount numeric(10,2) not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  category text not null,
  date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_guests enable row level security;
alter table public.ts_payments enable row level security;
alter table public.tm_payments enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.contacts enable row level security;
alter table public.documents enable row level security;
alter table public.house_log enable row level security;
alter table public.budget_entries enable row level security;

-- Helper function to get user role
create or replace function public.get_user_role(user_id uuid)
returns text as $$
  select role from public.profiles where id = user_id;
$$ language sql security definer;

-- Profiles: users can read all, update own, admins can update all
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update to authenticated using (get_user_role(auth.uid()) = 'admin');

-- Rooms: all authenticated can read
create policy "rooms_select" on public.rooms for select to authenticated using (true);
create policy "rooms_admin" on public.rooms for all to authenticated using (get_user_role(auth.uid()) = 'admin');

-- Bookings: all can read, family/admin can insert, own or admin can update/delete
create policy "bookings_select" on public.bookings for select to authenticated using (true);
create policy "bookings_insert" on public.bookings for insert to authenticated with check (
  get_user_role(auth.uid()) in ('admin', 'family', 'friend')
);
create policy "bookings_update" on public.bookings for update to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) = 'admin'
);
create policy "bookings_delete" on public.bookings for delete to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) = 'admin'
);

-- Booking guests: follow booking permissions
create policy "booking_guests_select" on public.booking_guests for select to authenticated using (true);
create policy "booking_guests_insert" on public.booking_guests for insert to authenticated with check (true);
create policy "booking_guests_update" on public.booking_guests for update to authenticated using (true);
create policy "booking_guests_delete" on public.booking_guests for delete to authenticated using (true);

-- TS Payments: own or admin
create policy "ts_select" on public.ts_payments for select to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "ts_insert" on public.ts_payments for insert to authenticated with check (true);
create policy "ts_update" on public.ts_payments for update to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) = 'admin'
);

-- TM Payments: own or admin/family
create policy "tm_select" on public.tm_payments for select to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "tm_insert" on public.tm_payments for insert to authenticated with check (
  get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "tm_update" on public.tm_payments for update to authenticated using (
  user_id = auth.uid() or get_user_role(auth.uid()) = 'admin'
);

-- Events: all read, admin/family write
create policy "events_select" on public.events for select to authenticated using (true);
create policy "events_write" on public.events for all to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);

-- Tasks: all read, admin write
create policy "tasks_select" on public.tasks for select to authenticated using (true);
create policy "tasks_admin" on public.tasks for all to authenticated using (
  get_user_role(auth.uid()) = 'admin'
);

-- Contacts: all read, admin write
create policy "contacts_select" on public.contacts for select to authenticated using (true);
create policy "contacts_admin" on public.contacts for all to authenticated using (
  get_user_role(auth.uid()) = 'admin'
);

-- Documents: family/admin read, admin write
create policy "documents_select" on public.documents for select to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "documents_admin" on public.documents for all to authenticated using (
  get_user_role(auth.uid()) = 'admin'
);

-- House log: all read, family/admin write
create policy "house_log_select" on public.house_log for select to authenticated using (true);
create policy "house_log_write" on public.house_log for insert to authenticated with check (
  get_user_role(auth.uid()) in ('admin', 'family')
);

-- Budget: family/admin read, admin write
create policy "budget_select" on public.budget_entries for select to authenticated using (
  get_user_role(auth.uid()) in ('admin', 'family')
);
create policy "budget_admin" on public.budget_entries for all to authenticated using (
  get_user_role(auth.uid()) = 'admin'
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, date_of_birth, family_group, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'date_of_birth')::date, now()::date),
    coalesce(new.raw_user_meta_data->>'family_group', 'friend'),
    case
      when new.raw_user_meta_data->>'family_group' = 'friend' then 'friend'
      else 'family'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
