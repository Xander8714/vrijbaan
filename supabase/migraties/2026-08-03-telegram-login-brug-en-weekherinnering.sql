-- Twee onafhankelijke stukken, samen in één migratie toegepast op 3 aug 2026:
--
-- 1. telegram_login_tokens: eenmalig, 5 minuten geldig token dat de
--    Telegram-bot in een radarlink zet (?token=...) zodat een klik vanuit
--    Telegram direct een ingelogde sessie oplevert — geen los inloggen meer
--    nodig. Zie src/app/api/auth/telegram-login/route.ts. RLS aan zonder
--    policies: uitsluitend de service-role admin-client mag deze tabel
--    aanraken.
--
-- 2. profiles.terugkerende_dag + laatste_weekherinnering_op: voor gebruikers
--    die altijd op dezelfde dag/tijd spelen (bv. elke dinsdag 20:00) en 1,5
--    uur na hun eigen sessie een berichtje willen of diezelfde dag/tijd
--    volgende week ook beschikbaar is. Zie scripts/poll-availability.ts.

create table if not exists telegram_login_tokens (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  aangemaakt_op timestamptz not null default now(),
  verloopt_op timestamptz not null,
  gebruikt_op timestamptz
);

alter table telegram_login_tokens enable row level security;

create index if not exists telegram_login_tokens_profile_id_idx on telegram_login_tokens(profile_id);

alter table profiles
  add column if not exists terugkerende_dag smallint check (terugkerende_dag is null or terugkerende_dag between 0 and 6),
  add column if not exists laatste_weekherinnering_op date;

comment on column profiles.terugkerende_dag is 'Vaste speeldag voor de wekelijkse herinnering: 0=zondag .. 6=zaterdag (JS Date#getDay()-conventie). Null = functie uit.';
comment on column profiles.laatste_weekherinnering_op is 'Datum (lokale kalenderdag) waarop het laatste wekelijkse-herinneringsbericht is verstuurd — voorkomt dubbel versturen in dezelfde week.';
