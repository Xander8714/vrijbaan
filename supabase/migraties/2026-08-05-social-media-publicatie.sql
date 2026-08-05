-- Maakt geplande socialmediaposts veilig claimbaar door een backendworker
-- en bewaart de publieke JPEG-assets die Meta tijdens publicatie ophaalt.
alter table public.social_media_posts
  drop constraint if exists social_media_posts_status_check;

alter table public.social_media_posts
  add constraint social_media_posts_status_check
  check (status in (
    'draft', 'pending_approval', 'approved', 'scheduled', 'publishing',
    'published', 'failed', 'archived'
  ));

alter table public.social_media_posts
  add column if not exists publishing_started_at timestamptz,
  add column if not exists publishing_worker text,
  add column if not exists media_assets jsonb not null default '[]'::jsonb;

create index if not exists social_media_posts_due_publication_idx
  on public.social_media_posts (scheduled_for, next_retry_at)
  where status in ('approved', 'scheduled', 'failed', 'publishing');

create or replace function public.claim_due_social_media_post(
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.social_media_posts
language sql
security invoker
set search_path = ''
as $$
  update public.social_media_posts
  set
    status = 'publishing',
    publishing_started_at = p_now,
    publishing_worker = p_worker_id,
    updated_at = p_now,
    last_error = null,
    log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', p_now,
      'event', 'publication_claimed',
      'worker', p_worker_id
    ))
  where id = (
    select kandidaat.id
    from public.social_media_posts as kandidaat
    where
      kandidaat.status = 'approved'
      or (kandidaat.status = 'scheduled' and kandidaat.scheduled_for <= p_now)
      or (
        kandidaat.status = 'failed'
        and kandidaat.next_retry_at is not null
        and kandidaat.next_retry_at <= p_now
      )
      or (
        kandidaat.status = 'publishing'
        and kandidaat.publishing_started_at <= p_now - interval '20 minutes'
      )
    order by coalesce(kandidaat.next_retry_at, kandidaat.scheduled_for, kandidaat.created_at)
    for update skip locked
    limit 1
  )
  returning *;
$$;

revoke execute on function public.claim_due_social_media_post(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_due_social_media_post(text, timestamptz)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  true,
  5242880,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
