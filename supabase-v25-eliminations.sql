-- PLP V25 • eliminações ao vivo e classificação provisória
-- Migração aplicada ao projeto de produção em 15/09/2026.

alter table public.stage_entries
  add column if not exists eliminated_at timestamptz,
  add column if not exists elimination_order integer,
  add column if not exists finish_position integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stage_entries'::regclass
      and conname = 'stage_entries_elimination_order_check'
  ) then
    alter table public.stage_entries
      add constraint stage_entries_elimination_order_check
      check (elimination_order is null or elimination_order > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stage_entries'::regclass
      and conname = 'stage_entries_finish_position_check'
  ) then
    alter table public.stage_entries
      add constraint stage_entries_finish_position_check
      check (finish_position is null or finish_position > 0);
  end if;
end $$;

create unique index if not exists stage_entries_elimination_order_uidx
  on public.stage_entries(stage_id, elimination_order)
  where elimination_order is not null;

create unique index if not exists stage_entries_finish_position_uidx
  on public.stage_entries(stage_id, finish_position)
  where finish_position is not null;

create or replace function public.plp_close_registration_on_game_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.game_started is true and coalesce(old.game_started, false) is false then
    new.registration_closed := true;
  end if;
  return new;
end;
$$;

drop trigger if exists plp_close_registration_on_game_start on public.stages;
create trigger plp_close_registration_on_game_start
before update of game_started on public.stages
for each row
execute function public.plp_close_registration_on_game_start();

