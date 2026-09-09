-- PLP Poker • backend para autenticação administrativa e Blind Clock em tempo real
-- Execute uma vez no SQL Editor do projeto Supabase.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_plp_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_plp_admin() from public;
grant execute on function public.is_plp_admin() to authenticated;

drop policy if exists "admin can read own role" on public.admin_users;
create policy "admin can read own role"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.clock_state (
  id text primary key,
  level integer not null default 0 check (level between 0 and 14),
  remaining_seconds integer not null default 1200 check (remaining_seconds between 0 and 7200),
  running boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.clock_state (id, level, remaining_seconds, running)
values ('main', 0, 1200, false)
on conflict (id) do nothing;

alter table public.clock_state enable row level security;

drop policy if exists "clock is publicly readable" on public.clock_state;
create policy "clock is publicly readable"
on public.clock_state
for select
to anon, authenticated
using (true);

drop policy if exists "admins can update clock" on public.clock_state;
create policy "admins can update clock"
on public.clock_state
for update
to authenticated
using (public.is_plp_admin())
with check (public.is_plp_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'clock_state'
  ) then
    alter publication supabase_realtime add table public.clock_state;
  end if;
end $$;

-- Depois de criar a conta do administrador em Authentication > Users,
-- troque o UUID abaixo e execute somente esta linha:
-- insert into public.admin_users(user_id) values ('UUID_DO_ADMIN') on conflict do nothing;
