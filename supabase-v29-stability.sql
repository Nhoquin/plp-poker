-- PLP V29 • estabilidade operacional, pausa automática do Blind Clock e edição direta da classificação

create or replace function public.plp_pause_clock_when_stage_finishes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finalized' and old.status is distinct from 'finalized' then
    update public.clock_state
    set running = false,
        started_at = null,
        updated_at = now()
    where id = 'main'
      and running = true;
  end if;
  return new;
end;
$$;

revoke all on function public.plp_pause_clock_when_stage_finishes() from public, anon, authenticated;

drop trigger if exists plp_pause_clock_on_stage_finalize on public.stages;
create trigger plp_pause_clock_on_stage_finalize
after update of status on public.stages
for each row
execute function public.plp_pause_clock_when_stage_finishes();

create or replace function public.plp_admin_replace_classification(
  p_stage_id uuid,
  p_player_order text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.stages%rowtype;
  v_field integer;
  v_array_count integer;
  v_distinct_count integer;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select s.* into v_stage
  from public.stages s
  where s.id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status <> 'finalized' then
    raise exception 'A edição direta está disponível somente para etapa finalizada';
  end if;

  select count(*)::integer into v_field
  from public.stage_entries e
  where e.stage_id = p_stage_id;

  v_array_count := coalesce(array_length(p_player_order,1),0);
  if v_field < 2 or v_array_count <> v_field then
    raise exception 'A classificação enviada não contém todos os jogadores da etapa';
  end if;

  select count(distinct x.player_key)::integer
    into v_distinct_count
  from unnest(p_player_order) as x(player_key);

  if v_distinct_count <> v_field then
    raise exception 'Há jogador duplicado na classificação enviada';
  end if;

  if exists (
    select 1
    from unnest(p_player_order) as x(player_key)
    where not exists (
      select 1
      from public.stage_entries e
      where e.stage_id = p_stage_id
        and e.player_key = x.player_key
    )
  ) then
    raise exception 'A classificação contém jogador que não pertence à etapa';
  end if;

  if exists (
    select 1
    from public.stage_entries e
    where e.stage_id = p_stage_id
      and not (e.player_key = any(p_player_order))
  ) then
    raise exception 'Falta jogador da etapa na classificação enviada';
  end if;

  update public.stage_entries e
  set finish_position = x.pos::integer,
      elimination_order = case when x.pos = 1 then null else (v_field - x.pos::integer + 1) end,
      eliminated_at = case when x.pos = 1 then null else coalesce(e.eliminated_at, now()) end,
      updated_at = now()
  from unnest(p_player_order) with ordinality as x(player_key,pos)
  where e.stage_id = p_stage_id
    and e.player_key = x.player_key;

  update public.stages
  set status = 'open',
      registration_closed = true,
      game_started = false,
      result_editing = true,
      finalized_at = null,
      updated_at = now()
  where id = p_stage_id;

  return public.plp_admin_finalize_from_eliminations(p_stage_id);
end;
$$;

revoke all on function public.plp_admin_replace_classification(uuid,text[]) from public, anon;
grant execute on function public.plp_admin_replace_classification(uuid,text[]) to authenticated;
