-- PLP V59 - snapshot público do Blind Clock para o modo projetor

create or replace function public.plp_public_projector_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_clock public.clock_state%rowtype;
  v_stage public.stages%rowtype;
  v_field integer := 0;
  v_active integer := 0;
begin
  select * into v_clock
  from public.clock_state
  where id = 'main'
  limit 1;

  select s.* into v_stage
  from public.league_state ls
  join public.stages s on s.id = ls.active_stage_id
  where ls.id = 'main'
  limit 1;

  if v_stage.id is not null then
    select count(*)::integer,
           count(*) filter (
             where e.eliminated_at is null
               and e.elimination_order is null
               and e.finish_position is null
           )::integer
      into v_field, v_active
    from public.stage_entries e
    where e.stage_id = v_stage.id;
  end if;

  return jsonb_build_object(
    'server_now', clock_timestamp(),
    'clock', case when v_clock.id is null then null else jsonb_build_object(
      'id', v_clock.id,
      'level', v_clock.level,
      'remaining_seconds', v_clock.remaining_seconds,
      'running', v_clock.running,
      'started_at', v_clock.started_at,
      'updated_at', v_clock.updated_at
    ) end,
    'stage', case when v_stage.id is null then null else jsonb_build_object(
      'id', v_stage.id,
      'season', v_stage.season,
      'championship', v_stage.championship,
      'stage_number', v_stage.stage_number,
      'stage_date', v_stage.stage_date,
      'status', v_stage.status,
      'host_name', v_stage.host_name,
      'location', v_stage.location,
      'game_started', v_stage.game_started,
      'registration_closed', v_stage.registration_closed
    ) end,
    'field', v_field,
    'active_players', v_active
  );
end;
$function$;

revoke all on function public.plp_public_projector_snapshot() from public;
grant execute on function public.plp_public_projector_snapshot() to anon, authenticated;

comment on function public.plp_public_projector_snapshot()
is 'Snapshot público e sanitizado do Blind Clock para o modo projetor, incluindo horário do servidor para corrigir drift do aparelho.';

notify pgrst, 'reload schema';


create or replace function public.plp_admin_set_clock(
  p_level integer,
  p_remaining_seconds integer,
  p_running boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_clock public.clock_state%rowtype;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if p_level is null or p_level < 0 or p_level > 14 then
    raise exception 'Nível inválido';
  end if;
  if p_remaining_seconds is null or p_remaining_seconds < 0 or p_remaining_seconds > 7200 then
    raise exception 'Tempo inválido';
  end if;

  update public.clock_state
  set level = p_level,
      remaining_seconds = p_remaining_seconds,
      running = coalesce(p_running,false),
      started_at = case when coalesce(p_running,false) then clock_timestamp() else null end,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
  where id = 'main'
  returning * into v_clock;

  if v_clock.id is null then
    raise exception 'Blind Clock não encontrado';
  end if;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'set_clock',
    'clock_state',
    'main',
    jsonb_build_object(
      'level',v_clock.level,
      'remaining_seconds',v_clock.remaining_seconds,
      'running',v_clock.running
    )
  );

  return jsonb_build_object(
    'ok',true,
    'server_now',clock_timestamp(),
    'clock',to_jsonb(v_clock)
  );
end;
$function$;

revoke all on function public.plp_admin_set_clock(integer,integer,boolean) from public, anon;
grant execute on function public.plp_admin_set_clock(integer,integer,boolean) to authenticated;

comment on function public.plp_admin_set_clock(integer,integer,boolean)
is 'Atualiza o Blind Clock usando o relógio do servidor, evitando dependência do horário do celular controlador.';

notify pgrst, 'reload schema';
