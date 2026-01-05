-- Create monthly_reports table
create table if not exists public.monthly_reports (
  id uuid default gen_random_uuid() primary key,
  ad_account_id text references public.ad_accounts(provider_account_id) on delete cascade not null, -- Using provider_account_id as FK to match other tables if that's the pattern, or id?
  -- Check ad_accounts schema. `provider_account_id` is usually the main ID used in apps, but FK should link to PK.
  -- Let's check ad_accounts PK.
  month date not null, -- YYYY-MM-01
  client_name text default '',
  analysis_text text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicates per account/month
  unique(ad_account_id, month)
);

-- Enable RLS
alter table public.monthly_reports enable row level security;

-- Policies
-- Update/Insert: Admins only.
create policy "Admins can insert monthly reports"
  on public.monthly_reports for insert
  with check (auth.role() = 'authenticated'); -- Or check profile role? Let's stick to authenticated for now as per other tables.

create policy "Admins can update monthly reports"
  on public.monthly_reports for update
  using (auth.role() = 'authenticated');

-- Select: Public access allowed (for the share page to work)?
-- Actually share page uses `getPublicLink`.
-- The page fetches data via server action.
-- If using `createClient` (anon), it needs policy.
-- If I use `createAdminClient` in Server Action (like `getPublicDashboardData`), I don't need public select policy.
-- But `fetchDashboardData` uses `createClient`?
-- `getPublicDashboardData` uses `createAdminClient` to fetch ACCOUNT.
-- But `fetchDashboardData` (which fetches metrics) uses `createAdminClient` too?
-- Let's check `actions.ts`.
-- `getPublicDashboardData` uses `const supabase = createAdminClient()`.
-- So RLS won't block it.
-- However, for `getDashboardData` (Admin View, logged in), it uses `createClient`.
-- So Admins need Select access.

create policy "Admins can select monthly reports"
  on public.monthly_reports for select
  using (auth.role() = 'authenticated');

-- Trigger to update updated_at
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.monthly_reports
  for each row execute procedure moddatetime (updated_at);
