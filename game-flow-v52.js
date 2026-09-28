/* PLP V52 • fluxo guiado do Dia de Jogo, isenções independentes e relatórios PDF */
(() => {
  'use strict';

  const BUILD = '52';
  const TOP4_PRIZES = {
    7:[150,90,60,0], 8:[170,105,75,0], 9:[190,120,90,0], 10:[210,135,105,0],
    11:[210,135,105,50], 12:[225,150,115,60], 13:[240,165,125,70], 14:[255,180,135,80],
    15:[270,195,145,90], 16:[285,210,155,100], 17:[285,210,155,100], 18:[295,220,165,110],
    19:[305,230,175,120], 20:[315,240,185,130], 21:[325,250,195,140], 22:[335,260,205,150]
  };

  const V52 = {
    ready:false,
    busy:false,
    editingSetup:false,
    selectedStageId:null,
    lastFlowSignature:'',
    lastCalcSignature:'',
    lastTop4CheckAt:0,
    lastActiveCount:null,
    top4DismissedUntil:0,
    observer:null,
    timer:null,
    channel:null,
    scripts:new Map()
  };
  window.PLP_V52 = V52;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const comparable = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const money = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(value) || 0);
  const formatDate = value => {
    if (!value) return '—';
    const [y,m,d] = String(value).slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  };
  const normalizeName = value => {
    const raw = clean(value);
    try { return typeof normalizePlayerName === 'function' ? normalizePlayerName(raw) : raw; }
    catch (_) { return raw; }
  };
  const keyForName = value => {
    const name = normalizeName(value);
    if (comparable(name) === 'daniel all capone') return 'daniel';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jogador';
  };

  function toast(message) {
    try { if (typeof showToast === 'function') return showToast(message); } catch (_) {}
    console.log('[PLP V52]', message);
  }

  function backendReady() {
    try { return typeof supa !== 'undefined' && !!supa; } catch (_) { return false; }
  }

  function adminReady() {
    try { return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; } catch (_) { return false; }
  }

  function pointFor(position, field) {
    const offsets = [8,4,1,-1,-3,-5,-6];
    if (position <= 7) return Math.max(1, field + offsets[position - 1]);
    return Math.max(1, field - (position - 1));
  }

  function selectedStageId() {
    return document.getElementById('gdStageSelect')?.value
      || window.PLP_V18?.selectedStageId
      || sessionStorage.getItem('plpV52TargetStageId')
      || window.PLP_V19?.snapshot?.stage?.id
      || null;
  }

  async function fetchStageData(stageId = selectedStageId()) {
    if (!backendReady() || !stageId) return null;
    const [stageQ, entriesQ, playersQ, planQ] = await Promise.all([
      supa.from('stages').select('*').eq('id', stageId).maybeSingle(),
      supa.from('stage_entries').select('*').eq('stage_id', stageId).order('list_position'),
      supa.from('players').select('player_key,name,active').order('name'),
      supa.from('stage_finish_plans').select('*').eq('stage_id', stageId).order('position')
    ]);
    if (stageQ.error || !stageQ.data || entriesQ.error) return null;
    const players = playersQ.data || [];
    const names = new Map(players.map(player => [player.player_key, normalizeName(player.name)]));
    const entries = (entriesQ.data || []).map(entry => ({...entry, name:names.get(entry.player_key) || entry.player_key}));
    return { stage:stageQ.data, entries, players, plan:planQ.error ? [] : (planQ.data || []) };
  }

  async function ensurePlayer(name, players = []) {
    const normalized = normalizeName(name);
    if (normalized.length < 2) throw new Error('Nome inválido');
    const existing = players.find(player => comparable(player.name) === comparable(normalized));
    const key = existing?.player_key || keyForName(normalized);
    const finalName = existing?.name ? normalizeName(existing.name) : normalized;
    const {error} = await supa.from('players').upsert({player_key:key,name:finalName,active:true,updated_at:new Date().toISOString()}, {onConflict:'player_key'});
    if (error) throw error;
    return {key, name:finalName};
  }

  function injectStyles() {
    if (document.getElementById('plpV52Styles')) return;
    const style = document.createElement('style');
    style.id = 'plpV52Styles';
    style.textContent = `
      .v52-flow{margin:10px 0 12px;padding:14px;border-radius:22px;border:1px solid rgba(244,201,20,.25);background:linear-gradient(145deg,rgba(22,19,11,.94),rgba(7,7,6,.97));box-shadow:0 16px 34px rgba(0,0,0,.25)}
      .v52-flow-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.v52-flow-head h3{margin:0;color:#ffe36a;font-size:17px}.v52-flow-head p{margin:4px 0 0;color:#c5bcaa;font-size:10px;line-height:1.45}.v52-phase{white-space:nowrap;padding:6px 9px;border-radius:999px;border:1px solid rgba(244,201,20,.28);background:rgba(244,201,20,.08);color:#ffe36a;font-size:8px;font-weight:950;letter-spacing:.7px}
      .v52-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:12px 0}.v52-step{min-width:0;padding:8px 5px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);text-align:center}.v52-step b{display:block;font-size:10px;color:#817b6c}.v52-step span{display:block;margin-top:3px;font-size:7px;color:#817b6c;text-transform:uppercase}.v52-step.done{border-color:rgba(123,230,179,.22);background:rgba(123,230,179,.06)}.v52-step.done b,.v52-step.done span{color:#9beec8}.v52-step.current{border-color:rgba(244,201,20,.35);background:rgba(244,201,20,.09)}.v52-step.current b,.v52-step.current span{color:#ffe36a}
      .v52-setup{margin-top:10px;padding:12px;border-radius:17px;border:1px solid rgba(136,188,255,.18);background:rgba(136,188,255,.045)}.v52-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v52-field{display:grid;gap:5px}.v52-field.full{grid-column:1/-1}.v52-field label{font-size:9px;color:#e5d89f;font-weight:850;text-transform:uppercase;letter-spacing:.45px}.v52-input{width:100%;min-height:42px;border:1px solid rgba(244,201,20,.20);border-radius:12px;background:#0d0c09;color:#fff;padding:9px 11px;outline:none}.v52-input:focus{border-color:#f4c914;box-shadow:0 0 0 2px rgba(244,201,20,.08)}
      .v52-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:11px}.v52-actions.one{grid-template-columns:1fr}.v52-btn{min-height:43px;border-radius:13px;padding:9px 10px;font-size:10px;font-weight:900}.v52-primary{border:1px solid #f4c914;background:#f4c914;color:#151006}.v52-ghost{border:1px solid rgba(244,201,20,.25);background:rgba(244,201,20,.06);color:#ffe36a}.v52-good{border:1px solid rgba(123,230,179,.34);background:rgba(123,230,179,.10);color:#a6f2cf}.v52-btn:disabled{opacity:.4;cursor:not-allowed}
      .v52-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.v52-summary>div{padding:9px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.v52-summary span{display:block;color:#afa692;font-size:8px}.v52-summary b{display:block;margin-top:4px;color:#fff;font-size:12px}.v52-note{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);color:#c8c0ae;font-size:9px;line-height:1.45}.v52-note strong{color:#ffe36a}
      .v52-plan{margin-top:9px;padding:10px;border-radius:14px;border:1px solid rgba(123,230,179,.20);background:rgba(123,230,179,.055)}.v52-plan b{color:#a5f0cb;font-size:10px}.v52-plan span{display:block;margin-top:4px;color:#d7e8df;font-size:9px}
      .v52-modal{position:fixed;inset:0;z-index:18000;display:flex;align-items:flex-end;justify-content:center;padding:10px;background:rgba(0,0,0,.82);backdrop-filter:blur(9px)}.v52-modal-card{width:min(100%,520px);max-height:94vh;overflow:auto;padding:17px;border-radius:26px 26px 18px 18px;border:1px solid rgba(244,201,20,.36);background:linear-gradient(180deg,#17130b,#070706);box-shadow:0 30px 80px rgba(0,0,0,.65)}.v52-modal-head{display:flex;gap:10px;align-items:flex-start}.v52-modal-head>div{flex:1}.v52-modal-head h3{margin:0;color:#ffe36a;font-size:19px}.v52-modal-head p{margin:5px 0 0;color:#c5bcaa;font-size:10px;line-height:1.45}.v52-close{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-weight:900}
      .v52-plan-table{display:grid;gap:7px;margin-top:12px}.v52-plan-row{display:grid;grid-template-columns:52px 1fr 1fr;gap:7px;align-items:end;padding:9px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}.v52-plan-row strong{align-self:center;color:#ffe36a}.v52-check{display:flex;align-items:flex-start;gap:8px;margin-top:11px;padding:10px;border-radius:13px;background:rgba(136,188,255,.06);border:1px solid rgba(136,188,255,.16);color:#d2e4fa;font-size:9px;line-height:1.45}.v52-check input{margin-top:2px}
      .v52-report-card{margin-top:10px}.v52-report-card h3{margin:0}.v52-report-card p{margin:4px 0 0;color:#c5bcaa;font-size:10px;line-height:1.45}
      #gameDay.v52-game-running #v19AdminRegistrations{margin-top:10px}#gameDay.v52-game-running #v25EliminationAdmin{order:-1}
      @media(max-width:520px){.v52-form-grid{grid-template-columns:1fr}.v52-field.full{grid-column:auto}.v52-summary{grid-template-columns:repeat(2,1fr)}.v52-steps{grid-template-columns:repeat(5,minmax(50px,1fr));overflow:auto}.v52-plan-row{grid-template-columns:46px 1fr 1fr}.v52-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function phaseFor(stage, entries) {
    if (stage.status === 'finalized') return {key:'final', label:'FINALIZADA', index:5};
    if (stage.game_started) return {key:'game', label:'JOGO EM ANDAMENTO', index:4};
    if (stage.registration_closed) return {key:'closed', label:'LISTA FINALIZADA', index:3};
    if (stage.status === 'open') return {key:'list', label:'LISTA ABERTA', index:2};
    const configured = Boolean(stage.host_name && stage.location);
    return {key:configured?'ready':'setup', label:configured?'PRONTA PARA ABRIR':'CONFIGURAÇÃO INICIAL', index:configured?1:0};
  }

  function flowSignature(data) {
    const {stage, entries, plan} = data;
    const active = entries.filter(e => !e.eliminated_at && !e.elimination_order).length;
    return [stage.id,stage.updated_at,stage.status,stage.stage_date,stage.host_name,stage.location,stage.registration_closed,stage.game_started,entries.length,active,plan.length].join('|');
  }

  function stepsHtml(current) {
    const steps = [['1','Dados'],['2','Lista'],['3','Fechar'],['4','Jogo'],['5','Final']];
    return steps.map((step, i) => {
      const number = i + 1;
      const cls = number < current ? 'done' : number === current ? 'current' : '';
      return `<div class="v52-step ${cls}"><b>${step[0]}</b><span>${step[1]}</span></div>`;
    }).join('');
  }

  function setupHtml(data) {
    const {stage, players} = data;
    const options = players.filter(p => p.active !== false).map(p => `<option value="${esc(normalizeName(p.name))}"></option>`).join('');
    return `<div class="v52-setup">
      <div class="v52-form-grid">
        <div class="v52-field full"><label for="v52StageDate">Data da etapa</label><input class="v52-input" id="v52StageDate" type="date" value="${esc(stage.stage_date || '')}"></div>
        <div class="v52-field full"><label for="v52Location">Local</label><input class="v52-input" id="v52Location" maxlength="120" placeholder="Ex.: Casa do Géio - Rua..." value="${esc(stage.location || '')}"></div>
        <div class="v52-field full"><label for="v52Host">Anfitrião</label><input class="v52-input" id="v52Host" list="v52Players" maxlength="60" placeholder="Nome do anfitrião" value="${esc(stage.host_name || '')}"><datalist id="v52Players">${options}</datalist></div>
      </div>
      <div class="v52-note"><strong>Anfitrião:</strong> fica sempre no topo da lista, é marcado como isento e identificado como local. Outro jogador também pode ser isento sem se tornar anfitrião. A lista normalmente deve ser encerrada até <strong>18:00</strong>.</div>
      <div class="v52-actions"><button class="v52-btn v52-ghost" type="button" id="v52CancelSetup">Cancelar</button><button class="v52-btn v52-primary" type="button" id="v52SaveSetup">Salvar e abrir inscrições</button></div>
    </div>`;
  }

  function renderFlow(data, {force=false, openSetup=false}={}) {
    const gameDay = document.getElementById('gameDay');
    const anchor = document.querySelector('#gameDay > .v18-card');
    if (!gameDay || !anchor || !gameDay.classList.contains('active')) return;
    const activeElement = document.activeElement;
    const existing = document.getElementById('v52GameFlow');
    if (existing?.contains(activeElement) && !force) return;

    const signature = flowSignature(data);
    if (!force && !openSetup && signature === V52.lastFlowSignature && existing) return;
    V52.lastFlowSignature = signature;
    V52.selectedStageId = data.stage.id;
    sessionStorage.setItem('plpV52TargetStageId', data.stage.id);

    const {stage, entries, plan} = data;
    const phase = phaseFor(stage, entries);
    const active = entries.filter(e => !e.eliminated_at && !e.elimination_order).length;
    const payers = entries.filter(e => e.payment_status !== 'exempt').length;
    const exempt = entries.filter(e => e.payment_status === 'exempt').length;
    const host = entries.find(e => e.is_host);
    const setupOpen = openSetup || V52.editingSetup || stage.status === 'scheduled';
    const currentStep = Math.max(1, Math.min(5, phase.index));
    const planTotal = plan.reduce((sum,row) => sum + (Number(row.prize) || 0), 0);

    const card = existing || document.createElement('div');
    card.id = 'v52GameFlow';
    card.className = 'v52-flow';
    card.innerHTML = `<div class="v52-flow-head"><div><h3>Fluxo do Dia de Jogo</h3><p>${esc(stage.championship.toUpperCase())} • ${stage.stage_number}ª Etapa • ${formatDate(stage.stage_date)}</p></div><span class="v52-phase">${phase.label}</span></div>
      <div class="v52-steps">${stepsHtml(currentStep)}</div>
      <div class="v52-summary"><div><span>Local</span><b>${esc(stage.location || 'A definir')}</b></div><div><span>Anfitrião</span><b>${esc(stage.host_name || host?.name || 'A definir')}</b></div><div><span>Inscritos</span><b>${entries.length}</b></div><div><span>Pagantes / isentos</span><b>${payers} / ${exempt}</b></div></div>
      ${setupOpen ? setupHtml(data) : ''}
      ${plan.length ? `<div class="v52-plan"><b>Premiação e pontos do Top 4 confirmados</b><span>${plan.map(row => `${row.position}º: ${row.points} pts • ${money(row.prize)}`).join(' | ')} • Total ${money(planTotal)}</span></div>` : ''}
      <div class="v52-actions">
        ${!setupOpen && !stage.game_started && stage.status!=='finalized' ? '<button class="v52-btn v52-ghost" type="button" id="v52EditSetup">Editar dados iniciais</button>' : ''}
        ${!setupOpen && stage.status!=='finalized' && !stage.game_started ? '<button class="v52-btn v52-ghost" type="button" id="v52OpenImporter">Atualizar lista pelo WhatsApp</button>' : ''}
        ${stage.status==='open' && !stage.game_started ? `<button class="v52-btn v52-primary" type="button" id="v52StartGame" ${entries.length<2?'disabled':''}>Finalizar lista e iniciar Blind Clock</button>` : ''}
        ${stage.game_started ? '<button class="v52-btn v52-primary" type="button" id="v52OpenClock">Abrir Blind Clock</button><button class="v52-btn v52-good" type="button" id="v52GoEliminations">Ir para eliminações</button>' : ''}
        ${stage.status==='finalized' ? '<button class="v52-btn v52-good" type="button" id="v52GoFinal">Ver campeão e classificação</button>' : ''}
      </div>
      <div class="v52-note">A lista pode ser aplicada aos poucos. A indicação <strong>isento</strong> não transforma o participante em anfitrião; somente o anfitrião configurado acima permanece no topo.</div>`;

    if (!existing) anchor.insertAdjacentElement('afterend', card);
    gameDay.classList.toggle('v52-game-running', !!stage.game_started);
    bindFlowActions(data);
    patchStageLabels(data);
    patchFinancialDisplay(data);
    prioritizeEliminations(stage);
  }

  function bindFlowActions(data) {
    const stage = data.stage;
    const edit = document.getElementById('v52EditSetup');
    if (edit) edit.onclick = () => { V52.editingSetup = true; renderFlow(data,{force:true,openSetup:true}); };
    const cancel = document.getElementById('v52CancelSetup');
    if (cancel) cancel.onclick = () => { V52.editingSetup = false; renderFlow(data,{force:true}); };
    const save = document.getElementById('v52SaveSetup');
    if (save) save.onclick = () => saveSetup(data);
    const importer = document.getElementById('v52OpenImporter');
    if (importer) importer.onclick = () => {
      sessionStorage.setItem('plpV52TargetStageId', stage.id);
      try { goTo('importer'); } catch (_) {}
      setTimeout(patchImporter, 100);
    };
    const start = document.getElementById('v52StartGame');
    if (start) start.onclick = () => closeListAndStart(data);
    const clock = document.getElementById('v52OpenClock');
    if (clock) clock.onclick = () => { try { goTo('clockScreen'); } catch (_) {} };
    const elim = document.getElementById('v52GoEliminations');
    if (elim) elim.onclick = () => {
      const panel = document.getElementById('v25EliminationAdmin');
      if (panel) panel.scrollIntoView({behavior:'smooth',block:'start'}); else toast('Carregando controle de eliminações…');
    };
    const final = document.getElementById('v52GoFinal');
    if (final) final.onclick = () => {
      const panel = document.getElementById('v28FinalAdmin');
      if (panel) panel.scrollIntoView({behavior:'smooth',block:'start'}); else toast('Carregando classificação final…');
    };
  }

  async function saveSetup(data) {
    if (V52.busy || !adminReady()) return;
    const date = document.getElementById('v52StageDate')?.value;
    const location = clean(document.getElementById('v52Location')?.value);
    const hostName = normalizeName(document.getElementById('v52Host')?.value);
    if (!date || !location || hostName.length < 2) return toast('Informe a data, o local e o anfitrião.');
    V52.busy = true;
    const button = document.getElementById('v52SaveSetup');
    if (button) { button.disabled=true; button.textContent='Salvando…'; }
    try {
      const host = await ensurePlayer(hostName, data.players);
      const {error} = await supa.rpc('plp_admin_prepare_stage', {
        p_stage_id:data.stage.id,
        p_stage_date:date,
        p_location:location,
        p_host_key:host.key,
        p_host_name:host.name
      });
      if (error) throw error;
      V52.editingSetup = false;
      if (window.PLP_V18) window.PLP_V18.selectedStageId = data.stage.id;
      sessionStorage.setItem('plpV52TargetStageId', data.stage.id);
      toast('Informações salvas. Inscrições abertas e anfitrião no topo da lista.');
      await refreshSnapshots(data.stage.id);
      try { goTo('gameDay'); } catch (_) {}
      setTimeout(() => refreshFlow(true), 180);
    } catch (error) {
      console.error('[PLP V52] setup', error);
      toast('Não foi possível iniciar o Dia de Jogo.');
      if (button) { button.disabled=false; button.textContent='Salvar e abrir inscrições'; }
    } finally { V52.busy = false; }
  }

  async function closeListAndStart(data) {
    if (V52.busy || !adminReady()) return;
    const {stage, entries} = data;
    if (entries.length < 2) return toast('Inclua pelo menos dois jogadores antes de iniciar.');
    const host = entries.find(entry => entry.is_host);
    if (!host) return toast('Defina o anfitrião antes de iniciar.');
    const pending = entries.filter(entry => ['pending','informed'].includes(entry.payment_status)).length;
    const message = `Finalizar a lista com ${entries.length} jogadores e iniciar o Blind Clock?${pending ? `\n\nHá ${pending} pagamento(s) pendente(s) ou apenas informado(s).` : ''}`;
    if (!window.confirm(message)) return;
    V52.busy = true;
    const button = document.getElementById('v52StartGame');
    if (button) { button.disabled=true; button.textContent='Iniciando…'; }
    try {
      const {error} = await supa.rpc('plp_admin_close_and_start_stage', {p_stage_id:stage.id});
      if (error) throw error;
      toast('Lista finalizada. Blind Clock iniciado no Nível 1.');
      await refreshSnapshots(stage.id);
      setTimeout(() => {
        refreshFlow(true);
        const panel = document.getElementById('v25EliminationAdmin');
        if (panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
      }, 350);
    } catch (error) {
      console.error('[PLP V52] start', error);
      toast('Não foi possível iniciar o jogo.');
      if (button) { button.disabled=false; button.textContent='Finalizar lista e iniciar Blind Clock'; }
    } finally { V52.busy = false; }
  }

  async function refreshSnapshots(stageId) {
    try {
      const {data} = await supa.rpc('plp_public_stage_snapshot');
      if (data && window.PLP_V19) window.PLP_V19.snapshot = typeof normalizeStageSnapshot === 'function' ? normalizeStageSnapshot(data) : data;
    } catch (_) {}
    if (window.PLP_V18) window.PLP_V18.selectedStageId = stageId;
  }

  function prioritizeEliminations(stage) {
    const content = document.getElementById('gdContent');
    const panel = document.getElementById('v25EliminationAdmin');
    if (!content || !panel || !stage.game_started) return;
    if (content.firstElementChild !== panel) content.prepend(panel);
  }

  function patchStageLabels(data) {
    const {stage} = data;
    const location = stage.location || stage.host_name || 'A definir';
    const host = stage.host_name || 'A definir';
    const liveTitle = document.getElementById('liveStageV19Title');
    if (liveTitle && window.PLP_V19?.snapshot?.stage?.id === stage.id) {
      liveTitle.textContent = `${stage.championship.toUpperCase()} - ETAPA ${stage.stage_number} - LOCAL: ${location.toUpperCase()}`;
    }
    const publicLocation = document.querySelector('#stageLiveV19Body .v19-location');
    if (publicLocation && window.PLP_V19?.snapshot?.stage?.id === stage.id) {
      publicLocation.innerHTML = `LOCAL: <b>${esc(location.toUpperCase())}</b><br><small>ANFITRIÃO: ${esc(host.toUpperCase())}</small>`;
    }
    const gameHeader = document.querySelector('#gdContent .v18-live-title b');
    if (gameHeader) gameHeader.textContent = `${stage.championship.toUpperCase()} • Etapa ${stage.stage_number} • LOCAL: ${location.toUpperCase()} • ANFITRIÃO: ${host.toUpperCase()}`;
  }

  function patchFinancialDisplay(data) {
    const {stage, entries} = data;
    const payers = entries.filter(entry => entry.payment_status !== 'exempt').length;
    const buyin = Number(stage.buy_in) || 60;
    const calculated = {collected:payers*buyin, jackpot:payers*10, prize:payers*50};
    const signature = [stage.id,stage.financial_mode,payers,buyin,calculated.collected,calculated.jackpot,calculated.prize].join('|');
    V52.lastCalcSignature = signature;

    const adminSummary = document.querySelectorAll('#v19AdminRegistrations .v19-admin-summary > div');
    if (adminSummary[1]) adminSummary[1].querySelector('b').textContent = String(payers);
    if (stage.financial_mode !== 'manual') {
      [['gdCollected',calculated.collected],['gdJackpot',calculated.jackpot],['gdPrizePool',calculated.prize]].forEach(([id,value]) => {
        const input = document.getElementById(id);
        if (input && document.activeElement !== input) input.value = value;
      });
      const publicValues = document.querySelectorAll('#stageLiveV19Body .v19-finance-grid b');
      if (publicValues[0]) publicValues[0].textContent = money(calculated.collected);
      if (publicValues[1]) publicValues[1].textContent = money(calculated.prize);
      if (publicValues[2]) publicValues[2].textContent = money(calculated.jackpot);
    }
  }

  function patchPublicFinancialFromSnapshot() {
    const snapshot = window.PLP_V19?.snapshot;
    const stage = snapshot?.stage;
    const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
    if (!stage || !document.getElementById('stageLiveV19')?.classList.contains('active')) return;
    const payers = entries.filter(entry => entry.payment_status !== 'exempt').length;
    const exempt = entries.length - payers;
    const buyin = Number(stage.buy_in) || 60;
    const automatic = { collected:payers*buyin, jackpot:payers*10, prize:payers*50 };
    const manual = stage.financial_mode === 'manual';
    const values = {
      collected:manual && stage.collected_amount != null ? Number(stage.collected_amount) : automatic.collected,
      jackpot:manual && stage.jackpot_amount != null ? Number(stage.jackpot_amount) : automatic.jackpot,
      prize:manual && stage.prize_pool != null ? Number(stage.prize_pool) : automatic.prize
    };
    const publicValues = document.querySelectorAll('#stageLiveV19Body .v19-finance-grid b');
    if (publicValues[0]) publicValues[0].textContent = money(values.collected);
    if (publicValues[1]) publicValues[1].textContent = money(values.prize);
    if (publicValues[2]) publicValues[2].textContent = money(values.jackpot);
    const note = document.querySelector('#stageLiveV19Body .v19-finance-grid')?.nextElementSibling;
    if (note?.classList.contains('v19-note')) {
      note.textContent = `${payers} pagante${payers===1?'':'s'} e ${exempt} isento${exempt===1?'':'s'}. Anfitrião e demais isentos não entram na arrecadação.`;
    }
  }

  function rawSignupMarkers() {
    const text = document.getElementById('whatsappInput')?.value || '';
    const byNumber = new Map();
    text.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*(\d{1,3})\s*[-.)–—:]\s*(.+?)\s*$/);
      if (!match) return;
      const raw = match[2];
      const cleanedName = clean(raw
        .replace(/\b(?:pix\s*)?pg\b/ig,'')
        .replace(/\b(?:pago|pagou)\b/ig,'')
        .replace(/\b(?:isento|free|cortesia|nao paga|não paga)\b/ig,'')
        .replace(/[•|–—-]+\s*$/g,'')
      );
      byNumber.set(Number(match[1]), {
        name:cleanedName,
        exempt:/\b(isento|free|cortesia|nao paga|não paga)\b/i.test(raw),
        paid:/\b(?:pix\s*)?pg\b|\bpago\b|\bpagou\b/i.test(raw)
      });
    });
    return byNumber;
  }

  function normalizeParsedExemptions() {
    try {
      if (typeof signupParsed === 'undefined' || !Array.isArray(signupParsed)) return;
      const markers = rawSignupMarkers();
      const hostName = normalizeName(typeof signupMeta !== 'undefined' ? signupMeta?.host : '');
      signupParsed.forEach(player => {
        const mark = markers.get(Number(player.n));
        if (mark?.name) player.name = normalizeName(mark.name);
        const isHost = hostName && comparable(player.name) === comparable(hostName);
        if (mark?.exempt && !isHost) player.payment = 'isento';
        else if (mark?.paid && player.payment !== 'conferido' && !isHost) player.payment = 'informado';
        if (isHost) player.payment = 'isento';
      });
      if (typeof renderSignupOutput === 'function' && document.getElementById('signupOutput')?.children.length) renderSignupOutput(signupMeta || {});
    } catch (error) { console.warn('[PLP V52] parse exemptions', error); }
  }

  async function resolveTargetStage() {
    const metaBr = typeof signupMeta !== 'undefined' && signupMeta?.br ? `br${signupMeta.br}` : null;
    const metaStage = Number(typeof signupMeta !== 'undefined' ? signupMeta?.stage : 0);
    if (metaBr && metaStage) {
      const query = await supa.from('stages').select('*').eq('season',2026).eq('championship',metaBr).eq('stage_number',metaStage).maybeSingle();
      if (!query.error && query.data) return query.data;
    }
    const id = selectedStageId();
    if (!id) return null;
    const query = await supa.from('stages').select('*').eq('id',id).maybeSingle();
    return query.error ? null : query.data;
  }

  async function resequenceEntries(stageId, hostKey) {
    const query = await supa.from('stage_entries').select('player_key,list_position,is_host').eq('stage_id',stageId).order('list_position');
    if (query.error) return;
    const rows = query.data || [];
    rows.sort((a,b) => {
      if (a.player_key === hostKey) return -1;
      if (b.player_key === hostKey) return 1;
      return (Number(a.list_position)||9999) - (Number(b.list_position)||9999) || String(a.player_key).localeCompare(String(b.player_key));
    });
    for (let i=0;i<rows.length;i++) {
      const desired = i + 1;
      const isHost = rows[i].player_key === hostKey;
      if (Number(rows[i].list_position) === desired && Boolean(rows[i].is_host) === isHost) continue;
      await supa.from('stage_entries').update({list_position:desired,is_host:isHost,updated_at:new Date().toISOString()}).eq('stage_id',stageId).eq('player_key',rows[i].player_key);
    }
  }

  async function applyWhatsappSafe(all) {
    if (V52.busy || !adminReady()) return;
    if (typeof signupParsed === 'undefined' || !Array.isArray(signupParsed) || !signupParsed.length) return toast('Interprete uma lista antes de aplicar.');
    const stage = await resolveTargetStage();
    if (!stage) return toast('Selecione a etapa no Dia de Jogo antes de aplicar a lista.');
    let indices = all ? signupParsed.map((_,i) => i) : Array.from(typeof signupSelected !== 'undefined' ? signupSelected : []).sort((a,b)=>a-b);
    if (!all && !indices.length) return toast('Selecione pelo menos um jogador para aplicar.');
    indices = [...new Set(indices)].filter(index => signupParsed[index]);
    const data = await fetchStageData(stage.id);
    if (!data) return toast('Não foi possível carregar a etapa.');
    const markers = rawSignupMarkers();
    const explicitHostName = normalizeName(typeof signupMeta !== 'undefined' ? signupMeta?.host : '');
    const existingHost = data.entries.find(entry => entry.is_host);
    const hostName = explicitHostName || normalizeName(stage.host_name || existingHost?.name || '');
    let hostPlayer = null;
    V52.busy = true;
    try {
      if (hostName) {
        hostPlayer = await ensurePlayer(hostName, data.players);
        const {error} = await supa.rpc('plp_admin_prepare_stage', {
          p_stage_id:stage.id,
          p_stage_date:stage.stage_date,
          p_location:stage.location || hostName,
          p_host_key:hostPlayer.key,
          p_host_name:hostPlayer.name
        });
        if (error) throw error;
      }

      const currentMax = Math.max(1, ...data.entries.map(entry => Number(entry.list_position) || 0));
      const mapping = {informado:'informed',conferido:'confirmed',pendente:'pending',isento:'exempt'};
      const attendance = {presente:'present',faltou:'absent',nao_conferido:'unchecked'};
      const payload = [];
      for (let order=0; order<indices.length; order++) {
        const source = signupParsed[indices[order]];
        const marker = markers.get(Number(source.n));
        const sourceName = marker?.name ? normalizeName(marker.name) : source.name;
        const player = await ensurePlayer(sourceName, data.players);
        const isHost = Boolean(hostPlayer && player.key === hostPlayer.key);
        let payment = mapping[source.payment] || 'pending';
        if (marker?.exempt && !isHost) payment = 'exempt';
        else if (marker?.paid && payment === 'pending') payment = 'informed';
        if (isHost) payment = 'exempt';
        const existing = data.entries.find(entry => entry.player_key === player.key);
        const position = isHost ? 1 : (existing?.list_position || currentMax + order + 1);
        payload.push({
          stage_id:stage.id,
          player_key:player.key,
          list_position:Number(position),
          payment_status:payment,
          attendance_status:attendance[source.presence] || existing?.attendance_status || 'unchecked',
          amount_paid:payment === 'confirmed' ? Number(stage.buy_in || 60) : null,
          is_host:isHost,
          source:'whatsapp',
          updated_at:new Date().toISOString()
        });
      }
      if (payload.length) {
        const result = await supa.from('stage_entries').upsert(payload,{onConflict:'stage_id,player_key'});
        if (result.error) throw result.error;
      }
      await resequenceEntries(stage.id, hostPlayer?.key || existingHost?.player_key || null);
      if (window.PLP_V18) window.PLP_V18.selectedStageId = stage.id;
      sessionStorage.setItem('plpV52TargetStageId', stage.id);
      toast(`${payload.length} participante${payload.length===1?'':'s'} aplicado${payload.length===1?'':'s'}. Isentos permanecem separados do anfitrião.`);
      await refreshSnapshots(stage.id);
      if (document.getElementById('gameDay')?.classList.contains('active')) setTimeout(()=>refreshFlow(true),150);
    } catch (error) {
      console.error('[PLP V52] apply whatsapp', error);
      toast('Não foi possível aplicar a lista.');
    } finally { V52.busy = false; }
  }

  function patchImporter() {
    const applyBox = document.getElementById('v19WhatsappApply');
    if (applyBox) {
      const description = applyBox.querySelector('span');
      if (description) description.textContent = 'A etapa selecionada no Dia de Jogo será usada quando o texto não trouxer BR e etapa. O anfitrião configurado permanece no topo; qualquer outro nome marcado como “isento” continua participante comum.';
      const targetStage = sessionStorage.getItem('plpV52TargetStageId');
      if (targetStage && !document.getElementById('v52ImporterTarget')) {
        const note = document.createElement('div');
        note.id = 'v52ImporterTarget';
        note.className = 'v52-note';
        note.textContent = 'Destino atual: etapa selecionada no Dia de Jogo. Cole a lista completa ou apenas os novos nomes.';
        applyBox.insertAdjacentElement('beforebegin', note);
      }
    }
    const select = document.getElementById('v19AdminPayment');
    if (select && !select.querySelector('option[value="exempt"]')) {
      const option = document.createElement('option');
      option.value = 'exempt';
      option.textContent = 'Isento (não anfitrião)';
      select.appendChild(option);
    }
    const hostLabel = document.querySelector('label.v19-check');
    if (hostLabel && !hostLabel.dataset.v52Label) {
      hostLabel.dataset.v52Label = '1';
      hostLabel.append(' — anfitrião ficará no topo; não use esta opção para outro jogador isento.');
    }
  }

  async function maybePromptTop4(data) {
    const {stage, entries, plan} = data;
    if (!stage.game_started || stage.status === 'finalized') return;
    const active = entries.filter(entry => !entry.eliminated_at && !entry.elimination_order);
    V52.lastActiveCount = active.length;
    if (active.length > 4 || active.length < 2 || plan.length >= 4) return;
    if (Date.now() < V52.top4DismissedUntil || document.getElementById('v52Top4Modal')) return;
    showTop4Modal(data, active.length < 4);
  }

  function showTop4Modal(data, urgent=false) {
    const {stage, entries} = data;
    const field = entries.length;
    const defaults = TOP4_PRIZES[field] || [0,0,0,0];
    const overlay = document.createElement('div');
    overlay.id = 'v52Top4Modal';
    overlay.className = 'v52-modal';
    overlay.innerHTML = `<div class="v52-modal-card">
      <div class="v52-modal-head"><div><h3>${urgent?'Confirmação pendente':'Restam 4 jogadores'}</h3><p>Confirme agora quanto cada posição receberá e se a pontuação está correta. Esses valores serão usados automaticamente ao finalizar a etapa.</p></div><button class="v52-close" type="button" id="v52Top4Later">✕</button></div>
      <div class="v52-note">Field original: <strong>${field} jogadores</strong>. A classificação ainda será definida pelas eliminações; aqui você confirma apenas os valores de cada posição.</div>
      <div class="v52-plan-table">${[1,2,3,4].map(position => `<div class="v52-plan-row"><strong>${position}º</strong><div class="v52-field"><label>Pontos</label><input class="v52-input v52-plan-points" data-position="${position}" type="number" min="1" value="${pointFor(position,field)}"></div><div class="v52-field"><label>Premiação</label><input class="v52-input v52-plan-prize" data-position="${position}" type="number" min="0" step="0.01" value="${Number(defaults[position-1]||0)}"></div></div>`).join('')}</div>
      <label class="v52-check"><input type="checkbox" id="v52PlanConfirmed"> Conferi os valores de premiação e confirmei que a pontuação das quatro primeiras posições está correta.</label>
      <div class="v52-actions"><button class="v52-btn v52-ghost" type="button" id="v52Top4Later2">Lembrar depois</button><button class="v52-btn v52-primary" type="button" id="v52SaveTop4">Confirmar Top 4</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const later = () => { V52.top4DismissedUntil = Date.now() + 120000; overlay.remove(); };
    overlay.querySelector('#v52Top4Later').onclick = later;
    overlay.querySelector('#v52Top4Later2').onclick = later;
    overlay.querySelector('#v52SaveTop4').onclick = () => saveTop4Plan(data, overlay);
  }

  async function saveTop4Plan(data, overlay) {
    if (V52.busy || !adminReady()) return;
    if (!overlay.querySelector('#v52PlanConfirmed')?.checked) return toast('Marque a confirmação dos valores e da pontuação.');
    const points = [...overlay.querySelectorAll('.v52-plan-points')];
    const prizes = [...overlay.querySelectorAll('.v52-plan-prize')];
    const plan = points.map((input,index) => ({
      position:Number(input.dataset.position),
      points:Math.max(1,Number(input.value)||1),
      prize:Math.max(0,Number(prizes[index]?.value)||0)
    }));
    V52.busy = true;
    const button = overlay.querySelector('#v52SaveTop4');
    if (button) { button.disabled=true; button.textContent='Salvando…'; }
    try {
      const {error} = await supa.rpc('plp_admin_save_finish_plan', {p_stage_id:data.stage.id,p_plan:plan});
      if (error) throw error;
      overlay.remove();
      toast('Premiação e pontuação do Top 4 confirmadas.');
      await refreshSnapshots(data.stage.id);
      setTimeout(()=>refreshFlow(true),150);
    } catch (error) {
      console.error('[PLP V52] plan', error);
      toast('Não foi possível salvar a confirmação do Top 4.');
      if (button) { button.disabled=false; button.textContent='Confirmar Top 4'; }
    } finally { V52.busy = false; }
  }

  function loadScript(src, test) {
    if (test()) return Promise.resolve(true);
    if (V52.scripts.has(src)) return V52.scripts.get(src);
    const promise = new Promise(resolve => {
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing) {
        existing.addEventListener('load',()=>resolve(test()),{once:true});
        setTimeout(()=>resolve(test()),5000);
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(test());
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    V52.scripts.set(src,promise);
    return promise;
  }

  async function pdfReady() {
    const jsPdfOk = await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
    if (!jsPdfOk) return false;
    return loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>typeof window.jspdf?.jsPDF?.API?.autoTable === 'function');
  }

  function currentChampionship() {
    return window.PLP_V19?.snapshot?.stage?.championship
      || window.PLP_V18?.stageRows?.filter(stage => stage.status !== 'cancelled').slice(-1)[0]?.championship
      || 'br4';
  }

  async function generateRankingPdf() {
    if (!backendReady()) return toast('Banco ainda não está disponível.');
    if (!(await pdfReady())) return toast('Não foi possível carregar o gerador de PDF.');
    const scope = currentChampionship();
    const [rankQ,playersQ] = await Promise.all([
      supa.from('rankings').select('*').eq('season',2026).in('scope',['geral',scope]).order('points',{ascending:false}),
      supa.from('players').select('player_key,name')
    ]);
    if (rankQ.error || playersQ.error) return toast('Não foi possível carregar os rankings.');
    const names = new Map((playersQ.data||[]).map(player=>[player.player_key,normalizeName(player.name)]));
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const addRanking = (title, rows, firstPage=false) => {
      if (!firstPage) doc.addPage();
      doc.setFontSize(17);doc.text('1ª Liga de Poker - Temporada 2026',14,16);
      doc.setFontSize(12);doc.text(title,14,24);
      doc.setFontSize(8);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`,14,30);
      doc.autoTable({startY:35,head:[['Pos.','Jogador','Pontos','Descarte','Situação']],body:rows.map((row,index)=>[
        `${index+1}º`,names.get(row.player_key)||row.player_key,String(row.points),String(row.discard||0),row.qualification_status||''
      ]),styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[35,31,15]},alternateRowStyles:{fillColor:[245,245,245]},margin:{left:14,right:14}});
    };
    const general = (rankQ.data||[]).filter(row=>row.scope==='geral').sort((a,b)=>b.points-a.points || String(names.get(a.player_key)).localeCompare(String(names.get(b.player_key))));
    const current = (rankQ.data||[]).filter(row=>row.scope===scope).sort((a,b)=>b.points-a.points || String(names.get(a.player_key)).localeCompare(String(names.get(b.player_key))));
    addRanking(`Ranking Geral`,general,true);
    addRanking(`Ranking ${scope.toUpperCase()}`,current,false);
    doc.save(`PLP_Ranking_Geral_e_${scope.toUpperCase()}_2026.pdf`);
    toast('PDF dos rankings gerado.');
  }

  async function generateFinancePdf() {
    if (!backendReady()) return toast('Banco ainda não está disponível.');
    if (!(await pdfReady())) return toast('Não foi possível carregar o gerador de PDF.');
    const query = await supa.from('stages').select('*').eq('season',2026).neq('status','cancelled').order('stage_date');
    if (query.error) return toast('Não foi possível carregar o financeiro.');
    const stages = query.data || [];
    const finalized = stages.filter(stage=>stage.status==='finalized');
    const totals = finalized.reduce((acc,stage)=>({
      collected:acc.collected+(Number(stage.collected_amount)||0),
      jackpot:acc.jackpot+(Number(stage.jackpot_amount)||0),
      prizes:acc.prizes+(Number(stage.prize_pool)||0)
    }),{collected:0,jackpot:0,prizes:0});
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    doc.setFontSize(17);doc.text('1ª Liga de Poker - Financeiro 2026',14,16);
    doc.setFontSize(10);doc.text(`Arrecadação finalizada: ${money(totals.collected)}   |   Jackpot: ${money(totals.jackpot)}   |   Premiação: ${money(totals.prizes)}`,14,25);
    doc.setFontSize(8);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`,14,31);
    doc.autoTable({startY:37,head:[['BR','Etapa','Data','Status','Anfitrião','Local','Arrecadação','Jackpot','Premiação']],body:stages.map(stage=>[
      stage.championship.toUpperCase(),stage.stage_number,formatDate(stage.stage_date),stage.status,stage.host_name||'',stage.location||'',money(stage.collected_amount),money(stage.jackpot_amount),money(stage.prize_pool)
    ]),styles:{fontSize:7,cellPadding:1.8},headStyles:{fillColor:[35,31,15]},alternateRowStyles:{fillColor:[245,245,245]},margin:{left:10,right:10}});
    doc.save('PLP_Financeiro_Atualizado_2026.pdf');
    toast('PDF financeiro gerado.');
  }

  function patchVersion() {
    document.querySelectorAll('.muted.small').forEach(el=>{
      if(/Versão\s+\d+.*Temporada\s+2026/i.test(el.textContent||'')) el.textContent='Versão 52 • Temporada 2026';
    });
  }

  function injectReportButtons() {
    const tools = document.querySelector('#leagueTools .v18-tools-grid');
    if (tools && !document.getElementById('v52ReportsTool')) {
      const card = document.createElement('div');
      card.id='v52ReportsTool';card.className='v18-card v18-tool v52-report-card';
      card.innerHTML='<h3>Relatórios em PDF</h3><p>Gere o ranking geral com o BR atual e o financeiro atualizado diretamente do banco.</p><div class="v18-actions"><button class="btn gold" id="v52PdfRanking">Ranking Geral + BR atual</button><button class="btn ghost" id="v52PdfFinance">Financeiro atualizado</button></div>';
      tools.appendChild(card);
      card.querySelector('#v52PdfRanking').onclick=generateRankingPdf;
      card.querySelector('#v52PdfFinance').onclick=generateFinancePdf;
    }
    const finance = document.getElementById('finance');
    if (finance && !document.getElementById('v52FinanceReports')) {
      const card=document.createElement('div');card.id='v52FinanceReports';card.className='card v52-report-card';
      card.innerHTML='<h3>Exportar relatórios</h3><p>Dados atualizados do banco, incluindo todas as etapas finalizadas.</p><div class="v52-actions"><button class="v52-btn v52-ghost" id="v52FinanceRankingPdf">PDF dos rankings</button><button class="v52-btn v52-primary" id="v52FinancePdf">PDF financeiro</button></div>';
      const notice=finance.querySelector('.notice');
      if(notice) notice.insertAdjacentElement('beforebegin',card); else finance.appendChild(card);
      card.querySelector('#v52FinanceRankingPdf').onclick=generateRankingPdf;
      card.querySelector('#v52FinancePdf').onclick=generateFinancePdf;
    }
  }

  function injectClockBackButton() {
    const screen=document.getElementById('clockScreen');
    if(!screen || document.getElementById('v52BackGameDay')) return;
    const button=document.createElement('button');button.id='v52BackGameDay';button.className='btn gold';button.type='button';button.style.cssText='width:100%;margin:10px 0 12px';button.textContent='Voltar ao Dia de Jogo / Eliminações';
    const top=screen.querySelector('.screen-top');if(top)top.insertAdjacentElement('afterend',button);else screen.prepend(button);
    button.onclick=()=>{try{goTo('gameDay')}catch(_){}};
  }

  async function refreshFlow(force=false) {
    if (!adminReady() || !document.getElementById('gameDay')?.classList.contains('active')) return;
    const id=selectedStageId();
    if(!id)return;
    const data=await fetchStageData(id);
    if(!data)return;
    renderFlow(data,{force,openSetup:V52.editingSetup});
    patchImporter();
    await maybePromptTop4(data);
  }

  function installEvents() {
    document.addEventListener('click',event=>{
      const applySelected=event.target.closest('#v19ApplySelectedSignup');
      const applyAll=event.target.closest('#v19ApplyAllSignup');
      if(applySelected||applyAll){
        event.preventDefault();event.stopImmediatePropagation();
        applyWhatsappSafe(Boolean(applyAll));
        return;
      }
      if(event.target.closest('#parseSignup')) setTimeout(normalizeParsedExemptions,80);
      const nav=event.target.closest('[data-go]')?.dataset.go;
      if(nav==='gameDay') setTimeout(()=>refreshFlow(true),260);
      if(nav==='leagueTools'||nav==='finance') setTimeout(injectReportButtons,120);
      if(nav==='clockScreen') setTimeout(injectClockBackButton,80);
      if(nav==='stageLiveV19') setTimeout(patchPublicFinancialFromSnapshot,160);
      const hostButton=event.target.closest('.v19-host-btn');
      if(hostButton) setTimeout(()=>refreshFlow(true),500);
    },true);

    const stageSelect=document.getElementById('gdStageSelect');
    if(stageSelect)stageSelect.addEventListener('change',()=>{V52.editingSetup=false;setTimeout(()=>refreshFlow(true),180)});
  }

  function observeUi() {
    if(V52.observer)return;
    let timer=null;
    V52.observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        patchImporter();injectReportButtons();injectClockBackButton();patchVersion();patchPublicFinancialFromSnapshot();
        if(document.getElementById('gameDay')?.classList.contains('active')) refreshFlow(false).catch(()=>{});
      },90);
    });
    V52.observer.observe(document.body,{childList:true,subtree:true});
  }

  async function init() {
    injectStyles();
    injectReportButtons();
    injectClockBackButton();
    installEvents();
    observeUi();
    for(let i=0;i<120;i++){
      if(backendReady() && window.PLP_V18 && window.PLP_V19 && window.PLP_V25 && window.PLP_V28)break;
      await sleep(100);
    }
    if(!backendReady()){V52.ready=true;return;}
    try{
      if(typeof refreshAdminRole==='function')await refreshAdminRole();
      patchImporter();
      if(document.getElementById('gameDay')?.classList.contains('active'))await refreshFlow(true);
      V52.timer=setInterval(()=>{
        if(document.visibilityState!=='visible')return;
        patchPublicFinancialFromSnapshot();
        if(document.getElementById('gameDay')?.classList.contains('active'))refreshFlow(false).catch(()=>{});
      },2500);
      V52.channel=supa.channel('plp-v52-flow')
        .on('postgres_changes',{event:'*',schema:'public',table:'stage_entries'},()=>setTimeout(()=>refreshFlow(true),120))
        .on('postgres_changes',{event:'*',schema:'public',table:'stages'},()=>setTimeout(()=>refreshFlow(true),120))
        .on('postgres_changes',{event:'*',schema:'public',table:'stage_finish_plans'},()=>setTimeout(()=>refreshFlow(true),120))
        .subscribe();
      V52.ready=true;
      patchVersion();
    }catch(error){console.error('[PLP V52] init',error);V52.ready=true;}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
