create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- Eigen profielgegevens + zoeklocatie (29 juli 2026). Als losse ALTERs zodat
-- een bestaande database dit script opnieuw kan draaien zonder de tabel te
-- hoeven weggooien; alles is nullable omdat bestaande accounts deze velden
-- nog niet hebben ingevuld.
alter table profiles add column if not exists voornaam text;
alter table profiles add column if not exists achternaam text;
alter table profiles add column if not exists speelsterkte numeric(3,1) check (speelsterkte between 1 and 9);
alter table profiles add column if not exists speelsterkte_bron text check (speelsterkte_bron in ('handmatig', 'knltb'));
alter table profiles add column if not exists bondsnummer text;
alter table profiles add column if not exists straat text;
alter table profiles add column if not exists huisnummer text;
alter table profiles add column if not exists postcode text;
alter table profiles add column if not exists woonplaats text;
-- lat/lon komen uit de PDOK Locatieserver zodra de gebruiker een adres of
-- woonplaats kiest; hierop rekent de straal-filter op de Radar.
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lon double precision;
alter table profiles add column if not exists zoekstraal_km integer not null default 10 check (zoekstraal_km between 1 and 200);
-- Verenigingen waar de gebruiker lid is; hierdoor tonen we ledenclubs wél aan
-- wie er lid is. Vrije tekst naast onze club-id's, want niet elke vereniging
-- staat al in de app.
alter table profiles add column if not exists lidmaatschappen text[] not null default '{}';
alter table profiles add column if not exists last_seen_at timestamptz;
create index if not exists profiles_last_seen_at_idx
  on profiles (last_seen_at desc) where last_seen_at is not null;
create table if not exists gevolgde_clubs (
  user_id uuid not null references profiles(id) on delete cascade,
  club_id text not null,
  aangemaakt_op timestamptz not null default now(),
  primary key (user_id, club_id)
);
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  naam text not null,
  aangemaakt_op timestamptz not null default now()
);
create table if not exists team_spelers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  naam text not null,
  speelsterkte numeric(3,1) not null check (speelsterkte between 1 and 9), -- tot 1 decimaal, bv. 6.5
  bondsnummer text
);
alter table profiles enable row level security;
alter table gevolgde_clubs enable row level security;
alter table teams enable row level security;
alter table team_spelers enable row level security;
create policy "eigen profiel" on profiles for all using (auth.uid() = id);
create policy "eigen gevolgde clubs" on gevolgde_clubs for all using (auth.uid() = user_id);
create policy "eigen teams" on teams for all using (auth.uid() = user_id);
create policy "eigen team spelers" on team_spelers for all using (auth.uid() = (select user_id from teams where teams.id = team_id));
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then return new; end if;
  insert into public.profiles (id, email, voornaam, achternaam)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'given_name', ''),
    nullif(new.raw_user_meta_data ->> 'family_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      voornaam = coalesce(public.profiles.voornaam, excluded.voornaam),
      achternaam = coalesce(public.profiles.achternaam, excluded.achternaam);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Aanmeldingen van clubs die zelf in VrijeBaan willen (29 juli 2026).
-- BELANGRIJK: een rij hier is een AANVRAAG, geen club in de app. Niets uit deze
-- tabel wordt getoond voordat `status` op 'goedgekeurd' staat, en dat mag pas
-- nadat de KvK-inschrijving (commerciële club) of de verenigingsregistratie
-- is nagetrokken. Zo kan niemand zichzelf als club de app in schrijven.
create table if not exists club_aanmeldingen (
  id uuid primary key default gen_random_uuid(),
  -- Clubgegevens zoals de aanvrager ze opgeeft
  clubnaam text not null,
  boekingssysteem text,
  boekings_url text,
  straat text,
  huisnummer text,
  postcode text,
  woonplaats text,
  aantal_banen integer check (aantal_banen is null or aantal_banen between 1 and 100),
  boekbaar_zonder_lidmaatschap boolean,
  -- Verificatiegegevens: één van deze twee moet ingevuld zijn om te kunnen controleren
  kvk_nummer text,
  vereniging_registratie text, -- bv. KNLTB-verenigingsnummer
  -- Contact van de aanvrager (om terug te koppelen, niet voor publicatie)
  contact_naam text not null,
  contact_email text not null,
  contact_telefoon text,
  -- Beheer
  status text not null default 'nieuw' check (status in ('nieuw', 'in_behandeling', 'goedgekeurd', 'afgewezen')),
  verificatie_notitie text, -- wat er precies is nagetrokken, door wie en wanneer
  aangemaakt_op timestamptz not null default now()
);
alter table club_aanmeldingen enable row level security;
-- Iedereen mag een aanvraag indienen; niemand mag ze lezen of wijzigen via de
-- publieke API. Beoordelen gebeurt met de service-role key (RLS-bypass) of in
-- het Supabase-dashboard, zodat een aanvrager niet zijn eigen status kan zetten.
create policy "iedereen mag een club aanmelden" on club_aanmeldingen for insert with check (true);

-- Laatst bekende beschikbaarheid per club per dag (bijgewerkt door scripts/poll-availability.ts).
-- Dient als "vorige stand" voor de polling-diff én als databron voor de Radar-pagina.
create table if not exists club_beschikbaarheid (
  club_id text not null,
  datum date not null,
  slots jsonb not null default '[]',
  slots_hash text not null,
  bijgewerkt_op timestamptz not null default now(),
  primary key (club_id, datum)
);
alter table club_beschikbaarheid enable row level security;
-- Geen persoonlijke data — iedereen mag lezen. Schrijven gebeurt alleen via de service-role key (RLS-bypass).
create policy "iedereen mag beschikbaarheid lezen" on club_beschikbaarheid for select using (true);
