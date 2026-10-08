create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_name text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  planned_seconds integer not null default 1500 check (planned_seconds between 60 and 86400),
  focused_seconds integer not null check (focused_seconds between 0 and 86400),
  finish_reason text not null default 'completed' check (finish_reason in ('completed', 'stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists focus_sessions_user_time_idx on public.focus_sessions (user_id, started_at desc);
alter table public.focus_sessions enable row level security;

drop policy if exists "select_own_focus" on public.focus_sessions;
create policy "select_own_focus" on public.focus_sessions for select using (auth.uid() = user_id);
drop policy if exists "insert_own_focus" on public.focus_sessions;
create policy "insert_own_focus" on public.focus_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "update_own_focus" on public.focus_sessions;
create policy "update_own_focus" on public.focus_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete_own_focus" on public.focus_sessions;
create policy "delete_own_focus" on public.focus_sessions for delete using (auth.uid() = user_id);

drop trigger if exists set_focus_sessions_updated_at on public.focus_sessions;
create trigger set_focus_sessions_updated_at before update on public.focus_sessions for each row execute function public.set_updated_at();

do $$
begin
  begin
    alter publication supabase_realtime add table public.focus_sessions;
  exception when duplicate_object then null;
  end;
end;
$$;
