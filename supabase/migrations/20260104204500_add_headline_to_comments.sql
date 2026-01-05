-- Add headline column to monthly_comments
alter table public.monthly_comments 
add column if not exists headline text;
