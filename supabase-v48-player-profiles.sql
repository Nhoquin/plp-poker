-- PLP V48 • consolidação do cadastro legado de Daniel e página individual
-- Migração aplicada ao projeto de produção.
--
-- A chave canônica continua sendo "daniel". Resultados, inscrições e rankings
-- são reassociados sem alterar colocações, pontos ou valores financeiros.

set local statement_timeout = '10s';

do $$
begin
  -- Bloqueia os dois cadastros em ordem estável durante a consolidação.
  perform 1
  from public.players
  where player_key in ('daniel', 'daniel-freeroll')
  order by player_key
  for update;

  if not exists (
    select 1 from public.players where player_key = 'daniel'
  ) then
    raise exception 'Cadastro canônico daniel não encontrado';
  end if;

  -- Evita qualquer sobrescrita caso os dois cadastros apareçam na mesma etapa.
  if exists (
    select 1
    from public.stage_entries
    where player_key in ('daniel', 'daniel-freeroll')
    group by stage_id
    having count(*) > 1
  ) then
    raise exception 'Conflito de inscrição entre os cadastros de Daniel';
  end if;

  if exists (
    select 1
    from public.stage_results
    where player_key in ('daniel', 'daniel-freeroll')
    group by stage_id
    having count(*) > 1
  ) then
    raise exception 'Conflito de resultado entre os cadastros de Daniel';
  end if;

  -- Soma os rankings das duas chaves de forma atômica por temporada/escopo.
  insert into public.rankings (
    season,
    scope,
    player_key,
    points,
    discard,
    prize_label,
    qualification_status,
    updated_at
  )
  select
    season,
    scope,
    'daniel',
    sum(points),
    sum(discard),
    max(prize_label),
    max(qualification_status),
    now()
  from public.rankings
  where player_key in ('daniel', 'daniel-freeroll')
  group by season, scope
  on conflict (season, scope, player_key) do update
    set points = excluded.points,
        discard = excluded.discard,
        prize_label = excluded.prize_label,
        qualification_status = excluded.qualification_status,
        updated_at = now();

  delete from public.rankings
  where player_key = 'daniel-freeroll';

  update public.stage_entries
  set player_key = 'daniel',
      updated_at = now()
  where player_key = 'daniel-freeroll';

  update public.stage_results
  set player_key = 'daniel',
      updated_at = now()
  where player_key = 'daniel-freeroll';

  update public.stages
  set host_name = 'Daniel All Capone',
      updated_at = now()
  where lower(trim(host_name)) in (
    'daniel',
    'daniel (freeroll)',
    'daniel freeroll',
    'daniel all capone'
  );

  update public.players
  set name = 'Daniel All Capone',
      active = true,
      updated_at = now()
  where player_key = 'daniel';

  delete from public.players
  where player_key = 'daniel-freeroll';
end;
$$;
