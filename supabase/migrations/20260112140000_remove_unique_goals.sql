-- Remove unique constraint from goals table to allow multiple goals per account
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_ad_account_id_key;
