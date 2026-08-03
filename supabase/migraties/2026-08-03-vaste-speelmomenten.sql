-- Xander (3 aug 2026): "zorg dat ik meer vaste momenten kan kiezen met iets
-- als voeg er nog 1 toe" + "vinkje erachter van wil je op de hoogte
-- gehouden worden van deze tijden". Vervangt de vorige, losse
-- profiles.terugkerende_dag + laatste_weekherinnering_op (3 aug 2026,
-- hooguit één moment) door een echte één-op-veel-tabel: elk moment heeft nu
-- zijn eigen dag/tijd, eigen aan/uit-vinkje (`gemeld`) en eigen laatste-
-- verstuurd-datum. Zie src/app/account/VasteMomenten.tsx en
-- scripts/poll-availability.ts.
--
-- profiles.voorkeurstijd blijft ongewijzigd bestaan: die dient nog steeds de
-- algemene gebied+tijd-meldingmatch (via de Telegram-bot-onboarding), los
-- van deze specifieke wekelijkse-herinnering-momenten.

create table if not exists vaste_speelmomenten (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  dag smallint not null check (dag between 0 and 6),
  tijd text not null check (tijd ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  gemeld boolean not null default true,
  laatste_herinnering_op date,
  aangemaakt_op timestamptz not null default now()
);

alter table vaste_speelmomenten enable row level security;

create policy "eigen vaste speelmomenten" on vaste_speelmomenten
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create index if not exists vaste_speelmomenten_profile_id_idx on vaste_speelmomenten(profile_id);

alter table profiles drop column if exists terugkerende_dag;
alter table profiles drop column if exists laatste_weekherinnering_op;
