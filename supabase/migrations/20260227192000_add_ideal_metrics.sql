-- Add ideal_metrics to ad_accounts to store manual KPI targets
alter table public.ad_accounts 
add column if not exists ideal_metrics jsonb default '{}'::jsonb;
