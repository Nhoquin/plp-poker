-- PLP V19 • inscrições públicas, fase pré-jogo e cálculo financeiro
-- Migração já aplicada ao projeto de produção.

alter table public.stages
  add column if not exists registration_closed boolean not null default false,
  add column if not exists game_started boolean not null default false,
  add column if not exists financial_mode text not null default 'auto'
  check (financial_mode in ('auto','manual'));

create or replace function public.plp_public_stage_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
        'is_host', e.is_host
      ) order by e.list_position nulls last, p.name
    ), '[]'::jsonb
  ) into v_entries
  from public.stage_entries e
  join public.players p on p.player_key = e.player_key
  where e.stage_id = v_stage.id;

  select coalesce(sum(s.jackpot_amount), 0)
    into v_finalized_jackpot
  from public.stages s
  where s.season = v_stage.season and s.status = 'finalized';

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

create or replace function public.plp_public_signup(
  p_stage_id uuid,
  p_name text,
  p_paid boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage public.stages%rowtype;
  v_name text;
  v_key text;
  v_existing_key text;
  v_position integer;
  v_payment text;
  v_canonical_name text;
begin
  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'Nome inválido';
  end if;

  select s.* into v_stage
  from public.stages s
  join public.league_state ls on ls.id = 'main' and ls.active_stage_id = s.id
  where s.id = p_stage_id
  for update of s;

  if v_stage.id is null then raise exception 'Etapa não está disponível para inscrição'; end if;
  if v_stage.status in ('finalized', 'cancelled') then raise exception 'Etapa encerrada'; end if;
  if v_stage.registration_closed then raise exception 'Inscrições encerradas'; end if;

  select p.player_key into v_existing_key
  from public.players p
  where lower(trim(p.name)) = lower(v_name)
  order by p.active desc, p.created_at
  limit 1;

  if v_existing_key is not null then
    v_key := v_existing_key;
  else
    v_key := trim(both '-' from regexp_replace(
      translate(lower(v_name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'),
      '[^a-z0-9]+', '-', 'g'
    ));
    if v_key = '' then v_key := 'jogador-' || substr(md5(v_name), 1, 12); end if;
  end if;

  insert into public.players(player_key, name, active)
  values (v_key, v_name, true)
  on conflict (player_key) do nothing;

  select p.name into v_canonical_name from public.players p where p.player_key = v_key;
  select coalesce(max(e.list_position), 0) + 1 into v_position
  from public.stage_entries e where e.stage_id = v_stage.id;

  v_payment := case when p_paid then 'informed' else 'pending' end;

  insert into public.stage_entries(
    stage_id, player_key, list_position, payment_status,
    attendance_status, amount_paid, is_host, source, updated_at
  ) values (
    v_stage.id, v_key, v_position, v_payment,
    'unchecked', null, false, 'self_signup', now()
  )
  on conflict (stage_id, player_key) do update
    set payment_status = case
          when public.stage_entries.payment_status in ('confirmed', 'exempt') then public.stage_entries.payment_status
          when p_paid then 'informed'
          else public.stage_entries.payment_status
        end,
        source = coalesce(public.stage_entries.source, 'self_signup'),
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'player_key', v_key,
    'name', v_canonical_name,
    'payment_status', (
      select e.payment_status from public.stage_entries e
      where e.stage_id = v_stage.id and e.player_key = v_key
    )
  );
end;
$$;

revoke all on function public.plp_public_signup(uuid, text, boolean) from public;
grant execute on function public.plp_public_signup(uuid, text, boolean) to anon, authenticated;
