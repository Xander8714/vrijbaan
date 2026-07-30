-- Telegram-koppeling voor per-gebruiker notificaties (30 juli 2026).
-- Fase 1 van de Telegram-notificaties: hergebruikt de bestaande
-- gevolgde_clubs-tabel + de poll-diff in scripts/poll-availability.ts. Een
-- volledige zoekopdracht-tabel (locatie+straal+dag/tijd-voorkeur) is bewust
-- uitgesteld naar een latere fase — zie PROJECTPLAN.md.
--
-- telegram_koppel_code: korte, eenmalige code die de Account-pagina
-- genereert en in de deep link zet (t.me/vrijbaan_notify_bot?start=<code>).
-- De webhook (src/app/api/telegram/webhook) zoekt hiermee het profiel op
-- zodra de gebruiker /start stuurt, zet telegram_chat_id, en leegt de code
-- weer — een code is dus maar één keer bruikbaar.
alter table profiles add column if not exists telegram_chat_id bigint;
alter table profiles add column if not exists telegram_koppel_code text;

-- Eén Telegram-chat kan maar aan één profiel gekoppeld zijn, en een code mag
-- niet naar twee profielen tegelijk wijzen. Partial (where ... is not null)
-- zodat meerdere profielen zonder koppeling (de standaardsituatie) elkaar
-- niet in de weg zitten.
create unique index if not exists profiles_telegram_chat_id_key
  on profiles(telegram_chat_id) where telegram_chat_id is not null;
create unique index if not exists profiles_telegram_koppel_code_key
  on profiles(telegram_koppel_code) where telegram_koppel_code is not null;

-- Geen nieuwe RLS-policy nodig: "eigen profiel" (auth.uid() = id) dekt deze
-- kolommen al, zelfde als telefoon/lidmaatschappen hiervoor.
