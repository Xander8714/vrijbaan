-- Tijdelijke overdracht van een reeds uitgevoerde Telegram-zoekopdracht naar
-- de ingelogde Radar. Het resultaat leeft mee met het bestaande eenmalige
-- login-token (5 minuten) en is alleen via de service-role bereikbaar: op
-- telegram_login_tokens staat RLS al aan zonder publieke policies.

alter table telegram_login_tokens
  add column if not exists radar_data jsonb;

comment on column telegram_login_tokens.radar_data is
  'Kortlevende beschikbaarheidsmeting uit Telegram, zodat de Radar dezelfde data direct toont zonder opnieuw te scrapen.';
