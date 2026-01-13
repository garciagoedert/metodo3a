alter table public.goals 
add column if not exists archived boolean default false;
