alter table public.account_month_notes add column if not exists author_id uuid references public.profiles(id) on delete set null;

notify pgrst, reload_schema;
