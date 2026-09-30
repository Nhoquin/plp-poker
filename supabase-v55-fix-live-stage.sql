-- PLP V55 - preserva estado da partida e sincroniza inicio pelo Blind Clock

create or replace function public.plp_admin_prepare_stage(
  p_stage_id uuid,
  p_stage_date date,
  p_location text,
  p_host_key text,
  p_host_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_location text := nullif(btrim(p_location), '');
  v_host_name text := nullif(btrim(p_host_name), '');
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if p_stage_date is null or v_location is null or v_host_name is null or nullif(btrim(p_host_key), '') is null then
    raise exception 'Informe data, local e anfitrião';
  end if;

  select * into v_stage
  from public.stages
  where id = p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;

  insert into public.players(player_key,name,active,updated_at)
  values(p_host_key,v_host_name,true,now())
  on conflict (player_key) do update
  set name=excluded.name, active=true, updated_at=now();

  update public.stage_entries
  set is_host=false,
      payment_status=case when payment_status='exempt' then 'pending' else payment_status end,
      amount_paid=case when payment_status='exempt' then null else amount_paid end,
      updated_at=now()
  where stage_id=p_stage_id
    and is_host=true
    and player_key<>p_host_key;

  insert into public.stage_entries(
    stage_id,player_key,list_position,payment_status,attendance_status,
    amount_paid,is_host,source,updated_at
  ) values (
    p_stage_id,p_host_key,1,'exempt','unchecked',null,true,'game_setup',now()
  )
  on conflict (stage_id,player_key) do update
  set list_position=1,
      payment_status='exempt',
      amount_paid=null,
      is_host=true,
      source='game_setup',
      updated_at=now();

  with ordered as (
    select e.player_key,
           row_number() over (
             order by case when e.player_key=p_host_key then 0 else 1 end,
                      coalesce(e.list_position,999999),
                      e.player_key
           )::integer as new_position
    from public.stage_entries e
    where e.stage_id=p_stage_id
  )
  update public.stage_entries e
  set list_position=o.new_position,
      is_host=(e.player_key=p_host_key),
      updated_at=now()
  from ordered o
  where e.stage_id=p_stage_id and e.player_key=o.player_key;

  update public.stages
  set stage_date=p_stage_date,
      location=v_location,
      host_name=v_host_name,
      status='open',
      registration_closed=coalesce(v_stage.registration_closed,false),
      game_started=coalesce(v_stage.game_started,false),
      result_editing=coalesce(v_stage.result_editing,false),
      opened_at=coalesce(opened_at,now()),
      updated_at=now()
  where id=p_stage_id
  returning * into v_stage;

  update public.league_state
  set active_stage_id=p_stage_id,
      live_text=case
        when coalesce(v_stage.game_started,false) then 'Jogo em andamento'
        when coalesce(v_stage.registration_closed,false) then 'Lista finalizada - Blind Clock pendente'
        else null
      end,
      updated_at=now(),
      updated_by=auth.uid()
  where id='main';

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'prepare','stage',p_stage_id::text,
         jsonb_build_object(
           'stage_date',p_stage_date,
           'location',v_location,
           'host_key',p_host_key,
           'host_name',v_host_name,
           'preserved_registration_closed',v_stage.registration_closed,
           'preserved_game_started',v_stage.game_started
         ));

  return to_jsonb(v_stage);
end;
$function$;

revoke all on function public.plp_admin_prepare_stage(uuid,date,text,text,text) from public, anon;
grant execute on function public.plp_admin_prepare_stage(uuid,date,text,text,text) to authenticated;

create or replace function public.plp_v55_clock_marks_game_started()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id='main' and new.running=true and old.running is distinct from true then
    update public.stages s
    set status='open',
        registration_closed=true,
        game_started=true,
        updated_at=now()
    from public.league_state ls
    where ls.id='main'
      and ls.active_stage_id=s.id
      and s.status='open'
      and not coalesce(s.game_started,false);

    update public.league_state
    set live_text='Jogo em andamento',
        updated_at=now()
    where id='main'
      and active_stage_id is not null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_plp_v55_clock_marks_game_started on public.clock_state;
create trigger trg_plp_v55_clock_marks_game_started
after update of running on public.clock_state
for each row
execute function public.plp_v55_clock_marks_game_started();
