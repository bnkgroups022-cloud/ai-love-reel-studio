-- AI LOVE REEL STUDIO — initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Access model (MVP): the browser NEVER talks to Supabase directly. All reads and
-- writes go through the Next.js server using the service-role key, which bypasses
-- RLS. RLS is enabled with no public policies, so the anon key cannot read or
-- write anything. When Google login is added later, add per-user policies here.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  idempotency_key text not null unique,
  topic text not null,
  mood text not null,
  style text not null,
  language text not null,
  duration integer not null check (duration in (20, 30, 45)),
  title text,
  story_json jsonb,
  character_bible_json jsonb,
  seed integer not null default floor(random() * 2147483647)::int,
  status text not null default 'queued' check (status in (
    'queued', 'writing_story', 'generating_images', 'scenes_ready',
    'render_queued', 'rendering', 'completed', 'failed'
  )),
  error_message text,
  -- Storage object paths inside the private "reel-assets" bucket (not public URLs).
  -- The server turns them into short-lived signed URLs when needed.
  video_url text,
  thumbnail_url text,
  video_duration numeric,
  story_provider text,
  image_provider text,
  video_provider text,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_created_idx on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------- project_scenes
create table if not exists public.project_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_number integer not null check (scene_number between 1 and 8),
  duration_seconds numeric not null,
  description text not null,
  action text not null,
  emotion text not null,
  location text not null,
  time_of_day text not null default '',
  lighting text not null,
  camera text not null,
  lens text not null default '',
  characters_present text[] not null default '{}',
  image_prompt text not null,
  text_overlay text not null default '',
  transition text not null default 'crossfade',
  -- Storage object path of the current image (see note on projects.video_url).
  image_url text,
  image_status text not null default 'pending' check (image_status in ('pending', 'generating', 'done', 'failed')),
  image_error text,
  image_attempts integer not null default 0,
  image_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scene_number)
);

-- ---------------------------------------------------------------- jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_type text not null check (job_type in ('story', 'images', 'render')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  message text,
  error_message text,
  provider_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_project_idx on public.jobs (project_id, created_at desc);

-- ---------------------------------------------------------------- generated_assets
create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid references public.project_scenes(id) on delete set null,
  asset_type text not null check (asset_type in ('scene_image', 'overlay', 'video')),
  provider text not null,
  provider_asset_id text,
  asset_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists generated_assets_project_idx on public.generated_assets (project_id);

-- ---------------------------------------------------------------- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists scenes_touch on public.project_scenes;
create trigger scenes_touch before update on public.project_scenes
  for each row execute function public.touch_updated_at();
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_scenes enable row level security;
alter table public.jobs enable row level security;
alter table public.generated_assets enable row level security;
-- No policies on purpose: only the server (service role) can access these tables.

-- ---------------------------------------------------------------- storage
-- Private bucket for scene images, text overlays and final MP4s.
insert into storage.buckets (id, name, public, file_size_limit)
values ('reel-assets', 'reel-assets', false, 52428800)
on conflict (id) do nothing;
