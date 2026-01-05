-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User Roles Enum
do $$ begin
    create type user_role as enum ('admin', 'cs_manager', 'traffic_manager', 'cs_agent');
exception
    when duplicate_object then null;
end $$;

-- Profiles Table (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  role user_role default 'cs_agent'::user_role,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ad Accounts Table
create table if not exists public.accounts (
  account_id text primary key,
  name text not null,
  currency text,
  timezone_name text,
  access_token text, 
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- User Accounts Junction Table
create table if not exists public.user_accounts (
  user_id uuid references public.profiles(id) on delete cascade,
  account_id text references public.accounts(account_id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (user_id, account_id)
);

-- Audit Logs Table
create table if not exists public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_resource text,
  details jsonb,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;

-- Policies
create policy "Admins can do everything on profiles"
  on public.profiles for all
  using (
    auth.uid() in (select id from public.profiles where role = 'admin')
  );

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'cs_agent' -- Default role is Agent. Admin must promote manually.
  );
  return new;
end;
$$;

-- Drop trigger if exists to ensure idempotency during dev
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
