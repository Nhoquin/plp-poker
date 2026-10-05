/* PLP V58 • gerenciamento manual de jogadores durante a partida */
(() => {
  'use strict';

  const BUILD = '58';
  const state = { timer:null, channel:null, busy:false, lastSignature:'' };
  window.PLP_V58 = state;

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
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  const backendReady = () => {
    try { return typeof supa !== 'undefined' && !!supa; } catch (_) { return false; }
  };
  const adminReady = () => {
    try { return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; } catch (_) { return false; }
  };
  const toast = message => {
    try { if (typeof showToast === 'function') return showToast(message); } catch (_) {}
    console.log('[PLP V58]', message);
  };
  const selectedStageId = () =>
    document.getElementById('gdStageSelect')?.value
    || window.PLP_V18?.selectedStageId
    || sessionStorage.getItem('plpV52TargetStageId')
    || window.PLP_V19?.snapshot?.stage?.id
    || null;

  async function fetchData() {
    const stageId = selectedStageId();
    if (!stageId || !backendReady()) return null;
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
    return { stage:stageQ.data, entries, players };
  }

  function paymentLabel(status) {
    return ({
      pending:'Pendente',
      informed:'Pagamento informado',
      confirmed:'Pago confirmado',
      exempt:'Isento'
    })[status] || status;
  }

  function cleanError(error, fallback) {
    const message = String(error?.message || '').replace(/^.*?P0001:?\s*/i, '').trim();
    if (/Acesso administrativo/i.test(message)) return 'Acesso administrativo necessário.';
    if (/anfitrião/i.test(message)) return 'O anfitrião não pode ser excluído durante a partida.';
    if (/eliminação registrada/i.test(message)) return 'Esse jogador já foi eliminado e não pode ser excluído por aqui.';
    if (/resultado registrado/i.test(message)) return 'Esse jogador já possui resultado registrado.';
    if (/já está inscrito/i.test(message)) return 'Esse jogador já está na etapa.';
    if (/Etapa encerrada/i.test(message)) return 'A etapa já foi encerrada.';
    return message && message.length < 180 ? message : fallback;
  }

  function panelHtml(data) {
    const playerOptions = data.players
      .filter(player => player.active !== false)
      .map(player => '<option value="' + esc(normalizeName(player.name)) + '"></option>')
      .join('');

    const removable = data.entries.filter(entry =>
      !entry.is_host &&
      !entry.eliminated_at &&
      !entry.elimination_order &&
      !entry.finish_position
    );

    const removeOptions = removable.length
      ? '<option value="">Selecione o jogador</option>' + removable
          .map(entry => '<option value="' + esc(entry.player_key) + '">' + esc(entry.name) + '</option>')
          .join('')
      : '<option value="">Nenhum jogador disponível para exclusão</option>';

    return '<div class="v58-roster" id="v58RosterPanel">' +
      '<div class="v58-head"><div><h3>Jogadores da partida</h3><p>Adicione ou exclua manualmente um jogador durante o jogo, sem usar a interpretação da lista.</p></div><span>ADMIN</span></div>' +
      '<div class="v58-block">' +
        '<div class="v58-title">Adicionar jogador</div>' +
        '<div class="v58-grid">' +
          '<div class="v58-field"><label for="v58AddName">Nome</label><input id="v58AddName" class="v58-input" list="v58PlayerNames" maxlength="60" placeholder="Nome do jogador"><datalist id="v58PlayerNames">' + playerOptions + '</datalist></div>' +
          '<div class="v58-field"><label for="v58AddPayment">Pagamento</label><select id="v58AddPayment" class="v58-input"><option value="pending">Pendente</option><option value="informed">Informado</option><option value="confirmed">Pago confirmado</option><option value="exempt">Isento</option></select></div>' +
        '</div>' +
        '<button type="button" class="v58-btn v58-add" id="v58AddPlayer">Adicionar jogador à partida</button>' +
      '</div>' +
      '<div class="v58-divider"></div>' +
      '<div class="v58-block">' +
        '<div class="v58-title">Excluir jogador</div>' +
        '<div class="v58-field"><label for="v58RemovePlayerSelect">Jogador ativo</label><select id="v58RemovePlayerSelect" class="v58-input">' + removeOptions + '</select></div>' +
        '<button type="button" class="v58-btn v58-remove" id="v58RemovePlayer" ' + (removable.length ? '' : 'disabled') + '>Excluir jogador da partida</button>' +
        '<div class="v58-note">O anfitrião e jogadores que já possuem eliminação registrada não aparecem para exclusão. A exclusão é auditada e ajusta a quantidade de jogadores da etapa.</div>' +
      '</div>' +
    '</div>';
  }

  async function addPlayer(data, button) {
    if (state.busy || !adminReady()) return;
    if (!data.stage.game_started || data.stage.status !== 'open') return toast('Essa opção só fica disponível com o jogo em andamento.');

    const input = document.getElementById('v58AddName');
    const name = normalizeName(input?.value);
    const payment = document.getElementById('v58AddPayment')?.value || 'pending';
    if (name.length < 2) return toast('Informe o nome do jogador.');
    if (data.entries.some(entry => comparable(entry.name) === comparable(name))) return toast(name + ' já está na lista desta etapa.');

    const existing = data.players.find(player => comparable(player.name) === comparable(name));
    const playerKey = existing?.player_key || keyForName(name);
    const playerName = existing?.name ? normalizeName(existing.name) : name;

    if (!window.confirm('Adicionar ' + playerName + ' à partida?\n\nPagamento: ' + paymentLabel(payment) + '.')) return;

    state.busy = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Adicionando…';
    try {
      const { data:result, error } = await supa.rpc('plp_admin_add_late_participant', {
        p_stage_id:data.stage.id,
        p_player_key:playerKey,
        p_player_name:playerName,
        p_payment_status:payment
      });
      if (error) throw error;
      if (input) input.value = '';
      toast((result?.name || playerName) + ' foi adicionado à partida.');
      state.lastSignature = '';
      await refresh(true);
    } catch (error) {
      console.error('[PLP V58] add player', error);
      toast(cleanError(error, 'Não foi possível adicionar o jogador.'));
    } finally {
      state.busy = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  async function removePlayer(data, button) {
    if (state.busy || !adminReady()) return;
    if (!data.stage.game_started || data.stage.status !== 'open') return toast('Essa opção só fica disponível com o jogo em andamento.');

    const select = document.getElementById('v58RemovePlayerSelect');
    const playerKey = clean(select?.value).toLowerCase();
    if (!playerKey) return toast('Selecione o jogador que deseja excluir.');

    const entry = data.entries.find(item => item.player_key === playerKey);
    const playerName = entry?.name || playerKey;
    if (!window.confirm('Excluir ' + playerName + ' desta partida?\n\nUse esta opção para corrigir jogador incluído por engano. Esta ação não elimina o jogador; ela remove a inscrição da etapa.')) return;

    state.busy = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Excluindo…';
    try {
      const { data:result, error } = await supa.rpc('plp_admin_remove_live_participant', {
        p_stage_id:data.stage.id,
        p_player_key:playerKey
      });
      if (error) throw error;
      toast((result?.name || playerName) + ' foi excluído da partida.');
      state.lastSignature = '';
      await refresh(true);
    } catch (error) {
      console.error('[PLP V58] remove player', error);
      toast(cleanError(error, 'Não foi possível excluir o jogador.'));
    } finally {
      state.busy = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function ensureStyles() {
    if (document.getElementById('plpV58RosterStyles')) return;
    const style = document.createElement('style');
    style.id = 'plpV58RosterStyles';
    style.textContent =
      '#v54LateEntry{display:none!important}' +
      '.v58-roster{margin:10px 0 12px;padding:13px;border-radius:19px;border:1px solid rgba(136,188,255,.22);background:linear-gradient(145deg,rgba(16,24,34,.94),rgba(6,9,12,.98));box-shadow:0 14px 32px rgba(0,0,0,.24)}' +
      '.v58-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.v58-head h3{margin:0;color:#cfe4ff;font-size:15px}.v58-head p{margin:4px 0 0;color:#bdc6d0;font-size:9px;line-height:1.45}.v58-head>span{white-space:nowrap;padding:6px 8px;border-radius:999px;border:1px solid rgba(136,188,255,.28);background:rgba(136,188,255,.08);color:#b9d8ff;font-size:7px;font-weight:950}' +
      '.v58-block{margin-top:11px}.v58-title{margin-bottom:7px;color:#fff;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.35px}.v58-grid{display:grid;grid-template-columns:1fr 180px;gap:8px}.v58-field{display:grid;gap:5px}.v58-field label{font-size:8px;color:#d5e4f6;font-weight:850;text-transform:uppercase;letter-spacing:.4px}.v58-input{width:100%;min-height:41px;border:1px solid rgba(136,188,255,.22);border-radius:11px;background:#0b0d10;color:#fff;padding:9px 10px;outline:none}.v58-input:focus{border-color:#88bcff;box-shadow:0 0 0 2px rgba(136,188,255,.08)}' +
      '.v58-btn{width:100%;min-height:42px;margin-top:9px;border-radius:12px;font-size:10px;font-weight:950}.v58-add{border:1px solid rgba(123,230,179,.45);background:rgba(123,230,179,.12);color:#a6f2cf}.v58-remove{border:1px solid rgba(255,118,118,.45);background:rgba(255,118,118,.10);color:#ffb3b3}.v58-btn:disabled{opacity:.4}.v58-divider{height:1px;margin:12px 0;background:rgba(255,255,255,.08)}.v58-note{margin-top:7px;color:#aeb9c7;font-size:8px;line-height:1.45}' +
      '@media(max-width:520px){.v58-head{display:grid}.v58-head>span{justify-self:start}.v58-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function render(data) {
    const gameDay = document.getElementById('gameDay');
    const old = document.getElementById('v58RosterPanel');
    if (!gameDay?.classList.contains('active') || !adminReady() || !data?.stage?.game_started || data.stage.status !== 'open') {
      old?.remove();
      return;
    }

    const signature = [
      data.stage.id,
      data.stage.updated_at,
      data.entries.map(entry => [
        entry.player_key,
        entry.payment_status,
        entry.is_host,
        entry.elimination_order || '',
        entry.finish_position || ''
      ].join(':')).join('|')
    ].join('||');

    if (old && signature === state.lastSignature) return;
    if (old && old.contains(document.activeElement)) return;
    state.lastSignature = signature;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelHtml(data);
    const panel = wrapper.firstElementChild;
    panel.dataset.signature = signature;

    if (old) old.replaceWith(panel);
    else {
      const anchor = document.getElementById('v55LiveOps');
      if (anchor) anchor.insertAdjacentElement('afterend', panel);
      else {
        const flow = document.getElementById('v52GameFlow');
        if (flow) flow.insertAdjacentElement('afterend', panel);
        else document.getElementById('gdContent')?.prepend(panel);
      }
    }

    panel.querySelector('#v58AddPlayer')?.addEventListener('click', event => addPlayer(data, event.currentTarget));
    panel.querySelector('#v58RemovePlayer')?.addEventListener('click', event => removePlayer(data, event.currentTarget));
  }

  async function refresh(force=false) {
    if (!backendReady() || !adminReady()) return;
    if (!document.getElementById('gameDay')?.classList.contains('active')) return;
    if (state.busy && !force) return;
    const data = await fetchData();
    if (data) render(data);
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-go="gameDay"]')) {
        window.setTimeout(() => refresh(true).catch(()=>{}), 220);
      }
    }, true);

    state.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh(false).catch(()=>{});
    }, 2200);

    const wait = window.setInterval(() => {
      if (!backendReady()) return;
      window.clearInterval(wait);
      state.channel = supa.channel('plp-v58-live-roster')
        .on('postgres_changes',{event:'*',schema:'public',table:'stages'},()=>window.setTimeout(()=>refresh(true).catch(()=>{}),80))
        .on('postgres_changes',{event:'*',schema:'public',table:'stage_entries'},()=>window.setTimeout(()=>refresh(true).catch(()=>{}),80))
        .subscribe();
      refresh(true).catch(()=>{});
    }, 120);

    console.info('PLP Poker V58 • gerenciamento manual de jogadores durante a partida');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
