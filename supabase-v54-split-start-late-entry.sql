-- PLP V54 - finaliza a lista sem iniciar o relógio e permite entrada tardia

create or replace function public.plp_admin_close_stage_list(p_stage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_field integer;
  v_host_count integer;
  v_pending integer;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_stage
  from public.stages
  where id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;
  if coalesce(v_stage.game_started,false) then raise exception 'O jogo já foi iniciado'; end if;

  select count(*)::integer,
         count(*) filter (where is_host)::integer,
         count(*) filter (where payment_status in ('pending','informed'))::integer
    into v_field, v_host_count, v_pending
  from public.stage_entries
  where stage_id = p_stage_id;

  if v_field < 2 then raise exception 'Inclua pelo menos dois jogadores'; end if;
  if v_host_count <> 1 then raise exception 'Defina exatamente um anfitrião'; end if;

  update public.stages
  set status = 'open',
      registration_closed = true,
      game_started = false,
      updated_at = now()
  where id = p_stage_id
  returning * into v_stage;

  update public.clock_state
  set level = 0,
      remaining_seconds = 1200,
      running = false,
      started_at = null,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'main';

  update public.league_state
  set active_stage_id = p_stage_id,
      live_text = 'Lista finalizada - Blind Clock pendente',
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'main';

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'close_registration',
    'stage',
    p_stage_id::text,
    jsonb_build_object('field',v_field,'pending_payments',v_pending,'clock_running',false)
  );

  return jsonb_build_object(
    'ok',true,
    'stage_id',p_stage_id,
    'field',v_field,
    'pending_payments',v_pending,
    'registration_closed',true,
    'game_started',false,
    'clock_running',false,
    'clock_pending',true
  );
end;
$function$;

revoke all on function public.plp_admin_close_stage_list(uuid) from public, anon;
grant execute on function public.plp_admin_close_stage_list(uuid) to authenticated;

create or replace function public.plp_admin_start_stage_clock(p_stage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_field integer;
  v_host_count integer;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_stage
  from public.stages
  where id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;

  select count(*)::integer,
         count(*) filter (where is_host)::integer
    into v_field, v_host_count
  from public.stage_entries
  where stage_id = p_stage_id;

  if v_field < 2 then raise exception 'Inclua pelo menos dois jogadores'; end if;
  if v_host_count <> 1 then raise exception 'Defina exatamente um anfitrião'; end if;
  if not coalesce(v_stage.registration_closed,false) then
    raise exception 'Finalize a lista antes de iniciar o Blind Clock';
  end if;

  if coalesce(v_stage.game_started,false) then
    return jsonb_build_object(
      'ok',true,
      'already_started',true,
      'stage_id',p_stage_id,
      'field',v_field,
      'clock_running',true
    );
  end if;

  update public.stages
  set status = 'open',
      registration_closed = true,
      game_started = true,
      opened_at = coalesce(opened_at,now()),
      updated_at = now()
  where id = p_stage_id
  returning * into v_stage;

  update public.clock_state
  set level = 0,
      remaining_seconds = 1200,
      running = true,
      started_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'main';

  update public.league_state
  set active_stage_id = p_stage_id,
      live_text = 'Jogo em andamento',
      updated_at = now(),
      updated_by = auth.uid()
  where id = 'main';

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'start_game_clock',
    'stage',
    p_stage_id::text,
    jsonb_build_object('field',v_field,'clock_level',0,'remaining_seconds',1200)
  );

  return jsonb_build_object(
    'ok',true,
    'stage_id',p_stage_id,
    'field',v_field,
    'registration_closed',true,
    'game_started',true,
    'clock_running',true,
    'clock_level',0,
    'remaining_seconds',1200
  );
end;
$function$;

revoke all on function public.plp_admin_start_stage_clock(uuid) from public, anon;
grant execute on function public.plp_admin_start_stage_clock(uuid) to authenticated;

