-- PLP V52 - fluxo guiado do Dia de Jogo, Top 4 confirmado e isenções independentes

create table if not exists public.stage_finish_plans (
  stage_id uuid not null references public.stages(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  points integer not null check (points > 0),
  prize numeric null check (prize is null or prize >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  primary key (stage_id, position)
);

alter table public.stage_finish_plans enable row level security;
revoke all on public.stage_finish_plans from anon;
grant select, insert, update, delete on public.stage_finish_plans to authenticated;

drop policy if exists "stage_finish_plans_admin_select" on public.stage_finish_plans;
create policy "stage_finish_plans_admin_select"
on public.stage_finish_plans for select
to authenticated
using (public.is_plp_admin());

drop policy if exists "stage_finish_plans_admin_insert" on public.stage_finish_plans;
create policy "stage_finish_plans_admin_insert"
on public.stage_finish_plans for insert
to authenticated
with check (public.is_plp_admin());

drop policy if exists "stage_finish_plans_admin_update" on public.stage_finish_plans;
create policy "stage_finish_plans_admin_update"
on public.stage_finish_plans for update
to authenticated
using (public.is_plp_admin())
with check (public.is_plp_admin());

drop policy if exists "stage_finish_plans_admin_delete" on public.stage_finish_plans;
create policy "stage_finish_plans_admin_delete"
on public.stage_finish_plans for delete
to authenticated
using (public.is_plp_admin());

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
      registration_closed=false,
      game_started=false,
      result_editing=false,
      opened_at=coalesce(opened_at,now()),
      updated_at=now()
  where id=p_stage_id
  returning * into v_stage;

  update public.league_state
  set active_stage_id=p_stage_id,
      live_text=null,
      updated_at=now(),
      updated_by=auth.uid()
  where id='main';

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'prepare','stage',p_stage_id::text,
         jsonb_build_object('stage_date',p_stage_date,'location',v_location,'host_key',p_host_key,'host_name',v_host_name));

  return to_jsonb(v_stage);
end;
$function$;

revoke all on function public.plp_admin_prepare_stage(uuid,date,text,text,text) from public, anon;
grant execute on function public.plp_admin_prepare_stage(uuid,date,text,text,text) to authenticated;

create or replace function public.plp_admin_close_and_start_stage(p_stage_id uuid)
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
  where id=p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;

  select count(*)::integer,
         count(*) filter (where is_host)::integer
    into v_field,v_host_count
  from public.stage_entries
  where stage_id=p_stage_id;

  if v_field < 2 then raise exception 'Inclua pelo menos dois jogadores'; end if;
  if v_host_count <> 1 then raise exception 'Defina exatamente um anfitrião'; end if;

  update public.stages
  set status='open',
      registration_closed=true,
      game_started=true,
      opened_at=coalesce(opened_at,now()),
      updated_at=now()
  where id=p_stage_id
  returning * into v_stage;

  update public.league_state
  set active_stage_id=p_stage_id,
      live_text='Jogo em andamento',
      updated_at=now(),
      updated_by=auth.uid()
  where id='main';

  update public.clock_state
  set level=0,
      remaining_seconds=1200,
      running=true,
      started_at=now(),
      updated_at=now(),
      updated_by=auth.uid()
  where id='main';

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'start_game','stage',p_stage_id::text,jsonb_build_object('field',v_field));

  return jsonb_build_object('ok',true,'stage_id',p_stage_id,'field',v_field,'clock_running',true);
end;
$function$;

revoke all on function public.plp_admin_close_and_start_stage(uuid) from public, anon;
grant execute on function public.plp_admin_close_and_start_stage(uuid) to authenticated;

