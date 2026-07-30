-- Migratie 29 juli 2026 — voer dit uit in de Supabase SQL editor.
--
-- Nodig voor: eigen profielgegevens + zoeklocatie op /account en de Radar
-- (straal rond je woonplaats), en het aanmeldformulier voor clubs.
--
-- Zonder deze migratie werkt de app wél, maar geeft opslaan de fout
-- "Could not find the 'lat' column of 'profiles' in the schema cache" en wordt
-- je zoekgebied alleen in je browser (localStorage) bewaard.
--
-- Alles is idempotent (if not exists), dus opnieuw uitvoeren kan geen kwaad.
-- Deze statements staan ook in supabase/schema.sql; dit losse bestand is er
-- voor een bestaande database die niet opnieuw opgezet moet worden.

-- 1. Profielgegevens + zoeklocatie
alter table profiles add column if not exists voornaam text;
alter table profiles add column if not exists achternaam text;
alter table profiles add column if not exists speelsterkte numeric(3,1) check (speelsterkte between 1 and 9);
alter table profiles add column if not exists speelsterkte_bron text check (speelsterkte_bron in ('handmatig', 'knltb'));
alter table profiles add column if not exists bondsnummer text;
alter table profiles add column if not exists straat text;
alter table profiles add column if not exists huisnummer text;
alter table profiles add column if not exists postcode text;
alter table profiles add column if not exists woonplaats text;
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lon double precision;
alter table profiles add column if not exists zoekstraal_km integer not null default 10 check (zoekstraal_km between 1 and 200);
-- Verenigingen waar de gebruiker lid is. Daardoor kunnen we ledenclubs (die we
-- voor anderen verbergen) voor deze gebruiker juist wél tonen. Vrije tekst
-- toegestaan naast onze eigen club-id's: niet elke vereniging staat al in de app.
alter table profiles add column if not exists lidmaatschappen text[] not null default '{}';

-- 2. Aanmeldingen van clubs (aanvragen — nooit automatisch gepubliceerd)
create table if not exists club_aanmeldingen (
  id uuid primary key default gen_random_uuid(),
  clubnaam text not null,
  boekingssysteem text,
  boekings_url text,
  straat text,
  huisnummer text,
  postcode text,
  woonplaats text,
  aantal_banen integer check (aantal_banen is null or aantal_banen between 1 and 100),
  boekbaar_zonder_lidmaatschap boolean,
  kvk_nummer text,
  vereniging_registratie text,
  contact_naam text not null,
  contact_email text not null,
  contact_telefoon text,
  status text not null default 'nieuw' check (status in ('nieuw', 'in_behandeling', 'goedgekeurd', 'afgewezen')),
  verificatie_notitie text,
  aangemaakt_op timestamptz not null default now()
);
alter table club_aanmeldingen enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'club_aanmeldingen' and policyname = 'iedereen mag een club aanmelden'
  ) then
    create policy "iedereen mag een club aanmelden" on club_aanmeldingen for insert with check (true);
  end if;
end $$;
