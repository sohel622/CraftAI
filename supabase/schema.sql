-- ============================================================
-- CraftAI - Supabase schema
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run again (idempotent).
-- ============================================================


-- ---------- 1. projects
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  description   text not null default '',
  stacks        text[] not null default '{}',
  github_owner  text,
  github_repo   text,
  github_branch text not null default 'main',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

-- ---------- 2. project files (one row per file)
create table if not exists public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  path        text not null check (char_length(path) between 1 and 300),
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists project_files_project_idx on public.project_files (project_id);

-- ---------- 3. chat / prompt history
create table if not exists public.prompt_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists prompt_logs_project_idx on public.prompt_logs (project_id, created_at desc);

-- ---------- 4. AI generations (what Gemini returned + what was applied)
create table if not exists public.generations (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  prompt_log_id  uuid references public.prompt_logs(id) on delete set null,
  model          text not null,
  plan           text not null default '',
  explanation    text not null default '',
  operations     jsonb not null default '[]',
  applied        jsonb not null default '[]',
  skipped        jsonb not null default '[]',
  usage          jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists generations_project_idx on public.generations (project_id, created_at desc);

-- ---------- 5. keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_files_touch on public.project_files;
create trigger trg_project_files_touch before update on public.project_files
  for each row execute function public.touch_updated_at();

-- ---------- 6. Row Level Security
-- The backend uses the service-role key (bypasses RLS) and filters by user itself.
-- These policies protect the data if the app ever reads Supabase directly.
alter table public.projects      enable row level security;
alter table public.project_files enable row level security;
alter table public.prompt_logs   enable row level security;
alter table public.generations   enable row level security;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own files" on public.project_files;
create policy "own files" on public.project_files
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists "own prompt logs" on public.prompt_logs;
create policy "own prompt logs" on public.prompt_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own generations" on public.generations;
create policy "own generations" on public.generations
  for select using (auth.uid() = user_id);

-- ---------- 7. Realtime (live file + chat updates in the app)
do $$
begin
  begin
    alter publication supabase_realtime add table public.project_files;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.prompt_logs;
  exception when duplicate_object then null;
  end;
end $$;
