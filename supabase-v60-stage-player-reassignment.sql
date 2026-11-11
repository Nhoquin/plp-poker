-- PLP Poker V60 - correcoes atomicas de apelidos em etapas encerradas
-- Mantem o procedimento V57, acrescentando remapeamento de participantes.
CREATE OR REPLACE FUNCTION public.plp_admin_correct_stage_v60(
  p_stage_id uuid,
  p_buy_in numeric,
  p_collected numeric,
  p_jackpot numeric,
  p_prize_pool numeric,
  p_entries jsonb,
  p_results jsonb,
  p_player_mapping jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_stage public.stages%ROWTYPE;
  v_item jsonb;
  v_from text;
  v_to text;
  v_scope text;
  v_seen_from text[] := ARRAY[]::text[];
  v_seen_to text[] := ARRAY[]::text[];
  v_points integer;
  v_saved jsonb;
  v_changed integer := 0;
BEGIN
  IF NOT public.is_plp_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessario';
  END IF;
  IF p_player_mapping IS NULL OR jsonb_typeof(p_player_mapping) <> 'array' THEN
    RAISE EXCEPTION 'Lista de correcoes de participantes invalida';
  END IF;
  SELECT * INTO v_stage FROM public.stages WHERE id=p_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa nao encontrada';
  END IF;
  IF v_stage.status NOT IN ('open','finalized') THEN
    RAISE EXCEPTION 'Somente etapas abertas ou finalizadas podem ser corrigidas';
  END IF;

  -- Validar todos os remapeamentos antes de qualquer atualizacao.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_player_mapping) LOOP
    v_from := NULLIF(btrim(v_item->>'from'), '');
    v_to := NULLIF(btrim(v_item->>'to'), '');
    IF v_from IS NULL OR v_to IS NULL OR v_from = v_to THEN
      RAISE EXCEPTION 'Correcao de participante invalida';
    END IF;
    IF v_from = ANY(v_seen_from) OR v_to = ANY(v_seen_to) THEN
      RAISE EXCEPTION 'Participante repetido na lista de correcoes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE player_key=v_to) THEN
      RAISE EXCEPTION 'Cadastro de destino % nao existe', v_to;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stage_entries WHERE stage_id=p_stage_id AND player_key=v_from) THEN
      RAISE EXCEPTION 'Participante original % nao pertence a etapa', v_from;
    END IF;
    IF EXISTS (SELECT 1 FROM public.stage_entries WHERE stage_id=p_stage_id AND player_key=v_to) THEN
      RAISE EXCEPTION 'O participante % ja consta nesta etapa; nao e permitido duplicar', v_to;
    END IF;
    v_seen_from := array_append(v_seen_from,v_from);
    v_seen_to := array_append(v_seen_to,v_to);
  END LOOP;

  -- A funcao existente grava financeiro, pagamentos e pontuacoes.
  -- Uma excecao em qualquer etapa reverte TODA a transacao, inclusive estas gravacoes.
  v_saved := public.plp_admin_correct_stage(
    p_stage_id,p_buy_in,p_collected,p_jackpot,p_prize_pool,p_entries,p_results
  );

  -- Depois de pontuar corretamente, transferir o resultado do apelido
  -- para o cadastro oficial em BR e ranking geral, sem duplicar pontuacao.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_player_mapping) LOOP
    v_from := btrim(v_item->>'from');
    v_to := btrim(v_item->>'to');

    SELECT coalesce(sum(r.points),0)::integer INTO v_points
    FROM public.stage_results r
    WHERE r.stage_id=p_stage_id AND r.player_key=v_from;

    UPDATE public.stage_entries
       SET player_key=v_to,updated_at=now()
     WHERE stage_id=p_stage_id AND player_key=v_from;

    UPDATE public.stage_results
       SET player_key=v_to,updated_at=now()
     WHERE stage_id=p_stage_id AND player_key=v_from;

    IF v_points <> 0 THEN
      FOR v_scope IN SELECT unnest(ARRAY[v_stage.championship,'geral']) LOOP
        UPDATE public.rankings
           SET points=greatest(0,points-v_points),updated_at=now()
         WHERE season=v_stage.season AND scope=v_scope AND player_key=v_from;

        INSERT INTO public.rankings(season,scope,player_key,points,discard,updated_at)
        VALUES(v_stage.season,v_scope,v_to,v_points,0,now())
        ON CONFLICT (season,scope,player_key) DO UPDATE
          SET points=public.rankings.points+EXCLUDED.points,
              updated_at=now();
      END LOOP;
    END IF;
    v_changed := v_changed+1;
  END LOOP;
  RETURN v_saved || jsonb_build_object('player_remaps',v_changed);
END;
$function$;

REVOKE ALL ON FUNCTION public.plp_admin_correct_stage_v60(
  uuid,numeric,numeric,numeric,numeric,jsonb,jsonb,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.plp_admin_correct_stage_v60(
  uuid,numeric,numeric,numeric,numeric,jsonb,jsonb,jsonb
) TO authenticated;
