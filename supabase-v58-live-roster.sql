-- PLP V58 - gerenciamento manual de jogadores durante a partida
-- Adição continua usando public.plp_admin_add_late_participant (V54).
-- Esta migração adiciona a remoção segura de um participante ativo.

create or replace function public.plp_admin_remove_live_participant(
  p_stage_id uuid,
  p_player_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_entry public.stage_entries%rowtype;
  v_name text;
  v_field integer;
  v_payers integer;
  v_shifted integer := 0;
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
  if not coalesce(v_stage.game_started,false) then raise exception 'O jogo ainda não foi iniciado'; end if;
  if coalesce(v_stage.result_editing,false) then raise exception 'A classificação está em edição'; end if;

  select * into v_entry
  from public.stage_entries
  where stage_id = p_stage_id
    and player_key = lower(btrim(coalesce(p_player_key,'')))
  for update;

  if not found then raise exception 'Jogador não está inscrito nesta etapa'; end if;
  if coalesce(v_entry.is_host,false) then
    raise exception 'O anfitrião não pode ser excluído durante a partida';
  end if;
  if v_entry.eliminated_at is not null
     or v_entry.elimination_order is not null
     or v_entry.finish_position is not null then
    raise exception 'Jogador já possui eliminação registrada';
  end if;
  if exists (
    select 1
    from public.stage_results r
    where r.stage_id = p_stage_id
      and r.player_key = v_entry.player_key
  ) then
    raise exception 'Jogador já possui resultado registrado';
  end if;

  select name into v_name
  from public.players
  where player_key = v_entry.player_key;

  delete from public.stage_entries
  where stage_id = p_stage_id
    and player_key = v_entry.player_key;

  update public.stage_entries
  set list_position = list_position - 1,
      updated_at = now()
  where stage_id = p_stage_id
    and list_position is not null
    and v_entry.list_position is not null
    and list_position > v_entry.list_position;

  update public.stage_entries
  set finish_position = greatest(1, finish_position - 1),
      updated_at = now()
  where stage_id = p_stage_id
    and finish_position is not null
    and (elimination_order is not null or eliminated_at is not null);
  get diagnostics v_shifted = row_count;

  delete from public.stage_finish_plans
  where stage_id = p_stage_id;

  select count(*)::integer,
         count(*) filter (where payment_status <> 'exempt')::integer
    into v_field, v_payers
  from public.stage_entries
  where stage_id = p_stage_id;

  update public.stages
  set collected_amount = case when financial_mode='auto' then v_payers*coalesce(buy_in,60) else collected_amount end,
      jackpot_amount = case when financial_mode='auto' then v_payers*10 else jackpot_amount end,
      prize_pool = case when financial_mode='auto' and payout_mode<>'points_only' then v_payers*50 else prize_pool end,
      updated_at = now()
  where id = p_stage_id;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'remove_live_participant',
    'stage',
    p_stage_id::text,
    jsonb_build_object(
      'player_key',v_entry.player_key,
      'player_name',coalesce(v_name,v_entry.player_key),
      'old_list_position',v_entry.list_position,
      'new_field',v_field,
      'shifted_positions',v_shifted
    )
  );

  return jsonb_build_object(
    'ok',true,
    'stage_id',p_stage_id,
    'player_key',v_entry.player_key,
    'name',coalesce(v_name,v_entry.player_key),
    'new_field',v_field,
    'shifted_positions',v_shifted,
    'finish_plan_reset',true
  );
end;
$function$;

revoke all on function public.plp_admin_remove_live_participant(uuid,text) from public, anon;
grant execute on function public.plp_admin_remove_live_participant(uuid,text) to authenticated;

comment on function public.plp_admin_remove_live_participant(uuid,text)
is 'Remove com segurança um participante ativo durante a partida; bloqueia anfitrião e jogadores já eliminados.';

notify pgrst, 'reload schema';
