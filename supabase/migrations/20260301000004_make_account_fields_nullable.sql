-- Migration to allow Pre-Accounts (Accounts without Meta Ads linked yet)
ALTER TABLE ad_accounts ALTER COLUMN provider_account_id DROP NOT NULL;
ALTER TABLE ad_accounts ALTER COLUMN access_token DROP NOT NULL;