create or replace function public.plp_admin_add_late_participant(
  p_stage_id uuid,
  p_player_key text,
  p_player_name text,
  p_payment_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_key text := lower(btrim(coalesce(p_player_key,'')));
  v_name text := regexp_replace(btrim(coalesce(p_player_name,'')), '\s+', ' ', 'g');
  v_payment text := lower(btrim(coalesce(p_payment_status,'pending')));
  v_position integer;
  v_shifted integer := 0;
  v_field integer;
  v_payers integer;
  v_saved_name text;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if v_key !~ '^[a-z0-9][a-z0-9-]{0,80}$' then raise exception 'Identificador de jogador inválido'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'Nome de jogador inválido'; end if;
  if v_payment not in ('pending','informed','confirmed','exempt') then raise exception 'Situação de pagamento inválida'; end if;

  select * into v_stage
  from public.stages
  where id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;
  if not coalesce(v_stage.game_started,false) then raise exception 'O jogo ainda não foi iniciado'; end if;
  if coalesce(v_stage.result_editing,false) then raise exception 'A classificação está em edição'; end if;

  if exists (
    select 1 from public.stage_entries
    where stage_id = p_stage_id and player_key = v_key
  ) then
    raise exception 'Jogador já está inscrito nesta etapa';
  end if;

  insert into public.players(player_key,name,active,updated_at)
  values(v_key,v_name,true,now())
  on conflict (player_key) do update
  set active = true,
      updated_at = now();

  select name into v_saved_name
  from public.players
  where player_key = v_key;

  update public.stage_entries
  set finish_position = finish_position + 1,
      updated_at = now()
  where stage_id = p_stage_id
    and finish_position is not null
    and (elimination_order is not null or eliminated_at is not null);
  get diagnostics v_shifted = row_count;

  select coalesce(max(list_position),0) + 1
    into v_position
  from public.stage_entries
  where stage_id = p_stage_id;

  insert into public.stage_entries(
    stage_id,player_key,list_position,payment_status,attendance_status,
    amount_paid,is_host,source,updated_at,eliminated_at,elimination_order,finish_position
  ) values (
    p_stage_id,
    v_key,
    v_position,
    v_payment,
    'present',
    case when v_payment='confirmed' then coalesce(v_stage.buy_in,60) else null end,
    false,
    'late_entry',
    now(),
    null,
    null,
    null
  );

  delete from public.stage_finish_plans where stage_id = p_stage_id;

  select count(*)::integer,
         count(*) filter (where payment_status <> 'exempt')::integer
    into v_field, v_payers
  from public.stage_entries
  where stage_id = p_stage_id;

  update public.stages
  set registration_closed = true,
      collected_amount = case when financial_mode='auto' then v_payers*coalesce(buy_in,60) else collected_amount end,
      jackpot_amount = case when financial_mode='auto' then v_payers*10 else jackpot_amount end,
      prize_pool = case when financial_mode='auto' and payout_mode<>'points_only' then v_payers*50 else prize_pool end,
      updated_at = now()
  where id = p_stage_id;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'late_entry',
    'stage',
    p_stage_id::text,
    jsonb_build_object(
      'player_key',v_key,
      'player_name',coalesce(v_saved_name,v_name),
      'payment_status',v_payment,
      'new_field',v_field,
      'shifted_positions',v_shifted
    )
  );

  return jsonb_build_object(
    'ok',true,
    'stage_id',p_stage_id,
    'player_key',v_key,
    'name',coalesce(v_saved_name,v_name),
    'payment_status',v_payment,
    'list_position',v_position,
    'new_field',v_field,
    'shifted_positions',v_shifted,
    'finish_plan_reset',true
  );
end;
$function$;

revoke all on function public.plp_admin_add_late_participant(uuid,text,text,text) from public, anon;
grant execute on function public.plp_admin_add_late_participant(uuid,text,text,text) to authenticated;

create or replace function public.plp_admin_close_and_start_stage(p_stage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  v_result := public.plp_admin_close_stage_list(p_stage_id);
  return v_result || jsonb_build_object('legacy_call',true,'clock_running',false,'clock_pending',true);
end;
$function$;

revoke all on function public.plp_admin_close_and_start_stage(uuid) from public, anon;
grant execute on function public.plp_admin_close_and_start_stage(uuid) to authenticated;

comment on function public.plp_admin_close_stage_list(uuid) is 'Finaliza as inscrições e deixa o Blind Clock parado, aguardando início manual.';
comment on function public.plp_admin_start_stage_clock(uuid) is 'Inicia a partida e o Blind Clock após a lista ter sido finalizada.';
comment on function public.plp_admin_add_late_participant(uuid,text,text,text) is 'Inclui participante atrasado durante o jogo e preserva a ordem das eliminações já registradas.';

notify pgrst, 'reload schema';
