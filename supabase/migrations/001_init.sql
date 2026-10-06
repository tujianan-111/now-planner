create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  recovery_hash text not null,
  recovery_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  week_count smallint not null default 20 check (week_count between 1 and 60),
  is_active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'jwxt')),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  importance text not null default 'medium' check (importance in ('high', 'medium', 'low')),
  deadline timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes between 1 and 1440),
  lowered_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text not null default '',
  teacher text not null default '',
  credits numeric(4,1),
  attribute text not null default '',
  periods text not null default '',
  week_numbers smallint[],
  source text not null default 'manual' check (source in ('manual', 'jwxt')),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.completed_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid,
  name text not null,
  importance text not null default 'medium' check (importance in ('high', 'medium', 'low')),
  duration_minutes integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skipped_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_key text not null,
  skip_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_key, skip_date)
);

create unique index if not exists courses_import_unique_idx
  on public.courses (user_id, semester_id, source_key)
  where source = 'jwxt' and source_key is not null;

create index if not exists tasks_user_deadline_idx on public.tasks (user_id, deadline);
create index if not exists courses_user_weekday_idx on public.courses (user_id, weekday, start_time);
create index if not exists completed_user_date_idx on public.completed_tasks (user_id, completed_at desc);
create index if not exists skipped_user_date_idx on public.skipped_items (user_id, skip_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_semesters_updated_at on public.semesters;
create trigger set_semesters_updated_at before update on public.semesters for each row execute function public.set_updated_at();
drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
drop trigger if exists set_completed_tasks_updated_at on public.completed_tasks;
create trigger set_completed_tasks_updated_at before update on public.completed_tasks for each row execute function public.set_updated_at();
drop trigger if exists set_skipped_items_updated_at on public.skipped_items;
create trigger set_skipped_items_updated_at before update on public.skipped_items for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.tasks enable row level security;
alter table public.courses enable row level security;
alter table public.completed_tasks enable row level security;
alter table public.skipped_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['semesters', 'tasks', 'courses', 'completed_tasks', 'skipped_items']
  loop
    execute format('drop policy if exists "select_own" on public.%I', table_name);
    execute format('create policy "select_own" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('drop policy if exists "insert_own" on public.%I', table_name);
    execute format('create policy "insert_own" on public.%I for insert with check (auth.uid() = user_id)', table_name);
    execute format('drop policy if exists "update_own" on public.%I', table_name);
    execute format('create policy "update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('drop policy if exists "delete_own" on public.%I', table_name);
    execute format('create policy "delete_own" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end;
$$;

drop policy if exists "select_own_profile" on public.profiles;
create policy "select_own_profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.semesters;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.courses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.completed_tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.skipped_items;
  exception when duplicate_object then null;
  end;
end;
$$;

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  action text not null,
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_rate_idx on public.auth_attempts (action, fingerprint, created_at desc);
alter table public.auth_attempts enable row level security;

create unique index if not exists profiles_recovery_hash_idx on public.profiles (recovery_hash) where recovery_used_at is null;

create unique index if not exists semesters_import_unique_idx
  on public.semesters (user_id, source_key)
  where source = 'jwxt' and source_key is not null;