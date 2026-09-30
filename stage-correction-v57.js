/* PLP V57 • correção administrativa de etapas encerradas */
(() => {
  'use strict';

  const BUILD = '57';
  const state = {
    ready: false,
    loading: false,
    stages: [],
    current: null,
    selectedStageId: null
  };

  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const money = value => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num(value));

  const fmtDate = value => {
    if (!value) return '—';
    const [y,m,d] = String(value).slice(0,10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : String(value);
  };

  const toast = message => {
    if (typeof showToast === 'function') showToast(message);
  };

  function adminReady() {
    try {
      return Boolean(backendReady && isAdmin && supa);
    } catch (_) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('plpV57Styles')) return;
    const style = document.createElement('style');
    style.id = 'plpV57Styles';
    style.textContent = `
      #stageCorrectionV57 .v57-shell{display:grid;gap:12px}
      #stageCorrectionV57 .v57-card{border:1px solid var(--line-soft);border-radius:18px;background:rgba(10,10,9,.88);padding:14px;box-shadow:0 16px 34px rgba(0,0,0,.22)}
      #stageCorrectionV57 .v57-card h3{margin:0 0 4px;font-size:13px}
      #stageCorrectionV57 .v57-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.45}
      #stageCorrectionV57 .v57-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end}
      #stageCorrectionV57 .v57-field{display:grid;gap:5px;min-width:0}
      #stageCorrectionV57 .v57-field label{font-size:8px;font-weight:850;letter-spacing:.45px;text-transform:uppercase;color:var(--gold2)}
      #stageCorrectionV57 .v57-field input,#stageCorrectionV57 .v57-field select{width:100%;min-width:0;border:1px solid var(--line-soft);border-radius:11px;background:#0d0c09;color:#fff;padding:10px 9px;font:inherit;font-size:10px}
      #stageCorrectionV57 .v57-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
      #stageCorrectionV57 .v57-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
      #stageCorrectionV57 .v57-summary div{border:1px solid rgba(255,255,255,.07);border-radius:12px;background:#0d0c09;padding:10px;min-width:0}
      #stageCorrectionV57 .v57-summary span{display:block;color:var(--muted);font-size:8px}
      #stageCorrectionV57 .v57-summary b{display:block;margin-top:4px;font-size:12px;overflow-wrap:anywhere}
      #stageCorrectionV57 .v57-section-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:16px 0 8px}
      #stageCorrectionV57 .v57-section-head h4{margin:0;font-size:11px}
      #stageCorrectionV57 .v57-section-head span{color:var(--muted);font-size:8px;text-align:right}
      #stageCorrectionV57 .v57-payment-row{display:grid;grid-template-columns:minmax(95px,1.25fr) minmax(110px,.9fr) minmax(80px,.65fr);gap:7px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06)}
      #stageCorrectionV57 .v57-result-row{display:grid;grid-template-columns:36px minmax(95px,1.25fr) 80px 92px;gap:7px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06)}
      #stageCorrectionV57 .v57-name{min-width:0}
      #stageCorrectionV57 .v57-name b{display:block;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #stageCorrectionV57 .v57-name small{display:block;margin-top:2px;color:var(--muted);font-size:8px}
      #stageCorrectionV57 .v57-pos{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#242117;color:var(--gold2);font-weight:900;font-size:10px}
      #stageCorrectionV57 .v57-note{margin-top:10px;padding:10px;border:1px solid rgba(244,201,20,.18);border-radius:12px;background:rgba(244,201,20,.045);color:var(--muted);font-size:8.5px;line-height:1.45}
      #stageCorrectionV57 .v57-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
      #stageCorrectionV57 .v57-actions .btn{min-width:150px}
      #stageCorrectionV57 .v57-badge{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid rgba(123,230,179,.25);background:rgba(123,230,179,.08);color:var(--good);font-size:8px;font-weight:850}
      #stageCorrectionV57 .v57-badge.open{border-color:rgba(244,201,20,.28);background:rgba(244,201,20,.07);color:var(--gold2)}
      #stageCorrectionV57 .v57-empty{padding:22px 12px;text-align:center;color:var(--muted);font-size:10px}
      @media(max-width:650px){
        #stageCorrectionV57 .v57-toolbar{grid-template-columns:1fr}
        #stageCorrectionV57 .v57-grid{grid-template-columns:1fr 1fr}
        #stageCorrectionV57 .v57-summary{grid-template-columns:1fr 1fr}
        #stageCorrectionV57 .v57-payment-row{grid-template-columns:minmax(90px,1.1fr) minmax(105px,.9fr)}
        #stageCorrectionV57 .v57-payment-row .v57-amount{grid-column:2}
        #stageCorrectionV57 .v57-result-row{grid-template-columns:32px minmax(86px,1fr) 70px}
        #stageCorrectionV57 .v57-result-row .v57-prize{grid-column:2/4}
      }
      @media(max-width:390px){
        #stageCorrectionV57 .v57-grid,#stageCorrectionV57 .v57-summary{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    const grid = document.querySelector('#admin .admin-grid');
    if (grid && !document.getElementById('stageCorrectionActionV57')) {
      const button = document.createElement('button');
      button.className = 'admin-action';
      button.id = 'stageCorrectionActionV57';
      button.dataset.go = 'stageCorrectionV57';
      button.innerHTML = '<span class="ico">✎</span><span><b>Corrigir etapa</b><span>Pontos, pagamentos e financeiro mesmo após encerrar</span></span>';
      grid.appendChild(button);
    }

    const main = document.querySelector('main');
    if (!main || document.getElementById('stageCorrectionV57')) return;
    const section = document.createElement('section');
    section.className = 'screen';
    section.id = 'stageCorrectionV57';
    section.innerHTML = `
      <div class="screen-top">
        <div class="screen-top-inner">
          <img class="mini-logo" src="assets/plp-logo-v47.png">
          <div><h2>Correção de Etapa</h2><p>Edite histórico sem reabrir o torneio</p></div>
          <button class="back-home" data-go="admin">‹</button>
        </div>
      </div>
      <div class="v57-shell">
        <div class="v57-card">
          <div class="v57-toolbar">
            <div class="v57-field">
              <label for="v57StageSelect">Etapa</label>
              <select id="v57StageSelect"><option value="">Carregando etapas…</option></select>
            </div>
            <button type="button" class="btn ghost" id="v57Reload">Atualizar dados</button>
          </div>
        </div>
        <div id="v57Body"><div class="v57-card"><div class="v57-empty">Selecione uma etapa para corrigir.</div></div></div>
      </div>`;
    main.appendChild(section);
  }

  function stageLabel(stage) {
    const status = stage.status === 'finalized' ? 'ENCERRADA' : 'EM ANDAMENTO';
    return `${String(stage.championship || '').toUpperCase()} • ${stage.stage_number}ª etapa • ${fmtDate(stage.stage_date)} • ${status}`;
  }

  async function loadStages(force = false) {
    if (!adminReady()) {
      const body = document.getElementById('v57Body');
      if (body) body.innerHTML = '<div class="v57-card"><div class="v57-empty">Entre com uma conta administrativa para corrigir uma etapa.</div></div>';
      return;
    }
    if (state.loading && !force) return;
    state.loading = true;
    try {
      const {data,error} = await supa.from('stages')
        .select('id,season,championship,stage_number,stage_date,status,buy_in,collected_amount,jackpot_amount,prize_pool,financial_mode')
        .eq('season', 2026)
        .in('status', ['finalized','open'])
        .order('stage_date', {ascending:false});
      if (error) throw error;
      state.stages = data || [];
      const select = document.getElementById('v57StageSelect');
      if (!select) return;
      const previous = state.selectedStageId || select.value;
      select.innerHTML = state.stages.map(stage =>
        `<option value="${esc(stage.id)}">${esc(stageLabel(stage))}</option>`
      ).join('') || '<option value="">Nenhuma etapa disponível</option>';
      const preferred = state.stages.some(stage => stage.id === previous)
        ? previous
        : (state.stages.find(stage => stage.status === 'finalized')?.id || state.stages[0]?.id || '');
      select.value = preferred;
      state.selectedStageId = preferred;
      if (preferred) await loadStage(preferred);
    } catch (error) {
      console.error('[PLP V57] load stages', error);
      toast('Não foi possível carregar as etapas.');
    } finally {
      state.loading = false;
    }
  }

  async function loadStage(stageId) {
    if (!adminReady() || !stageId) return;
    state.selectedStageId = stageId;
    const body = document.getElementById('v57Body');
    if (body) body.innerHTML = '<div class="v57-card"><div class="v57-empty">Carregando dados da etapa…</div></div>';
    try {
      const [stageQ,entriesQ,resultsQ,playersQ] = await Promise.all([
        supa.from('stages').select('*').eq('id', stageId).maybeSingle(),
        supa.from('stage_entries').select('*').eq('stage_id', stageId).order('list_position'),
        supa.from('stage_results').select('*').eq('stage_id', stageId).order('position'),
        supa.from('players').select('player_key,name').order('name')
      ]);
      if (stageQ.error || !stageQ.data) throw stageQ.error || new Error('Etapa não encontrada');
      if (entriesQ.error) throw entriesQ.error;
      if (resultsQ.error) throw resultsQ.error;
      if (playersQ.error) throw playersQ.error;
      const names = new Map((playersQ.data || []).map(player => [player.player_key, player.name]));
      state.current = {
        stage: stageQ.data,
        entries: (entriesQ.data || []).map(entry => ({...entry, name:names.get(entry.player_key) || entry.player_key})),
        results: (resultsQ.data || []).map(result => ({...result, name:names.get(result.player_key) || result.player_key}))
      };
      renderStage();
    } catch (error) {
      console.error('[PLP V57] load stage', error);
      if (body) body.innerHTML = '<div class="v57-card"><div class="v57-empty">Não foi possível carregar esta etapa.</div></div>';
    }
  }

  function paymentOptions(status) {
    return [
      ['confirmed','Pago confirmado'],
      ['pending','Pendente'],
      ['informed','Pagamento informado'],
      ['exempt','Isento']
    ].map(([value,label]) => `<option value="${value}" ${status===value?'selected':''}>${label}</option>`).join('');
  }

  function renderStage() {
    const body = document.getElementById('v57Body');
    const data = state.current;
    if (!body || !data?.stage) return;
    const {stage,entries,results} = data;
    const buyIn = num(stage.buy_in) || 60;
    const confirmedEntries = entries.filter(entry => entry.payment_status === 'confirmed' && !entry.is_host);
    const paidTotal = confirmedEntries.reduce((sum,entry) => sum + (entry.amount_paid == null ? buyIn : num(entry.amount_paid)), 0);
    const storedCollected = stage.collected_amount == null ? paidTotal : num(stage.collected_amount);
    const storedJackpot = stage.jackpot_amount == null ? confirmedEntries.length * 10 : num(stage.jackpot_amount);
    const storedPrize = stage.prize_pool == null ? confirmedEntries.length * 50 : num(stage.prize_pool);

    const paymentRows = entries.map(entry => {
      const isHost = Boolean(entry.is_host);
      const amount = entry.payment_status === 'confirmed'
        ? (entry.amount_paid == null ? buyIn : num(entry.amount_paid))
        : '';
      return `<div class="v57-payment-row" data-v57-entry="${esc(entry.player_key)}">
        <div class="v57-name"><b>${esc(entry.name)}</b><small>${isHost?'Anfitrião / isento':'Participante'}</small></div>
        <select class="v57-payment" ${isHost?'disabled':''}>${paymentOptions(isHost?'exempt':entry.payment_status)}</select>
        <input class="v57-amount" type="number" min="0" step="0.01" placeholder="Valor pago" value="${esc(amount)}" ${isHost?'disabled':''}>
      </div>`;
    }).join('') || '<div class="v57-empty">Nenhum participante registrado.</div>';

    const resultRows = results.map(result => `<div class="v57-result-row" data-v57-result="${result.position}">
      <div class="v57-pos">${result.position}º</div>
      <div class="v57-name"><b>${esc(result.name)}</b><small>${esc(result.player_key)}</small></div>
      <input class="v57-points" type="number" min="0" step="1" value="${num(result.points)}" aria-label="Pontos de ${esc(result.name)}">
      <input class="v57-prize" type="number" min="0" step="0.01" placeholder="Prêmio" value="${result.prize == null ? '' : num(result.prize)}" aria-label="Prêmio de ${esc(result.name)}">
    </div>`).join('') || '<div class="v57-empty">Esta etapa ainda não possui resultado.</div>';

    body.innerHTML = `
      <div class="v57-card">
        <div class="v57-section-head">
          <div><h3>${esc(String(stage.championship).toUpperCase())} • ${stage.stage_number}ª Etapa</h3><p>${fmtDate(stage.stage_date)} • ${entries.length} jogador${entries.length===1?'':'es'}</p></div>
          <span class="v57-badge ${stage.status==='open'?'open':''}">${stage.status==='finalized'?'ENCERRADA':'EM ANDAMENTO'}</span>
        </div>
        <div class="v57-grid">
          <div class="v57-field"><label>Buy-in</label><input id="v57BuyIn" type="number" min="0" step="0.01" value="${buyIn}"></div>
          <div class="v57-field"><label>Arrecadação</label><input id="v57Collected" type="number" min="0" step="0.01" value="${storedCollected}"></div>
          <div class="v57-field"><label>Jackpot da etapa</label><input id="v57Jackpot" type="number" min="0" step="0.01" value="${storedJackpot}"></div>
          <div class="v57-field"><label>Premiação da etapa</label><input id="v57PrizePool" type="number" min="0" step="0.01" value="${storedPrize}"></div>
        </div>
        <div class="v57-summary">
          <div><span>Pagamentos confirmados</span><b id="v57ConfirmedCount">${confirmedEntries.length}</b></div>
          <div><span>Total efetivamente marcado pago</span><b id="v57PaidTotal">${money(paidTotal)}</b></div>
          <div><span>Modo após salvar</span><b>MANUAL / CORRIGIDO</b></div>
        </div>
        <div class="v57-actions"><button type="button" class="btn ghost" id="v57RecalcFinance">Recalcular pelos pagamentos</button></div>

        <div class="v57-section-head"><h4>Pagamentos da etapa</h4><span>“PIX PG” passa a entrar como pago confirmado</span></div>
        <div id="v57Payments">${paymentRows}</div>

        <div class="v57-section-head"><h4>Classificação e pontos</h4><span>Ajustar pontos recalcula BR e ranking geral pela diferença</span></div>
        <div id="v57Results">${resultRows}</div>

        <div class="v57-note">Salvar aqui não reabre a rodada e não altera a ordem de eliminação. O sistema grava o financeiro corrigido, pagamentos, pontos e premiações individuais diretamente no histórico.</div>
        <div class="v57-actions"><button type="button" class="btn gold" id="v57Save">Salvar correção da etapa</button></div>
      </div>`;

    bindStageControls();
    refreshPaymentSummary();
  }

  function confirmedPaymentData() {
    const buyIn = num(document.getElementById('v57BuyIn')?.value);
    const rows = [...document.querySelectorAll('[data-v57-entry]')];
    return rows.map(row => {
      const key = row.dataset.v57Entry;
      const source = state.current?.entries?.find(entry => entry.player_key === key);
      const status = source?.is_host ? 'exempt' : (row.querySelector('.v57-payment')?.value || 'pending');
      const input = row.querySelector('.v57-amount');
      let amount = null;
      if (status === 'confirmed') {
        const parsed = Number(input?.value);
        amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : buyIn;
      }
      return {player_key:key,payment_status:status,amount_paid:amount,is_host:Boolean(source?.is_host)};
    });
  }

  function refreshPaymentSummary() {
    const rows = confirmedPaymentData();
    const confirmed = rows.filter(row => row.payment_status === 'confirmed' && !row.is_host);
    const total = confirmed.reduce((sum,row) => sum + num(row.amount_paid), 0);
    const count = document.getElementById('v57ConfirmedCount');
    const paid = document.getElementById('v57PaidTotal');
    if (count) count.textContent = String(confirmed.length);
    if (paid) paid.textContent = money(total);
  }

  function recalcFinance() {
    const rows = confirmedPaymentData();
    const confirmed = rows.filter(row => row.payment_status === 'confirmed' && !row.is_host);
    const total = confirmed.reduce((sum,row) => sum + num(row.amount_paid), 0);
    const collected = document.getElementById('v57Collected');
    const jackpot = document.getElementById('v57Jackpot');
    const prize = document.getElementById('v57PrizePool');
    if (collected) collected.value = String(total);
    if (jackpot) jackpot.value = String(confirmed.length * 10);
    if (prize) prize.value = String(confirmed.length * 50);
    refreshPaymentSummary();
    toast('Financeiro recalculado pelos pagamentos confirmados.');
  }

  function bindStageControls() {
    document.querySelectorAll('#v57Payments .v57-payment').forEach(select => {
      select.addEventListener('change', event => {
        const row = event.currentTarget.closest('[data-v57-entry]');
        const amount = row?.querySelector('.v57-amount');
        if (amount) {
          if (event.currentTarget.value === 'confirmed' && amount.value === '') {
            amount.value = String(num(document.getElementById('v57BuyIn')?.value) || 60);
          }
          amount.disabled = event.currentTarget.value !== 'confirmed';
        }
        refreshPaymentSummary();
      });
    });
    document.querySelectorAll('#v57Payments .v57-amount').forEach(input => {
      const row = input.closest('[data-v57-entry]');
      const select = row?.querySelector('.v57-payment');
      if (!input.disabled) input.disabled = select?.value !== 'confirmed';
      input.addEventListener('input', refreshPaymentSummary);
    });
    document.getElementById('v57BuyIn')?.addEventListener('input', refreshPaymentSummary);
    document.getElementById('v57RecalcFinance')?.addEventListener('click', recalcFinance);
    document.getElementById('v57Save')?.addEventListener('click', saveCorrection);
  }

  function readNonNegative(id) {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  async function saveCorrection() {
    if (!adminReady() || !state.current?.stage) return toast('Sessão administrativa necessária.');
    const buyIn = readNonNegative('v57BuyIn');
    const collected = readNonNegative('v57Collected');
    const jackpot = readNonNegative('v57Jackpot');
    const prizePool = readNonNegative('v57PrizePool');
    if ([buyIn,collected,jackpot,prizePool].some(value => value === null)) {
      return toast('Revise os valores financeiros.');
    }

    const entries = confirmedPaymentData().map(({player_key,payment_status,amount_paid}) => ({
      player_key,payment_status,amount_paid
    }));

    const results = [...document.querySelectorAll('[data-v57-result]')].map(row => {
      const position = Number(row.dataset.v57Result);
      const points = Number(row.querySelector('.v57-points')?.value);
      const prizeRaw = row.querySelector('.v57-prize')?.value;
      const prize = prizeRaw === '' ? null : Number(prizeRaw);
      return {position,points,prize};
    });

    if (results.some(row => !Number.isInteger(row.position) || row.position < 1 || !Number.isFinite(row.points) || row.points < 0 || (row.prize !== null && (!Number.isFinite(row.prize) || row.prize < 0)))) {
      return toast('Revise pontos e premiações da classificação.');
    }

    const button = document.getElementById('v57Save');
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando correção…';
    }

    try {
      const {data,error} = await supa.rpc('plp_admin_correct_stage', {
        p_stage_id: state.current.stage.id,
        p_buy_in: buyIn,
        p_collected: collected,
        p_jackpot: jackpot,
        p_prize_pool: prizePool,
        p_entries: entries,
        p_results: results
      });
      if (error) throw error;
      toast('Etapa corrigida. Ranking e financeiro atualizados.');
      await loadStage(state.current.stage.id);
      window.setTimeout(() => {
        try {
          if (window.PLP_UPDATE?.check) window.PLP_UPDATE.check();
        } catch (_) {}
      }, 250);
      return data;
    } catch (error) {
      console.error('[PLP V57] save correction', error);
      toast(error?.message || 'Não foi possível salvar a correção.');
      if (button) {
        button.disabled = false;
        button.textContent = 'Salvar correção da etapa';
      }
    }
  }

  function bindGlobalEvents() {
    document.getElementById('v57StageSelect')?.addEventListener('change', event => {
      const id = event.currentTarget.value;
      if (id) loadStage(id);
    });
    document.getElementById('v57Reload')?.addEventListener('click', () => loadStages(true));
    document.addEventListener('click', event => {
      const go = event.target.closest?.('[data-go]')?.dataset.go;
      if (go === 'stageCorrectionV57') {
        window.setTimeout(() => loadStages(true), 70);
      }
    });
  }

  async function init() {
    injectStyles();
    injectUi();
    bindGlobalEvents();
    let tries = 0;
    while (!adminReady() && tries < 80) {
      tries += 1;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    state.ready = true;
    if (adminReady()) await loadStages(true);
    window.PLP_STAGE_CORRECTION = {
      build: BUILD,
      refresh: () => loadStages(true),
      openStage: loadStage
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), {once:true});
  } else {
    setTimeout(init, 0);
  }
})();
