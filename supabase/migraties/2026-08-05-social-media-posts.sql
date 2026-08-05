-- Legt de bestaande social_media_posts-tabel vast die op 5 augustus 2026
-- rechtstreeks in Supabase is aangemaakt. De tabel is alleen bedoeld voor
-- backendprocessen: RLS staat aan en er zijn bewust geen policies voor anon
-- of authenticated.
create table if not exists public.social_media_posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_approval'
    constraint social_media_posts_status_check
    check (status in ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived')),
  content_type text not null
    constraint social_media_posts_content_type_check
    check (content_type in ('availability', 'spotlight', 'statistic', 'tip')),
  subject_key text not null,
  subject_type text not null
    constraint social_media_posts_subject_type_check
    check (subject_type in ('city', 'club', 'national', 'tip')),
  subject_id text not null,
  city text,
  club_id text,
  caption text not null
    constraint social_media_posts_caption_check
    check (char_length(caption) between 1 and 2200),
  hashtags text[] not null default '{}',
  image_url text,
  image_storage_path text,
  visual jsonb not null,
  data_snapshot jsonb not null default '{}',
  source_updated_at timestamptz,
  scheduled_for timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  platforms text[] not null default array['instagram', 'facebook']::text[],
  external_post_ids jsonb not null default '{}',
  last_error text,
  retry_count integer not null default 0
    constraint social_media_posts_retry_count_check
    check (retry_count >= 0),
  next_retry_at timestamptz,
  metrics jsonb not null default '{}',
  log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_media_posts enable row level security;

create index if not exists social_media_posts_status_scheduled_idx
  on public.social_media_posts(status, scheduled_for);

create index if not exists social_media_posts_subject_created_idx
  on public.social_media_posts(subject_key, created_at desc);

create index if not exists social_media_posts_approved_by_idx
  on public.social_media_posts(approved_by);

grant all on table public.social_media_posts to anon, authenticated, service_role;
