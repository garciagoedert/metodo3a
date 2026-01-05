-- Create monthly_comments table
create table if not exists public.monthly_comments (
  id uuid default gen_random_uuid() primary key,
  ad_account_id uuid references public.ad_accounts(id) on delete cascade not null,
  month date not null,
  author_id uuid references public.profiles(id) on delete set null, -- If user deleted, keep comment but author null? Or cascade? Set null is safer for history.
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.monthly_comments enable row level security;

-- Policies
-- Select: Admins and authenticated users can see comments (for now).
-- Public Share Page needs access via Server Action (Admin Client), so RLS doesn't block that.
-- But if we use Standard Client in dashboard...
create policy "Authenticated users can select comments"
  on public.monthly_comments for select
  using (auth.role() = 'authenticated');

-- Insert: Authenticated users can comment.
create policy "Authenticated users can insert comments"
  on public.monthly_comments for insert
  with check (auth.role() = 'authenticated');

-- Delete: Only Admins or the Author?
-- Let's allow Admins effectively.
create policy "Admins can delete comments"
  on public.monthly_comments for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
    or auth.uid() = author_id -- Or author
  );
