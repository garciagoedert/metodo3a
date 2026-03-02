-- Create roteiros table
create table if not exists public.roteiros (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.ad_accounts(id) on delete cascade not null,
  month_year text not null, -- Format: YYYY-MM
  title text not null,
  focus text not null,
  funnel_stage text not null,
  status text not null default 'criacao',
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.roteiros enable row level security;

-- Policies
create policy "Authenticated users can select roteiros"
  on public.roteiros for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert roteiros"
  on public.roteiros for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update roteiros"
  on public.roteiros for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete roteiros"
  on public.roteiros for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
