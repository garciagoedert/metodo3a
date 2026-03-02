alter table public.roteiro_comments alter column user_id drop not null;
alter table public.roteiro_comments add column if not exists is_from_client boolean default false;

-- Notify PostgREST to reload the schema cache so we don't get PGRST205 errors
notify pgrst, reload_schema;