create or replace function public.plp_admin_save_finish_plan(p_stage_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_count integer;
  v_payers integer;
  v_total_prize numeric;
  v_plan jsonb;
begin
  if not public.is_plp_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if jsonb_typeof(p_plan) <> 'array' then raise exception 'Plano inválido'; end if;

  select * into v_stage
  from public.stages
  where id=p_stage_id
  for update;

  if not found then raise exception 'Etapa não encontrada'; end if;
  if v_stage.status in ('finalized','cancelled') then raise exception 'Etapa encerrada'; end if;
  if not coalesce(v_stage.game_started,false) then raise exception 'Inicie o jogo antes de confirmar o Top 4'; end if;

  with parsed as (
    select *
    from jsonb_to_recordset(p_plan) as x(position integer,points integer,prize numeric)
  )
  select count(*)::integer
    into v_count
  from parsed
  where position between 1 and 4 and points > 0 and coalesce(prize,0) >= 0;

  if v_count <> 4 then raise exception 'Confirme as quatro posições'; end if;
  if (select count(distinct (x->>'position')::integer) from jsonb_array_elements(p_plan) x) <> 4 then
    raise exception 'Há posições repetidas';
  end if;

  delete from public.stage_finish_plans where stage_id=p_stage_id;

  insert into public.stage_finish_plans(stage_id,position,points,prize,updated_at,updated_by)
  select p_stage_id,position,points,coalesce(prize,0),now(),auth.uid()
  from jsonb_to_recordset(p_plan) as x(position integer,points integer,prize numeric)
  order by position;

  select count(*) filter (where payment_status <> 'exempt')::integer
    into v_payers
  from public.stage_entries
  where stage_id=p_stage_id;

  select coalesce(sum(prize),0)
    into v_total_prize
  from public.stage_finish_plans
  where stage_id=p_stage_id;

  update public.stages
  set payout_mode='custom',
      financial_mode='manual',
      collected_amount=v_payers*coalesce(buy_in,60),
      jackpot_amount=v_payers*10,
      prize_pool=v_total_prize,
      updated_at=now()
  where id=p_stage_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'position',position,'points',points,'prize',prize
    ) order by position),'[]'::jsonb)
    into v_plan
  from public.stage_finish_plans
  where stage_id=p_stage_id;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'confirm_top4','stage',p_stage_id::text,jsonb_build_object('plan',v_plan,'payers',v_payers,'prize_pool',v_total_prize));

  return jsonb_build_object('ok',true,'stage_id',p_stage_id,'plan',v_plan,'payers',v_payers,'prize_pool',v_total_prize);
end;
$function$;

revoke all on function public.plp_admin_save_finish_plan(uuid,jsonb) from public, anon;
grant execute on function public.plp_admin_save_finish_plan(uuid,jsonb) to authenticated;

create or replace function public.plp_v52_apply_finish_plan()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_plan public.stage_finish_plans%rowtype;
begin
  select * into v_plan
  from public.stage_finish_plans
  where stage_id=new.stage_id and position=new.position;

  if found then
    new.points := v_plan.points;
    new.prize := v_plan.prize;
    new.prize_note := 'top4_confirmed';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_plp_v52_apply_finish_plan on public.stage_results;
create trigger trg_plp_v52_apply_finish_plan
before insert on public.stage_results
for each row execute function public.plp_v52_apply_finish_plan();

create or replace function public.plp_v52_adjust_ranking_for_plan()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_stage public.stages%rowtype;
  v_field integer;
  v_default_points integer;
  v_delta integer;
begin
  if not exists (
    select 1 from public.stage_finish_plans p
    where p.stage_id=new.stage_id and p.position=new.position
  ) then
    return new;
  end if;

  select * into v_stage from public.stages where id=new.stage_id;
  select count(*)::integer into v_field from public.stage_entries where stage_id=new.stage_id;
  v_default_points := public.plp_points_for_finish(new.position,v_field);
  v_delta := new.points - v_default_points;

  if v_delta <> 0 then
    update public.rankings
    set points=greatest(0,points+v_delta),updated_at=now()
    where season=v_stage.season and scope=v_stage.championship and player_key=new.player_key;

    update public.rankings
    set points=greatest(0,points+v_delta),updated_at=now()
    where season=v_stage.season and scope='geral' and player_key=new.player_key;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_plp_v52_adjust_ranking_for_plan on public.stage_results;
create trigger trg_plp_v52_adjust_ranking_for_plan
after insert on public.stage_results
for each row execute function public.plp_v52_adjust_ranking_for_plan();

create or replace function public.plp_v52_correct_final_finance()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_payers integer;
begin
  if new.status='finalized' and old.status is distinct from 'finalized' and coalesce(new.financial_mode,'auto')='auto' then
    select count(*) filter (where payment_status <> 'exempt')::integer
      into v_payers
    from public.stage_entries
    where stage_id=new.id;

    new.collected_amount := v_payers*coalesce(new.buy_in,60);
    new.jackpot_amount := v_payers*10;
    if coalesce(new.payout_mode,'suggested') <> 'points_only' then
      new.prize_pool := v_payers*50;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_plp_v52_correct_final_finance on public.stages;
create trigger trg_plp_v52_correct_final_finance
before update on public.stages
for each row execute function public.plp_v52_correct_final_finance();

comment on table public.stage_finish_plans is 'Plano confirmado de pontos e premiação por posição antes do fechamento da etapa.';
