-- PLP V28 • fechamento automático pela ordem de eliminações
-- Mantém a etapa finalizada visível, gera resultado/pontos/prêmios e permite reabrir para correção.

alter table public.stages
  add column if not exists result_editing boolean not null default false;

create or replace function public.plp_points_for_finish(p_position integer, p_field integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_position is null or p_position < 1 or p_field is null or p_field < 1 then 0
    when p_position = 1 then greatest(1, p_field + 8)
    when p_position = 2 then greatest(1, p_field + 4)
    when p_position = 3 then greatest(1, p_field + 1)
    when p_position = 4 then greatest(1, p_field - 1)
    when p_position = 5 then greatest(1, p_field - 3)
    when p_position = 6 then greatest(1, p_field - 5)
    when p_position = 7 then greatest(1, p_field - 6)
    else greatest(1, p_field - (p_position - 1))
  end;
$$;

create or replace function public.plp_regulation_prize(p_field integer, p_position integer)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_prizes numeric[];
begin
  v_prizes := case p_field
    when 7  then array[150,90,60]::numeric[]
    when 8  then array[170,105,75]::numeric[]
    when 9  then array[190,120,90]::numeric[]
    when 10 then array[210,135,105]::numeric[]
    when 11 then array[210,135,105,50]::numeric[]
    when 12 then array[225,150,115,60]::numeric[]
    when 13 then array[240,165,125,70]::numeric[]
    when 14 then array[255,180,135,80]::numeric[]
    when 15 then array[270,195,145,90]::numeric[]
    when 16 then array[285,210,155,100]::numeric[]
    when 17 then array[285,210,155,100,50]::numeric[]
    when 18 then array[295,220,165,110,60]::numeric[]
    when 19 then array[305,230,175,120,70]::numeric[]
    when 20 then array[315,240,185,130,80]::numeric[]
    when 21 then array[325,250,195,140,90]::numeric[]
    when 22 then array[335,260,205,150,100]::numeric[]
    else null
  end;

  if v_prizes is null or p_position is null or p_position < 1 or p_position > coalesce(array_length(v_prizes,1),0) then
    return null;
  end if;
  return v_prizes[p_position];
end;
$$;

create or replace function public.plp_admin_finalize_from_eliminations(p_stage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.stages%rowtype;
  v_field integer;
  v_active_count integer;
  v_winner_key text;
  v_winner_name text;
  v_payers integer;
  v_collected numeric;
  v_jackpot numeric;
  v_pool numeric;
  v_mode text;
  v_delta record;
  v_classification jsonb;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select s.* into v_stage
  from public.stages s
  where s.id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status = 'cancelled' then raise exception 'Etapa cancelada'; end if;

  if v_stage.status = 'finalized' and not coalesce(v_stage.result_editing,false) then
    select p.name into v_winner_name
    from public.stage_results r
    join public.players p on p.player_key = r.player_key
    where r.stage_id = p_stage_id and r.position = 1;
    return jsonb_build_object('ok',true,'already_finalized',true,'stage_id',p_stage_id,'champion_name',v_winner_name);
  end if;

  select count(*)::integer,
         count(*) filter (where e.eliminated_at is null and e.elimination_order is null)::integer,
         max(e.player_key) filter (where e.eliminated_at is null and e.elimination_order is null)
    into v_field, v_active_count, v_winner_key
  from public.stage_entries e
  where e.stage_id = p_stage_id;

  if v_field < 2 then raise exception 'A etapa precisa de pelo menos 2 jogadores para ser finalizada'; end if;
  if v_active_count <> 1 or v_winner_key is null then
    raise exception 'A classificação ainda não está completa: deve restar exatamente 1 jogador em jogo';
  end if;

  update public.stage_entries e
  set finish_position = 1,
      updated_at = now()
  where e.stage_id = p_stage_id
    and e.player_key = v_winner_key
    and e.eliminated_at is null
    and e.elimination_order is null;

  if exists (
    select 1
    from generate_series(1,v_field) g(pos)
    where not exists (
      select 1 from public.stage_entries e
      where e.stage_id = p_stage_id and e.finish_position = g.pos
    )
  ) then
    raise exception 'Há posições faltando na classificação; revise as eliminações antes de finalizar';
  end if;

  select count(*) filter (where not coalesce(e.is_host,false))::integer
    into v_payers
  from public.stage_entries e
  where e.stage_id = p_stage_id;

  if coalesce(v_stage.financial_mode,'auto') = 'manual' then
    v_collected := coalesce(v_stage.collected_amount, v_payers * coalesce(v_stage.buy_in,60));
    v_jackpot := coalesce(v_stage.jackpot_amount, v_payers * 10);
    v_pool := coalesce(v_stage.prize_pool, v_payers * 50);
  else
    v_collected := v_payers * coalesce(v_stage.buy_in,60);
    v_jackpot := v_payers * 10;
    v_pool := v_payers * 50;
  end if;

  v_mode := coalesce(v_stage.payout_mode,'suggested');
  if v_mode = 'points_only' then v_pool := 0; end if;

  for v_delta in
    with new_rows as (
      select e.player_key,
             public.plp_points_for_finish(e.finish_position,v_field) as points
      from public.stage_entries e
      where e.stage_id = p_stage_id
    ), old_rows as (
      select r.player_key, r.points
      from public.stage_results r
      where r.stage_id = p_stage_id
    ), diffs as (
      select coalesce(n.player_key,o.player_key) as player_key,
             coalesce(n.points,0) - coalesce(o.points,0) as delta
      from new_rows n
      full join old_rows o using(player_key)
    )
    select * from diffs where delta <> 0
  loop
    update public.rankings r
    set points = greatest(0, r.points + v_delta.delta),
        updated_at = now()
    where r.season = v_stage.season
      and r.scope = v_stage.championship
      and r.player_key = v_delta.player_key;
    if not found and v_delta.delta > 0 then
      insert into public.rankings(season,scope,player_key,points,discard,updated_at)
      values(v_stage.season,v_stage.championship,v_delta.player_key,v_delta.delta,0,now())
      on conflict (season,scope,player_key) do update
      set points = greatest(0, rankings.points + excluded.points), updated_at=now();
    end if;

    update public.rankings r
    set points = greatest(0, r.points + v_delta.delta),
        updated_at = now()
    where r.season = v_stage.season
      and r.scope = 'geral'
      and r.player_key = v_delta.player_key;
    if not found and v_delta.delta > 0 then
      insert into public.rankings(season,scope,player_key,points,discard,updated_at)
      values(v_stage.season,'geral',v_delta.player_key,v_delta.delta,0,now())
      on conflict (season,scope,player_key) do update
      set points = greatest(0, rankings.points + excluded.points), updated_at=now();
    end if;
  end loop;

  delete from public.stage_results r where r.stage_id = p_stage_id;

  insert into public.stage_results(stage_id,position,player_key,points,prize,prize_note,updated_at)
  select p_stage_id,
         e.finish_position,
         e.player_key,
         public.plp_points_for_finish(e.finish_position,v_field),
         case
           when v_mode = 'points_only' then null
           when v_mode = 'split' and v_field > 0 then
             case when e.finish_position = v_field
               then round(v_pool - trunc((v_pool / v_field) * 100) / 100 * (v_field - 1), 2)
               else trunc((v_pool / v_field) * 100) / 100
             end
           when v_mode = 'suggested' then public.plp_regulation_prize(v_field,e.finish_position)
           else null
         end,
         v_mode,
         now()
  from public.stage_entries e
  where e.stage_id = p_stage_id
  order by e.finish_position;

  update public.stages s
  set status = 'finalized',
      registration_closed = true,
      game_started = false,
      result_editing = false,
      collected_amount = v_collected,
      jackpot_amount = v_jackpot,
      prize_pool = v_pool,
      finalized_at = now(),
      updated_at = now()
  where s.id = p_stage_id;

  update public.league_state ls
  set active_stage_id = p_stage_id,
      live_text = null,
      updated_at = now()
  where ls.id = 'main';

  select p.name into v_winner_name
  from public.players p
  where p.player_key = v_winner_key;

  select coalesce(jsonb_agg(jsonb_build_object(
      'position',r.position,
      'player_key',r.player_key,
      'name',p.name,
      'points',r.points,
      'prize',r.prize
    ) order by r.position),'[]'::jsonb)
    into v_classification
  from public.stage_results r
  join public.players p on p.player_key = r.player_key
  where r.stage_id = p_stage_id;

  return jsonb_build_object(
    'ok',true,
    'stage_id',p_stage_id,
    'champion_key',v_winner_key,
    'champion_name',coalesce(v_winner_name,v_winner_key),
    'field',v_field,
    'collected_amount',v_collected,
    'jackpot_amount',v_jackpot,
    'prize_pool',v_pool,
    'classification',v_classification
  );
end;
$$;

revoke all on function public.plp_admin_finalize_from_eliminations(uuid) from public, anon;
grant execute on function public.plp_admin_finalize_from_eliminations(uuid) to authenticated;

create or replace function public.plp_admin_reopen_finalized_stage(p_stage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.stages%rowtype;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select s.* into v_stage
  from public.stages s
  where s.id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status <> 'finalized' then raise exception 'Somente uma etapa finalizada pode ser reaberta para edição'; end if;

  update public.stage_entries e
  set finish_position = null,
      updated_at = now()
  where e.stage_id = p_stage_id
    and e.eliminated_at is null
    and e.elimination_order is null;

  update public.stages s
  set status = 'open',
      registration_closed = true,
      game_started = true,
      result_editing = true,
      finalized_at = null,
      updated_at = now()
  where s.id = p_stage_id;

  update public.league_state ls
  set active_stage_id = p_stage_id,
      live_text = 'Resultado em edição',
      updated_at = now()
  where ls.id = 'main';

  return jsonb_build_object('ok',true,'stage_id',p_stage_id,'result_editing',true);
end;
$$;

revoke all on function public.plp_admin_reopen_finalized_stage(uuid) from public, anon;
grant execute on function public.plp_admin_reopen_finalized_stage(uuid) to authenticated;

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
    and s.status = 'finalized'
    and s.id <> v_stage.id;

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
      'result_editing', v_stage.result_editing,
      'financial_mode', v_stage.financial_mode,
      'payout_mode', v_stage.payout_mode,
      'collected_amount', v_stage.collected_amount,
      'jackpot_amount', v_stage.jackpot_amount,
      'prize_pool', v_stage.prize_pool,
      'finalized_at', v_stage.finalized_at
    ),
    'entries', v_entries,
    'finalized_jackpot', v_finalized_jackpot
  );
end;
$$;

revoke all on function public.plp_public_stage_snapshot() from public;
grant execute on function public.plp_public_stage_snapshot() to anon, authenticated;
