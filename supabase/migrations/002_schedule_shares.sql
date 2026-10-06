create table if not exists public.schedule_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  code text not null unique,
  max_uses integer not null default 20 check (max_uses between 1 and 200),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_shares_owner_idx on public.schedule_shares (owner_id, created_at desc);
create index if not exists schedule_shares_code_idx on public.schedule_shares (code);

alter table public.schedule_shares enable row level security;

drop policy if exists "select_own_shares" on public.schedule_shares;
create policy "select_own_shares" on public.schedule_shares for select using (auth.uid() = owner_id);
drop policy if exists "insert_own_shares" on public.schedule_shares;
create policy "insert_own_shares" on public.schedule_shares for insert with check (auth.uid() = owner_id);
drop policy if exists "delete_own_shares" on public.schedule_shares;
create policy "delete_own_shares" on public.schedule_shares for delete using (auth.uid() = owner_id);

drop trigger if exists set_schedule_shares_updated_at on public.schedule_shares;
create trigger set_schedule_shares_updated_at before update on public.schedule_shares for each row execute function public.set_updated_at();