create or replace function public.plp_admin_eliminate_player(
  p_stage_id uuid,
  p_player_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_started boolean;
  v_status text;
  v_existing_order integer;
  v_existing_position integer;
  v_active_count integer;
  v_next_order integer;
  v_finish_position integer;
  v_name text;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select s.game_started, s.status
    into v_started, v_status
  from public.stages s
  where s.id = p_stage_id
  for update;

  if not found then
    raise exception 'Etapa não encontrada';
  end if;
  if v_status in ('finalized', 'cancelled') then
    raise exception 'Etapa encerrada';
  end if;
  if not coalesce(v_started, false) then
    raise exception 'Inicie o jogo antes de registrar eliminações';
  end if;

  select e.elimination_order, e.finish_position
    into v_existing_order, v_existing_position
  from public.stage_entries e
  where e.stage_id = p_stage_id
    and e.player_key = p_player_key;

  if not found then
    raise exception 'Jogador não está inscrito nesta etapa';
  end if;

  if v_existing_order is not null then
    return jsonb_build_object(
      'ok', true,
      'already_eliminated', true,
      'player_key', p_player_key,
      'elimination_order', v_existing_order,
      'finish_position', v_existing_position
    );
  end if;

  select count(*)::integer
    into v_active_count
  from public.stage_entries e
  where e.stage_id = p_stage_id
    and e.eliminated_at is null;

  if v_active_count <= 1 then
    raise exception 'O último jogador restante ocupa o 1º lugar provisório';
  end if;

  select coalesce(max(e.elimination_order), 0) + 1
    into v_next_order
  from public.stage_entries e
  where e.stage_id = p_stage_id;

  v_finish_position := v_active_count;

  update public.stage_entries e
  set eliminated_at = now(),
      elimination_order = v_next_order,
      finish_position = v_finish_position,
      updated_at = now()
  where e.stage_id = p_stage_id
    and e.player_key = p_player_key
    and e.eliminated_at is null;

  if not found then
    raise exception 'Não foi possível registrar a eliminação';
  end if;

  update public.stages s
  set registration_closed = true,
      updated_at = now()
  where s.id = p_stage_id;

  select p.name into v_name
  from public.players p
  where p.player_key = p_player_key;

  return jsonb_build_object(
    'ok', true,
    'player_key', p_player_key,
    'name', coalesce(v_name, p_player_key),
    'elimination_order', v_next_order,
    'finish_position', v_finish_position,
    'remaining_players', v_active_count - 1
  );
end;
$$;

revoke all on function public.plp_admin_eliminate_player(uuid, text) from public, anon;
grant execute on function public.plp_admin_eliminate_player(uuid, text) to authenticated;

create or replace function public.plp_admin_restore_last_elimination(
  p_stage_id uuid,
  p_player_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target_order integer;
  v_target_position integer;
  v_last_order integer;
  v_name text;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  perform 1
  from public.stages s
  where s.id = p_stage_id
  for update;

  if not found then
    raise exception 'Etapa não encontrada';
  end if;

  select e.elimination_order, e.finish_position
    into v_target_order, v_target_position
  from public.stage_entries e
  where e.stage_id = p_stage_id
    and e.player_key = p_player_key;

  if not found or v_target_order is null then
    raise exception 'Este jogador não está eliminado';
  end if;

  select max(e.elimination_order)
    into v_last_order
  from public.stage_entries e
  where e.stage_id = p_stage_id
    and e.elimination_order is not null;

  if v_target_order <> v_last_order then
    raise exception 'Só é possível desfazer a eliminação mais recente';
  end if;

  update public.stage_entries e
  set eliminated_at = null,
      elimination_order = null,
      finish_position = null,
      updated_at = now()
  where e.stage_id = p_stage_id
    and e.player_key = p_player_key;

  update public.stages s
  set updated_at = now()
  where s.id = p_stage_id;

  select p.name into v_name
  from public.players p
  where p.player_key = p_player_key;

  return jsonb_build_object(
    'ok', true,
    'player_key', p_player_key,
    'name', coalesce(v_name, p_player_key),
    'restored_finish_position', v_target_position
  );
end;
$$;

revoke all on function public.plp_admin_restore_last_elimination(uuid, text) from public, anon;
grant execute on function public.plp_admin_restore_last_elimination(uuid, text) to authenticated;

create or replace function public.plp_public_stage_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stage public.stages%rowtype;
  v_entries jsonb;
  v_finalized_jackpot numeric;
begin
  select s.* into v_stage
  from public.stages s
  join public.league_state ls on ls.id = 'main' and ls.active_stage_id = s.id
  limit 1;

  if v_stage.id is null then
    return jsonb_build_object('stage', null, 'entries', '[]'::jsonb, 'finalized_jackpot', 0);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_key', e.player_key,
        'name', p.name,
        'list_position', e.list_position,
        'payment_status', e.payment_status,
        'attendance_status', e.attendance_status,
        'is_host', e.is_host,
        'eliminated_at', e.eliminated_at,
        'elimination_order', e.elimination_order,
        'finish_position', e.finish_position
      ) order by e.list_position nulls last, p.name
    ), '[]'::jsonb
  ) into v_entries
  from public.stage_entries e
  join public.players p on p.player_key = e.player_key
  where e.stage_id = v_stage.id;

  select coalesce(sum(s.jackpot_amount), 0)
    into v_finalized_jackpot
  from public.stages s
  where s.season = v_stage.season
    and s.status = 'finalized';

  return jsonb_build_object(
    'stage', jsonb_build_object(
      'id', v_stage.id,
      'season', v_stage.season,
      'championship', v_stage.championship,
      'stage_number', v_stage.stage_number,
      'stage_date', v_stage.stage_date,
      'status', v_stage.status,
      'buy_in', v_stage.buy_in,
      'host_name', v_stage.host_name,
      'location', v_stage.location,
      'registration_closed', v_stage.registration_closed,
      'game_started', v_stage.game_started,
      'financial_mode', v_stage.financial_mode,
      'collected_amount', v_stage.collected_amount,
      'jackpot_amount', v_stage.jackpot_amount,
      'prize_pool', v_stage.prize_pool
    ),
    'entries', v_entries,
    'finalized_jackpot', v_finalized_jackpot
  );
end;
$$;

revoke all on function public.plp_public_stage_snapshot() from public;
grant execute on function public.plp_public_stage_snapshot() to anon, authenticated;
