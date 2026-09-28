/* PLP V54 • lista finalizada com Blind Clock pendente e entrada tardia */
(() => {
  'use strict';

  const BUILD = '54';
  const state = {
    busy:false,
    patchTimer:null,
    observer:null,
    channel:null,
    lastSignature:'',
    latestData:null
  };
  window.PLP_V54 = state;

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const comparable = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const normalizeName = value => {
    const raw = clean(value);
    try { return typeof normalizePlayerName === 'function' ? normalizePlayerName(raw) : raw; }
    catch (_) { return raw; }
  };
  const keyForName = value => {
    const name = normalizeName(value);
    if (comparable(name) === 'daniel all capone') return 'daniel';
    return name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'jogador';
  };
  const esc = value => String(value ?? '').replace(/[&<>\"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;'
  })[char]);

  function toast(message) {
    try { if (typeof showToast === 'function') return showToast(message); } catch (_) {}
    console.log('[PLP V54]', message);
  }

  function backendReady() {
    try { return typeof supa !== 'undefined' && !!supa; } catch (_) { return false; }
  }

  function adminReady() {
    try { return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; } catch (_) { return false; }
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
    const [stageQ, entriesQ, playersQ] = await Promise.all([
      supa.from('stages').select('*').eq('id', stageId).maybeSingle(),
      supa.from('stage_entries').select('*').eq('stage_id', stageId).order('list_position'),
      supa.from('players').select('player_key,name,active').order('name')
    ]);
    if (stageQ.error || !stageQ.data || entriesQ.error || playersQ.error) return null;
    const players = playersQ.data || [];
    const names = new Map(players.map(player => [player.player_key, normalizeName(player.name)]));
    const entries = (entriesQ.data || []).map(entry => ({
      ...entry,
      name:names.get(entry.player_key) || entry.player_key
    }));
    return {stage:stageQ.data, entries, players};
  }

  async function refreshSnapshots(stageId) {
    try {
      const {data} = await supa.rpc('plp_public_stage_snapshot');
      if (data && window.PLP_V19) {
        window.PLP_V19.snapshot = typeof normalizeStageSnapshot === 'function'
          ? normalizeStageSnapshot(data)
          : data;
      }
    } catch (_) {}
    if (window.PLP_V18) window.PLP_V18.selectedStageId = stageId;
    sessionStorage.setItem('plpV52TargetStageId', stageId);
    state.lastSignature = '';
    schedulePatch(80);
  }

  function setBusy(button, busyText) {
    if (!button) return () => {};
    const originalText = button.textContent;
    const originalDisabled = button.disabled;
    button.disabled = true;
    button.textContent = busyText;
    return () => {
      if (!button.isConnected) return;
      button.disabled = originalDisabled;
      button.textContent = originalText;
    };
  }

  async function closeList(data, button) {
    if (state.busy || !adminReady()) return;
    const {stage, entries} = data;
    if (stage.game_started) return toast('O jogo já foi iniciado.');
    if (stage.registration_closed) return toast('A lista já está finalizada e o Blind Clock está pendente.');
    if (entries.length < 2) return toast('Inclua pelo menos dois jogadores antes de finalizar a lista.');
    if (!entries.some(entry => entry.is_host)) return toast('Defina o anfitrião antes de finalizar a lista.');

    const pending = entries.filter(entry => ['pending','informed'].includes(entry.payment_status)).length;
    const message = `Finalizar a lista com ${entries.length} jogadores?\n\nO Blind Clock NÃO será iniciado agora. Ele ficará pendente para você iniciar depois das 19h.${pending ? `\n\nHá ${pending} pagamento(s) pendente(s) ou apenas informado(s).` : ''}`;
    if (!window.confirm(message)) return;

    state.busy = true;
    const restore = setBusy(button, 'Finalizando lista…');
    try {
      const {data:result,error} = await supa.rpc('plp_admin_close_stage_list', {p_stage_id:stage.id});
      if (error) throw error;
      toast(`Lista finalizada com ${result?.field || entries.length} jogadores. Blind Clock pendente.`);
      await refreshSnapshots(stage.id);
    } catch (error) {
      console.error('[PLP V54] close list', error);
      toast(cleanError(error, 'Não foi possível finalizar a lista.'));
      restore();
    } finally {
      state.busy = false;
    }
  }

  async function startClock(data, button) {
    if (state.busy || !adminReady()) return;
    const {stage, entries} = data;
    if (stage.game_started) return toast('O jogo já está em andamento.');
    if (!stage.registration_closed) return toast('Finalize a lista antes de iniciar o Blind Clock.');
    if (entries.length < 2) return toast('Inclua pelo menos dois jogadores antes de iniciar.');

    const message = `Iniciar agora o Blind Clock da ${String(stage.championship).toUpperCase()} • Etapa ${stage.stage_number}?\n\nO relógio começará no Nível 1 com 20:00 minutos.`;
    if (!window.confirm(message)) return;

    state.busy = true;
    const restore = setBusy(button, 'Iniciando Blind Clock…');
    try {
      const {data:result,error} = await supa.rpc('plp_admin_start_stage_clock', {p_stage_id:stage.id});
      if (error) throw error;
      toast(`Jogo iniciado com ${result?.field || entries.length} jogadores. Blind Clock em andamento.`);
      await refreshSnapshots(stage.id);
      window.setTimeout(() => {
        const panel = document.getElementById('v25EliminationAdmin');
        if (panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
      }, 500);
    } catch (error) {
      console.error('[PLP V54] start clock', error);
      toast(cleanError(error, 'Não foi possível iniciar o Blind Clock.'));
      restore();
    } finally {
      state.busy = false;
    }
  }

  function lateEntryPanelHtml(data) {
    const options = data.players
      .filter(player => player.active !== false)
      .map(player => `<option value="${esc(normalizeName(player.name))}"></option>`)
      .join('');
    const eliminated = data.entries.filter(entry => entry.elimination_order || entry.eliminated_at).length;
    return `<div class="v54-late-entry" id="v54LateEntry">
      <div class="v54-late-head"><div><h4>Participante atrasado</h4><p>Adicione alguém mesmo depois do início da partida. O participante entra como jogador ativo e nunca como anfitrião.</p></div><span>JOGO EM ANDAMENTO</span></div>
      <div class="v54-late-grid">
        <div class="v54-field"><label for="v54LateName">Nome</label><input id="v54LateName" class="v54-input" list="v54LatePlayers" maxlength="60" placeholder="Nome do participante"><datalist id="v54LatePlayers">${options}</datalist></div>
        <div class="v54-field"><label for="v54LatePayment">Pagamento</label><select id="v54LatePayment" class="v54-input"><option value="pending">Pendente</option><option value="informed">Pagamento informado</option><option value="confirmed">Pago confirmado</option><option value="exempt">Isento (não anfitrião)</option></select></div>
      </div>
      <button type="button" class="v54-late-add" id="v54AddLatePlayer">Adicionar participante à partida</button>
      <div class="v54-late-note">${eliminated ? `Já existem ${eliminated} eliminação(ões). Ao adicionar, as posições já registradas serão deslocadas automaticamente para preservar a ordem correta da classificação.` : 'A inclusão será registrada na lista e no painel de eliminações sem reiniciar o Blind Clock.'}</div>
    </div>`;
  }

  async function addLatePlayer(data, button) {
    if (state.busy || !adminReady()) return;
    const {stage, entries, players} = data;
    if (!stage.game_started || stage.status !== 'open') return toast('A entrada tardia só está disponível enquanto o jogo estiver em andamento.');
    const input = document.getElementById('v54LateName');
    const name = normalizeName(input?.value);
    const payment = document.getElementById('v54LatePayment')?.value || 'pending';
    if (name.length < 2) return toast('Informe o nome do participante.');
    if (entries.some(entry => comparable(entry.name) === comparable(name))) return toast(`${name} já está na lista desta etapa.`);

    const existing = players.find(player => comparable(player.name) === comparable(name));
    const playerKey = existing?.player_key || keyForName(name);
    const playerName = existing?.name ? normalizeName(existing.name) : name;

    const message = `Adicionar ${playerName} com o jogo em andamento?\n\nPagamento: ${paymentLabel(payment)}.\nO participante entrará ativo na classificação.`;
    if (!window.confirm(message)) return;

    state.busy = true;
    const restore = setBusy(button, 'Adicionando…');
    try {
      const {data:result,error} = await supa.rpc('plp_admin_add_late_participant', {
        p_stage_id:stage.id,
        p_player_key:playerKey,
        p_player_name:playerName,
        p_payment_status:payment
      });
      if (error) throw error;
      if (input) input.value = '';
      const shifted = Number(result?.shifted_positions) || 0;
      toast(`${result?.name || playerName} adicionado à partida.${shifted ? ` ${shifted} posição(ões) anteriores foram ajustadas.` : ''}`);
      await refreshSnapshots(stage.id);
    } catch (error) {
      console.error('[PLP V54] late entry', error);
      toast(cleanError(error, 'Não foi possível adicionar o participante.'));
      restore();
    } finally {
      state.busy = false;
    }
  }

  function paymentLabel(status) {
    return ({pending:'Pendente',informed:'Pagamento informado',confirmed:'Pago confirmado',exempt:'Isento (não anfitrião)'})[status] || status;
  }

  function cleanError(error, fallback) {
    const message = String(error?.message || '')
      .replace(/^.*?P0001:?\s*/i, '')
      .trim();
    if (/Acesso administrativo/i.test(message)) return 'Acesso administrativo necessário.';
    if (/lista já está finalizada/i.test(message)) return 'A lista já está finalizada.';
    if (/Finalize a lista/i.test(message)) return 'Finalize a lista antes de iniciar o Blind Clock.';
    if (/já está inscrito/i.test(message)) return 'Esse jogador já está inscrito nesta etapa.';
    if (/Etapa encerrada/i.test(message)) return 'A etapa já foi encerrada.';
    return message && message.length < 180 ? message : fallback;
  }

  function patchStartButton(data) {
    const button = document.getElementById('v52StartGame');
    if (!button || data.stage.status === 'finalized' || data.stage.game_started) return;
    button.dataset.v54SplitStart = '1';
    if (data.stage.registration_closed) {
      button.textContent = 'Iniciar Blind Clock';
      button.disabled = data.entries.length < 2;
      button.classList.add('v54-clock-ready');
      button.title = 'A lista já está finalizada. Inicie o relógio somente quando a partida começar.';
    } else {
      button.textContent = 'Finalizar lista';
      button.disabled = data.entries.length < 2;
      button.classList.remove('v54-clock-ready');
      button.title = 'Finaliza as inscrições e deixa o Blind Clock pendente.';
    }

    let note = document.getElementById('v54StartNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'v54StartNote';
      note.className = 'v54-start-note';
      button.insertAdjacentElement('beforebegin', note);
    }
    note.innerHTML = data.stage.registration_closed
      ? '<strong>Lista finalizada.</strong> O Blind Clock continua parado e pode ser iniciado depois das 19h.'
      : '<strong>Primeiro finalize a lista.</strong> Essa ação não inicia o Blind Clock.';
  }

  function patchLateEntry(data) {
    const flow = document.getElementById('v52GameFlow');
    if (!flow) return;
    const existing = document.getElementById('v54LateEntry');
    if (!data.stage.game_started || data.stage.status !== 'open') {
      existing?.remove();
      return;
    }
    const signature = [data.stage.id,data.stage.updated_at,data.entries.length,data.entries.filter(e=>e.elimination_order||e.eliminated_at).length].join('|');
    if (existing?.dataset.signature === signature) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = lateEntryPanelHtml(data);
    const panel = wrapper.firstElementChild;
    panel.dataset.signature = signature;
    if (existing) existing.replaceWith(panel);
    else flow.appendChild(panel);
    panel.querySelector('#v54AddLatePlayer')?.addEventListener('click', event => addLatePlayer(data, event.currentTarget));
  }

  function patchPhase(data) {
    const phase = document.querySelector('#v52GameFlow .v52-phase');
    if (!phase) return;
    if (data.stage.registration_closed && !data.stage.game_started && data.stage.status !== 'finalized') {
      phase.textContent = 'BLIND CLOCK PENDENTE';
    }
  }

  function patchVersion() {
    document.querySelectorAll('.muted.small').forEach(element => {
      if (/Versão\s+\d+.*Temporada\s+2026/i.test(element.textContent || '')) {
        element.textContent = `Versão ${BUILD} • Temporada 2026`;
      }
    });
  }

  async function patch() {
    patchVersion();
    if (!document.getElementById('gameDay')?.classList.contains('active') || !adminReady()) return;
    const stageId = selectedStageId();
    if (!stageId) return;
    const data = await fetchStageData(stageId);
    if (!data || !document.getElementById('gameDay')?.classList.contains('active')) return;
    state.latestData = data;
    const signature = [data.stage.id,data.stage.updated_at,data.stage.registration_closed,data.stage.game_started,data.entries.length,data.entries.map(e=>`${e.player_key}:${e.finish_position||''}`).join(',')].join('|');
    if (signature === state.lastSignature && document.getElementById('v54LateEntry')) {
      patchStartButton(data);
      patchPhase(data);
      return;
    }
    state.lastSignature = signature;
    patchStartButton(data);
    patchPhase(data);
    patchLateEntry(data);
  }

  function schedulePatch(delay = 80) {
    clearTimeout(state.patchTimer);
    state.patchTimer = setTimeout(() => patch().catch(error => console.warn('[PLP V54] patch', error)), delay);
  }

  function installStyles() {
    if (document.getElementById('plpV54Styles')) return;
    const style = document.createElement('style');
    style.id = 'plpV54Styles';
    style.textContent = `
      .v54-start-note{grid-column:1/-1;margin-top:4px;padding:9px 10px;border-radius:12px;border:1px solid rgba(136,188,255,.18);background:rgba(136,188,255,.055);color:#d4e6fb;font-size:9px;line-height:1.45}.v54-start-note strong{color:#fff}
      #v52StartGame.v54-clock-ready{border-color:rgba(123,230,179,.45);background:linear-gradient(145deg,#87e8bb,#45b987);color:#092116}
      .v54-late-entry{margin-top:12px;padding:12px;border-radius:17px;border:1px solid rgba(136,188,255,.22);background:linear-gradient(145deg,rgba(18,28,40,.82),rgba(7,10,14,.94))}.v54-late-head{display:flex;align-items:flex-start;gap:10px}.v54-late-head>div{flex:1}.v54-late-head h4{margin:0;color:#b9d8ff;font-size:14px}.v54-late-head p{margin:4px 0 0;color:#c5c8ce;font-size:9px;line-height:1.45}.v54-late-head>span{white-space:nowrap;padding:6px 8px;border-radius:999px;border:1px solid rgba(123,230,179,.28);background:rgba(123,230,179,.08);color:#9eeec8;font-size:7px;font-weight:950}
      .v54-late-grid{display:grid;grid-template-columns:1fr 180px;gap:8px;margin-top:10px}.v54-field{display:grid;gap:5px}.v54-field label{font-size:8px;color:#d5e4f6;font-weight:850;text-transform:uppercase;letter-spacing:.4px}.v54-input{width:100%;min-height:41px;border:1px solid rgba(136,188,255,.22);border-radius:11px;background:#0b0d10;color:#fff;padding:9px 10px;outline:none}.v54-input:focus{border-color:#88bcff;box-shadow:0 0 0 2px rgba(136,188,255,.08)}
      .v54-late-add{width:100%;min-height:42px;margin-top:9px;border:1px solid rgba(136,188,255,.42);border-radius:12px;background:rgba(136,188,255,.12);color:#cfe4ff;font-size:10px;font-weight:900}.v54-late-add:disabled{opacity:.45}.v54-late-note{margin-top:8px;color:#aeb9c7;font-size:8px;line-height:1.45}
      @media(max-width:520px){.v54-late-head{display:grid}.v54-late-head>span{justify-self:start}.v54-late-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installEventGuards() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('#v52StartGame');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      (async () => {
        const data = await fetchStageData();
        if (!data) return toast('Não foi possível carregar a etapa.');
        if (data.stage.registration_closed) await startClock(data, button);
        else await closeList(data, button);
      })().catch(error => {
        console.error('[PLP V54] split action', error);
        toast('Não foi possível executar esta etapa do fluxo.');
      });
    }, true);

    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-go="gameDay"]') || event.target.closest?.('#v52EditSetup')) schedulePatch(220);
    }, true);
  }

  function observeUi() {
    state.observer = new MutationObserver(() => schedulePatch(70));
    state.observer.observe(document.body, {childList:true,subtree:true});
  }

  async function init() {
    installStyles();
    installEventGuards();
    observeUi();
    for (let i=0;i<140;i++) {
      if (backendReady() && window.PLP_V52) break;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    patchVersion();
    schedulePatch(120);
    if (backendReady()) {
      state.channel = supa.channel('plp-v54-split-start')
        .on('postgres_changes',{event:'*',schema:'public',table:'stages'},()=>schedulePatch(100))
        .on('postgres_changes',{event:'*',schema:'public',table:'stage_entries'},()=>schedulePatch(100))
        .subscribe();
    }
    console.info('PLP Poker V54 • lista finalizada e Blind Clock pendente');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
