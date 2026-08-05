-- Houd elke Supabase Auth-gebruiker ook bij in public.profiles en registreer
-- recente activiteit voor de afgeschermde beheerstatistieken.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc)
  where last_seen_at is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

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
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Herstel eventuele historische Auth-gebruikers die geen profiel kregen en
-- vul ontbrekende Google-namen aan zonder eigen profielwijzigingen te wissen.
insert into public.profiles (id, email, voornaam, achternaam)
select
  gebruiker.id,
  gebruiker.email,
  nullif(gebruiker.raw_user_meta_data ->> 'given_name', ''),
  nullif(gebruiker.raw_user_meta_data ->> 'family_name', '')
from auth.users as gebruiker
where gebruiker.email is not null
on conflict (id) do update
set email = excluded.email,
    voornaam = coalesce(public.profiles.voornaam, excluded.voornaam),
    achternaam = coalesce(public.profiles.achternaam, excluded.achternaam);
