-- Add dashboard_config to ad_accounts
alter table public.ad_accounts 
add column if not exists dashboard_config jsonb default '{}'::jsonb;

-- Example Config Structure (Documentation):
-- {
--   "funnel_steps": [
--     { "id": "step1", "metric": "impressions", "label": "Impressões" },
--     { "id": "step2", "metric": "reach", "label": "Alcance" },
--     { "id": "step3", "metric": "profile_visits", "label": "Visitas ao Perfil" },
--     { "id": "step4", "metric": "followers", "label": "Novos Seguidores" },
--     { "id": "step5", "metric": "scheduled", "label": "Agendadas" },
--     { "id": "step6", "metric": "showed", "label": "Compareceram" }
--   ]
-- }
