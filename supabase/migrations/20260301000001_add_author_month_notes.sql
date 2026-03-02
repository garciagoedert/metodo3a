alter table public.account_month_notes add column if not exists author_name text;

-- Notify PostgREST to reload the schema cache so we don't get PGRST205 errors
notify pgrst, reload_schema;
