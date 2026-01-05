-- Create table for storing daily AD-LEVEL metrics
create table if not exists public.daily_ads_metrics (
  id uuid default uuid_generate_v4() primary key,
  ad_account_id uuid references public.ad_accounts(id) on delete cascade not null,
  ad_id text not null, -- Meta Ad ID
  ad_name text, -- Snapshot of name
  date date not null,
  
  spend numeric default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  link_clicks bigint default 0, -- inline_link_clicks
  reach bigint default 0,
  frequency numeric default 0,
  ctr numeric default 0,
  cpc numeric default 0,
  
  -- Conversions
  uniques numeric default 0, -- results?
  conversations numeric default 0,
  profile_visits numeric default 0,
  
  raw_data jsonb default '{}'::jsonb,
  
  updated_at timestamptz default now(),
  
  -- Composite unique key for upserting
  constraint daily_ads_metrics_key unique (ad_id, date)
);

-- Index for faster range queries
create index if not exists idx_daily_ads_metrics_account_date 
on public.daily_ads_metrics (ad_account_id, date);

create index if not exists idx_daily_ads_metrics_ad_date 
on public.daily_ads_metrics (ad_id, date);

-- Enable RLS
alter table public.daily_ads_metrics enable row level security;

-- Policies
create policy "Authenticated users can manage daily ads metrics"
  on public.daily_ads_metrics
  for all
  to authenticated
  using (true)
  with check (true);
