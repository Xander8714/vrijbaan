-- Voorkom dubbele telegram_chat_id op profiles (5 aug 2026)
-- (gevonden tijdens de RLS/kolomrechten-fix van vandaag, zie
-- 2026-08-05-profielkolommen-beperken.sql voor de bredere context)
--
-- telegram_chat_id is client-schrijfbaar (TelegramKoppelen.tsx zet 'm bij
-- het loskoppelen naar null, en de koppelflow in
-- src/app/api/telegram/webhook/route.ts zet 'm via de service_role-client
-- na een geldige koppelcode) maar had géén unique constraint. Een ingelogde
-- gebruiker kon in theorie via een gewone client-call zijn eigen
-- telegram_chat_id op de waarde van andermans échte, gekoppelde account
-- zetten:
--   supabase.from("profiles").update({telegram_chat_id: 123456}).eq("id", eigenId)
-- haalProfielOp() in de webhook-route zoekt profielen op met
-- .eq("telegram_chat_id", chatId).maybeSingle() — bij twee rijen met
-- dezelfde chat_id gooit maybeSingle() een fout ("multiple (or no) rows
-- returned"), waardoor Telegram-berichten voor die chat_id niet meer
-- verwerkt worden. Dat is een denial-of-service op de meldingen/chat van
-- het slachtoffer (geen datalek: de aanvaller leest niets van het
-- slachtoffer, die kan alleen de eigen koppeling stukmaken van een ander).
--
-- Geverifieerd vóór deze migratie: geen dubbele niet-null
-- telegram_chat_id-waarden in productie (2 gekoppelde profielen totaal),
-- dus de partial unique index hieronder kan zonder conflict toegepast
-- worden. Partial omdat telegram_chat_id nullable is en de meeste
-- profielen (nog) niet gekoppeld zijn, dus meerdere NULL's moeten
-- toegestaan blijven.
create unique index if not exists profiles_telegram_chat_id_key
  on public.profiles (telegram_chat_id)
  where telegram_chat_id is not null;
