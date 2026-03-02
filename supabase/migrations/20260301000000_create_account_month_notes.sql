create table if not exists public.account_month_notes (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.ad_accounts(id) on delete cascade not null,
  month_year text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(account_id, month_year)
);

-- RLS Policies
alter table public.account_month_notes enable row level security;

-- Admin full access
create policy "Admins can manage account month notes" on public.account_month_notes
  for all using ( auth.role() = 'authenticated' );

-- Public read access (since it's used in public share page, validated via token in the server action)
create policy "Public can view account month notes" on public.account_month_notes
  for select using ( true );
