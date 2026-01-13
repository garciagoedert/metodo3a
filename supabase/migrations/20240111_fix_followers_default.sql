
alter table public.monthly_funnel_metrics alter column new_followers drop default;
alter table public.monthly_funnel_metrics alter column new_followers set default null;
-- Optional: Initialize existing 0s to NULL if they were just created and meant to be empty?
-- update public.monthly_funnel_metrics set new_followers = null where new_followers = 0;
