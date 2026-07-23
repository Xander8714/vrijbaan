create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
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
  speelsterkte int not null check (speelsterkte between 1 and 9)
);
alter table profiles enable row level security;
alter table gevolgde_clubs enable row level security;
alter table teams enable row level security;
alter table team_spelers enable row level security;
create policy "eigen profiel" on profiles for all using (auth.uid() = id);
create policy "eigen gevolgde clubs" on gevolgde_clubs for all using (auth.uid() = user_id);
create policy "eigen teams" on teams for all using (auth.uid() = user_id);
create policy "eigen team spelers" on team_spelers for all using (auth.uid() = (select user_id from teams where teams.id = team_id));
create or replace function public.handle_new_user() returns trigger as $$
begin insert into public.profiles (id, email) values (new.id, new.email); return new; end;
$$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
