alter table public.goals 
add column if not exists start_date timestamptz default now();
