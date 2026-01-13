alter table public.goals 
add column if not exists completed_at timestamp with time zone,
add column if not exists final_value numeric;
