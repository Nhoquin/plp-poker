/* PLP V48 • páginas individuais e edição segura de jogadores */
(() => {
  'use strict';

  const BUILD = '48';
  const ROUTE_PREFIX = '#jogador/';
  let activePlayerKey = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char]);

  const cleanName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const comparableName = value => cleanName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const fallbackPlayerKey = value => comparableName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'jogador';
  const initialsFor = value => (cleanName(value).match(/\b[\p{L}\p{N}]/gu) || [])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const money = value => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);

  function runtime() {
    return window.PLP_V18 || null;
  }

  function playerRows() {
    const rows = runtime()?.playerRows || [];
    if (rows.length) return rows;
    return (typeof rankSets === 'undefined' ? [] : rankSets.geral).map(player => ({
      player_key: fallbackPlayerKey(player.name),
      name: player.name,
      active: true
    }));
  }

  function getPlayer(playerKey) {
    return playerRows().find(player => player.player_key === playerKey) || null;
  }

  function generalRanking() {
    const rows = (runtime()?.rankingRows || [])
      .filter(row => row.scope === 'geral')
      .sort((a, b) => Number(b.points) - Number(a.points));
    if (rows.length) return rows;
    return (typeof rankSets === 'undefined' ? [] : rankSets.geral).map(player => ({
      player_key: fallbackPlayerKey(player.name),
      points: player.pts,
      discard: player.discard || 0
    }));
  }

  function renderPlayersV48() {
    const host = document.getElementById('playerGrid');
    if (!host) return;

    const ranking = generalRanking();
    const rankingByKey = new Map(ranking.map((row, index) => [row.player_key, {
      position: index + 1,
      points: Number(row.points) || 0
    }]));
    const players = playerRows()
      .filter(player => player.active !== false)
      .map(player => ({ ...player, ranking: rankingByKey.get(player.player_key) || null }))
      .sort((a, b) => {
        if (a.ranking && b.ranking) return a.ranking.position - b.ranking.position;
        if (a.ranking) return -1;
        if (b.ranking) return 1;
        return cleanName(a.name).localeCompare(cleanName(b.name), 'pt-BR');
      });

    const count = document.getElementById('playerCountLabel');
    if (count) count.textContent = `${players.length} jogadores • toque em um nome para abrir o perfil`;

    host.innerHTML = players.map(player => {
      const name = cleanName(player.name);
      const meta = player.ranking
        ? `${player.ranking.position}º geral • ${player.ranking.points} pts`
        : 'Perfil cadastrado • sem pontos no ranking';
      return `<button class="player-card v18-player-card v48-player-link" type="button" data-player-key="${escapeHtml(player.player_key)}" aria-label="Abrir página de ${escapeHtml(name)}"><span class="avatar" aria-hidden="true">${escapeHtml(initialsFor(name))}</span><span class="v48-player-copy"><b>${escapeHtml(name)}</b><small>${escapeHtml(meta)}</small></span><span class="v48-player-arrow" aria-hidden="true">›</span></button>`;
    }).join('') || '<div class="empty-state">Nenhum jogador cadastrado.</div>';
  }

  function collectPlayerResults(playerKey) {
    const state = runtime();
    if (state?.resultRows?.length && state?.stageRows?.length) {
      const stagesById = new Map(state.stageRows.map(stage => [stage.id, stage]));
      return state.resultRows
        .filter(result => result.player_key === playerKey)
        .map(result => {
          const stage = stagesById.get(result.stage_id);
          return {
            br: stage?.championship || '—',
            stageNumber: Number(stage?.stage_number) || 0,
            date: stage?.stage_date || '',
            dateLabel: stage?.stage_date
              ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${stage.stage_date}T12:00:00Z`))
              : '—',
            position: Number(result.position) || 0,
            points: Number(result.points) || 0,
            prize: result.prize == null ? 0 : Number(result.prize)
          };
        })
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.stageNumber - a.stageNumber);
    }

    const fallback = [];
    if (typeof stageSets === 'undefined') return fallback;
    for (const [br, stages] of Object.entries(stageSets)) {
      for (const stage of stages) {
        (stage.results || []).forEach((result, index) => {
          if (fallbackPlayerKey(result[0]) !== playerKey) return;
          fallback.push({
            br,
            stageNumber: Number(stage.n) || 0,
            date: stage.date,
            dateLabel: stage.date,
            position: index + 1,
            points: Number(result[1]) || 0,
            prize: result[2] == null ? 0 : Number(result[2])
          });
        });
      }
    }
    return fallback.reverse();
  }

  function rankingFor(playerKey, scope) {
    const stateRows = runtime()?.rankingRows || [];
    const cloudRow = stateRows.find(row => row.player_key === playerKey && row.scope === scope);
    if (cloudRow) return { points: Number(cloudRow.points) || 0, discard: Number(cloudRow.discard) || 0 };
    if (typeof rankSets === 'undefined') return null;
    const player = (rankSets[scope] || []).find(row => fallbackPlayerKey(row.name) === playerKey);
    return player ? { points: Number(player.pts) || 0, discard: Number(player.discard) || 0 } : null;
  }

  function completedStageCount() {
    const rows = runtime()?.stageRows || [];
    if (rows.length) return rows.filter(stage => stage.status === 'finalized').length;
    if (typeof stageSets === 'undefined') return 0;
    return Object.values(stageSets).flat().filter(stage => stage.results?.length).length;
  }

  function canEditPlayers() {
    try {
      return Boolean(backendReady && isAdmin && supa);
    } catch (_) {
      return false;
    }
  }

  function renderPlayerDetailV48(playerKey) {
    const player = getPlayer(playerKey);
    const host = document.getElementById('playerDetailV18');
    if (!player || !host) return false;

    activePlayerKey = playerKey;
    const name = cleanName(player.name);
    const results = collectPlayerResults(playerKey);
    const ranking = generalRanking();
    const rankingIndex = ranking.findIndex(row => row.player_key === playerKey);
    const general = rankingFor(playerKey, 'geral');
    const wins = results.filter(result => result.position === 1).length;
    const podiums = results.filter(result => result.position > 0 && result.position <= 3).length;
    const prizes = results.reduce((sum, result) => sum + result.prize, 0);
    const best = results.length ? Math.min(...results.map(result => result.position)) : null;
    const completed = completedStageCount();
    const frequency = completed ? Math.round((results.length / completed) * 100) : 0;
    const editable = canEditPlayers();

    const title = document.querySelector('#playerDetail .screen-top h2');
    const subtitle = document.querySelector('#playerDetail .screen-top p');
    if (title) title.textContent = name;
    if (subtitle) subtitle.textContent = 'Página individual do jogador';

    const editor = editable ? `<div class="v18-card v48-editor-card"><div class="v48-editor-head"><div><h3>Nome do jogador</h3><p>Somente administradores podem alterar. O histórico e a pontuação serão preservados.</p></div><button class="btn ghost" type="button" id="editPlayerNameV48">Editar nome</button></div><form id="playerNameFormV48" class="v48-name-form" hidden><label for="playerNameInputV48">Novo nome</label><input class="v18-input" id="playerNameInputV48" name="playerName" minlength="2" maxlength="60" autocomplete="off" value="${escapeHtml(name)}" required><div class="v48-form-actions"><button class="btn ghost" type="button" id="cancelPlayerNameV48">Cancelar</button><button class="btn gold" type="submit" id="savePlayerNameV48">Salvar nome</button></div><p class="v48-form-status" id="playerNameStatusV48" role="status" aria-live="polite"></p></form></div>` : '';

    host.innerHTML = `<article class="v48-player-profile" data-player-profile="${escapeHtml(playerKey)}"><div class="v18-card v18-player-head v48-player-head"><div class="avatar" aria-hidden="true">${escapeHtml(initialsFor(name))}</div><h2>${escapeHtml(name)}</h2><p>${general ? `${general.points} pontos • ${rankingIndex + 1}º geral` : 'Sem posição no ranking geral'}</p></div><div class="v18-grid-4 v48-main-stats"><div class="v18-metric"><span>Etapas</span><b>${results.length}</b></div><div class="v18-metric"><span>Vitórias</span><b>${wins}</b></div><div class="v18-metric"><span>Pódios</span><b>${podiums}</b></div><div class="v18-metric"><span>Frequência</span><b>${frequency}%</b></div></div><div class="v18-card v48-secondary-stats"><div class="v18-grid-3"><div class="v18-metric"><span>Melhor posição</span><b>${best ? `${best}º` : '—'}</b></div><div class="v18-metric"><span>Prêmios registrados</span><b>${money(prizes)}</b></div><div class="v18-metric"><span>Pontos atuais</span><b>${general?.points ?? 0}</b></div></div></div>${editor}<div class="v18-card"><h3>Por campeonato</h3><div class="v18-list">${['br1', 'br2', 'br3', 'br4'].map(scope => {
      const row = rankingFor(playerKey, scope);
      return `<div class="v18-list-row"><b>${scope.toUpperCase()}</b><span>${row ? 'Participou' : 'Sem pontos'}</span><strong>${row ? `${row.points} pts` : '—'}</strong></div>`;
    }).join('')}</div></div><div class="v18-card"><h3>Últimos resultados</h3><div class="v18-list">${results.slice(0, 12).map(result => `<div class="v18-list-row"><b>${result.position}º</b><span>${escapeHtml(result.br.toUpperCase())} • Etapa ${result.stageNumber}<small>${escapeHtml(result.dateLabel)}</small></span><strong>${result.points} pts</strong></div>`).join('') || '<div class="empty-state">Sem resultados registrados.</div>'}</div></div></article>`;

    if (typeof goTo === 'function') goTo('playerDetail');
    return true;
  }

  function routePlayerKey() {
    if (!window.location.hash.startsWith(ROUTE_PREFIX)) return null;
    try {
      return decodeURIComponent(window.location.hash.slice(ROUTE_PREFIX.length));
    } catch (_) {
      return null;
    }
  }

  function setPlayerRoute(playerKey) {
    const nextHash = `${ROUTE_PREFIX}${encodeURIComponent(playerKey)}`;
    if (window.location.hash === nextHash) return;
    window.history.pushState({ plpPlayer: playerKey }, '', nextHash);
  }

  function clearPlayerRoute() {
    if (!window.location.hash.startsWith(ROUTE_PREFIX)) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  function openPlayer(playerKey, pushRoute = true) {
    if (!renderPlayerDetailV48(playerKey)) return false;
    if (pushRoute) setPlayerRoute(playerKey);
    return true;
  }

  function closePlayerProfile() {
    const cameFromPlayers = window.history.state?.plpPlayer === activePlayerKey;
    activePlayerKey = null;
    if (cameFromPlayers) {
      window.history.back();
      return;
    }
    clearPlayerRoute();
    if (typeof goTo === 'function') goTo('players');
  }

  function setFormStatus(message, kind = '') {
    const status = document.getElementById('playerNameStatusV48');
    if (!status) return;
    status.textContent = message;
    status.className = `v48-form-status ${kind}`.trim();
  }

  function updateLocalPlayerName(playerKey, oldName, newName) {
    const state = runtime();
    const player = state?.playerRows?.find(row => row.player_key === playerKey);
    if (player) player.name = newName;
    (state?.stageRows || []).forEach(stage => {
      if (comparableName(stage.host_name) === comparableName(oldName)) stage.host_name = newName;
    });

    if (typeof rankSets !== 'undefined') {
      Object.values(rankSets).flat().forEach(row => {
        if (comparableName(row.name) === comparableName(oldName)) row.name = newName;
      });
    }
    if (typeof stageSets !== 'undefined') {
      Object.values(stageSets).flat().forEach(stage => {
        if (comparableName(stage.host_name) === comparableName(oldName)) stage.host_name = newName;
        (stage.results || []).forEach(result => {
          if (comparableName(result[0]) === comparableName(oldName)) result[0] = newName;
        });
      });
    }
  }

  function refreshLegacyScreens() {
    try {
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderClassified === 'function') renderClassified();
      if (typeof renderRanking === 'function' && typeof rankSets !== 'undefined') {
        const active = document.querySelector('.tab[data-rank].active')?.dataset.rank || 'geral';
        renderRanking('rankingList', rankSets[active] || rankSets.geral, active);
      }
    } catch (error) {
      console.warn('PLP: telas secundárias serão atualizadas na próxima abertura.', error);
    }
  }

  async function savePlayerName(event) {
    event.preventDefault();
    if (!activePlayerKey || !canEditPlayers()) {
      setFormStatus('Acesso administrativo necessário.', 'bad');
      return;
    }

    const player = getPlayer(activePlayerKey);
    const input = document.getElementById('playerNameInputV48');
    const button = document.getElementById('savePlayerNameV48');
    const nextName = cleanName(input?.value);
    if (!player || nextName.length < 2 || nextName.length > 60) {
      setFormStatus('Use um nome entre 2 e 60 caracteres.', 'bad');
      input?.focus();
      return;
    }

    const duplicate = playerRows().some(row => row.player_key !== activePlayerKey
      && comparableName(row.name) === comparableName(nextName));
    if (duplicate) {
      setFormStatus('Já existe outro jogador com esse nome.', 'bad');
      input?.focus();
      return;
    }

    const oldName = cleanName(player.name);
    if (oldName === nextName) {
      setFormStatus('O nome já está atualizado.', 'good');
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando…';
    }
    setFormStatus('Salvando alteração…');

    try {
      const { data, error } = await supa
        .from('players')
        .update({ name: nextName })
        .eq('player_key', activePlayerKey)
        .select('player_key,name')
        .single();
      if (error || !data) throw error || new Error('Jogador não encontrado');

      const hostUpdate = await supa
        .from('stages')
        .update({ host_name: nextName })
        .eq('host_name', oldName);
      if (hostUpdate.error) console.warn('PLP: nome salvo; anfitriões históricos atualizarão na próxima correção.', hostUpdate.error);

      updateLocalPlayerName(activePlayerKey, oldName, cleanName(data.name));
      renderPlayersV48();
      refreshLegacyScreens();
      renderPlayerDetailV48(activePlayerKey);
      if (typeof showToast === 'function') showToast(`Nome atualizado para ${cleanName(data.name)}.`);
    } catch (error) {
      console.error('PLP: falha ao atualizar nome do jogador.', error);
      setFormStatus('Não foi possível salvar o nome. Tente novamente.', 'bad');
      if (button) {
        button.disabled = false;
        button.textContent = 'Salvar nome';
      }
    }
  }

  function onDocumentClick(event) {
    const back = event.target.closest('#playerDetail .back-home');
    if (back) {
      event.preventDefault();
      event.stopPropagation();
      closePlayerProfile();
      return;
    }

    const card = event.target.closest('[data-player-key]');
    if (card && document.getElementById('players')?.classList.contains('active')) {
      event.preventDefault();
      event.stopPropagation();
      openPlayer(card.dataset.playerKey, true);
      return;
    }

    const edit = event.target.closest('#editPlayerNameV48');
    if (edit) {
      const form = document.getElementById('playerNameFormV48');
      if (form) {
        form.hidden = false;
        edit.hidden = true;
        document.getElementById('playerNameInputV48')?.focus();
      }
      return;
    }

    const cancel = event.target.closest('#cancelPlayerNameV48');
    if (cancel) {
      const form = document.getElementById('playerNameFormV48');
      const editButton = document.getElementById('editPlayerNameV48');
      const player = getPlayer(activePlayerKey);
      if (form) form.hidden = true;
      if (editButton) editButton.hidden = false;
      const input = document.getElementById('playerNameInputV48');
      if (input && player) input.value = cleanName(player.name);
      setFormStatus('');
      return;
    }

    const navigation = event.target.closest('[data-go]');
    if (navigation && activePlayerKey && navigation.dataset.go !== 'playerDetail') {
      activePlayerKey = null;
      clearPlayerRoute();
    }
  }

  function onPopState() {
    const playerKey = routePlayerKey();
    if (playerKey) {
      openPlayer(playerKey, false);
      return;
    }
    if (activePlayerKey) {
      activePlayerKey = null;
      if (typeof goTo === 'function') goTo('players');
    }
  }

  function openInitialRoute() {
    const playerKey = routePlayerKey();
    if (!playerKey) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (openPlayer(playerKey, false) || attempts >= 40) window.clearInterval(timer);
    }, 200);
  }

  function init() {
    if (!runtime() || !document.getElementById('playerDetail')) {
      window.setTimeout(init, 80);
      return;
    }
    if (window.PLP_PLAYER_PROFILES?.initialized) return;

    const previousRenderPlayers = typeof renderPlayers === 'function' ? renderPlayers : null;
    try {
      renderPlayers = renderPlayersV48;
    } catch (_) {
      if (previousRenderPlayers) previousRenderPlayers();
    }

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('submit', event => {
      if (event.target?.id === 'playerNameFormV48') savePlayerName(event);
    });
    window.addEventListener('popstate', onPopState);

    window.PLP_PLAYER_PROFILES = {
      initialized: true,
      build: BUILD,
      renderPlayers: renderPlayersV48,
      openPlayer,
      renderPlayerDetail: renderPlayerDetailV48,
      cleanName,
      comparableName
    };

    renderPlayersV48();
    openInitialRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
