-- Create table for storing account goals
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  ad_account_id text not null, -- Links to provider_account_id
  metric text not null, -- 'followers', 'conversations', 'appointments_scheduled', 'appointments_showed'
  target integer not null check (target > 0),
  period text not null check (period in ('monthly', 'total')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(ad_account_id)
);

-- Enable RLS
alter table public.goals enable row level security;

-- Policies
create policy "Allow read access to all authenticated users"
  on public.goals for select
  to authenticated
  using (true);

create policy "Allow insert/update to all authenticated users"
  on public.goals for all
  to authenticated
  using (true)
  with check (true);
