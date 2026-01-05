-- Create table for storing monthly funnel metrics
create table if not exists public.monthly_funnel_metrics (
  id uuid default uuid_generate_v4() primary key,
  ad_account_id text not null, -- Links to provider_account_id in ad_accounts
  month_start date not null,   -- Always 1st of the month
  
  -- API Metrics (Cacheable)
  impressions int default 0,
  reach int default 0,
  profile_visits int default 0,
  new_followers int default 0,
  
  -- Manual Metrics
  appointments_scheduled int default 0,
  appointments_showed int default 0,
  
  last_synced_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(ad_account_id, month_start)
);

-- Enable RLS
alter table public.monthly_funnel_metrics enable row level security;

-- Policies (simplified for MVP, referencing admin client usually bypasses RLS but good practice)
create policy "Allow read access to all authenticated users"
  on public.monthly_funnel_metrics for select
  to authenticated
  using (true);

create policy "Allow insert/update to all authenticated users"
  on public.monthly_funnel_metrics for all
  to authenticated
  using (true);
