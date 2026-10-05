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
