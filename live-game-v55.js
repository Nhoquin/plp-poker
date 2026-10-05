/* PLP V55 • acesso permanente ao Blind Clock e eliminações durante a partida */
(() => {
  'use strict';

  const BUILD = '59';
  const state = {timer:null,channel:null,busy:false,lastSignature:''};
  window.PLP_V55 = state;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
  const fmtTime = seconds => {
    const total = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  };
  const backendReady = () => {
    try { return typeof supa !== 'undefined' && !!supa; } catch (_) { return false; }
  };
  const toast = message => {
    try { if (typeof showToast === 'function') return showToast(message); } catch (_) {}
    console.log('[PLP V55]', message);
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
    const [stageQ,entriesQ,playersQ,clockQ] = await Promise.all([
      supa.from('stages').select('*').eq('id',stageId).maybeSingle(),
      supa.from('stage_entries').select('*').eq('stage_id',stageId).order('list_position'),
      supa.from('players').select('player_key,name'),
      supa.from('clock_state').select('*').eq('id','main').maybeSingle()
    ]);
    if (stageQ.error || !stageQ.data || entriesQ.error || playersQ.error || clockQ.error) return null;
    const names = new Map((playersQ.data || []).map(p => [p.player_key,p.name]));
    const entries = (entriesQ.data || []).map(e => ({...e,name:names.get(e.player_key) || e.player_key}));
    return {stage:stageQ.data, entries, clock:clockQ.data || null};
  }

  function ensureStyles() {
    if (document.getElementById('plpV55Styles')) return;
    const style = document.createElement('style');
    style.id = 'plpV55Styles';
    style.textContent = `
      .v55-live-ops{margin:10px 0 12px;padding:13px;border-radius:19px;border:1px solid rgba(123,230,179,.26);background:linear-gradient(145deg,rgba(11,24,19,.92),rgba(6,9,8,.98));box-shadow:0 14px 32px rgba(0,0,0,.24)}
      .v55-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.v55-head h3{margin:0;color:#a6f2cf;font-size:15px}.v55-head p{margin:4px 0 0;color:#bdc9c2;font-size:9px;line-height:1.45}.v55-badge{white-space:nowrap;padding:6px 8px;border-radius:999px;border:1px solid rgba(123,230,179,.28);background:rgba(123,230,179,.08);color:#9eeec8;font-size:7px;font-weight:950}
      .v55-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.v55-metrics>div{padding:9px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.v55-metrics span{display:block;color:#aeb8b2;font-size:8px}.v55-metrics b{display:block;margin-top:4px;color:#fff;font-size:13px}
      .v55-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.v55-actions button{min-height:43px;border-radius:12px;padding:9px;font-size:10px;font-weight:900}.v55-clock{border:1px solid #f4c914;background:#f4c914;color:#171206}.v55-elim{border:1px solid rgba(123,230,179,.38);background:rgba(123,230,179,.10);color:#a6f2cf}
      .v55-eliminated{margin-top:10px;padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.v55-eliminated strong{display:block;color:#ffe36a;font-size:9px;margin-bottom:5px}.v55-eliminated span{display:block;color:#d7d2c7;font-size:9px;line-height:1.55}
      @media(max-width:520px){.v55-metrics{grid-template-columns:1fr 1fr 1fr}.v55-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render(data) {
    const gameDay = document.getElementById('gameDay');
    if (!gameDay?.classList.contains('active')) return;
    const old = document.getElementById('v55LiveOps');

    if (!data?.stage?.game_started || data.stage.status !== 'open') {
      old?.remove();
      return;
    }

    const active = data.entries.filter(e => !e.eliminated_at && !e.elimination_order);
    const eliminated = data.entries
      .filter(e => e.eliminated_at || e.elimination_order)
      .sort((a,b) => (Number(a.finish_position)||999) - (Number(b.finish_position)||999));
    const clock = data.clock || {};
    const clockLabel = clock.running ? 'RODANDO' : 'PAUSADO';
    const signature = [
      data.stage.id,data.stage.updated_at,clock.updated_at,clock.running,clock.level,clock.remaining_seconds,
      active.length,eliminated.map(e => `${e.player_key}:${e.finish_position}`).join(',')
    ].join('|');
    if (old && signature === state.lastSignature) return;
    state.lastSignature = signature;

    const host = old || document.createElement('div');
    host.id = 'v55LiveOps';
    host.className = 'v55-live-ops';
    host.innerHTML = `
      <div class="v55-head"><div><h3>Partida em andamento</h3><p>Blind Clock e eliminações ficam sempre acessíveis aqui, mesmo quando o relógio estiver pausado.</p></div><span class="v55-badge">AO VIVO</span></div>
      <div class="v55-metrics">
        <div><span>Blind Clock</span><b>${clockLabel}</b></div>
        <div><span>Nível / tempo</span><b>${Number(clock.level||0)+1} • ${fmtTime(clock.remaining_seconds)}</b></div>
        <div><span>Em jogo / eliminados</span><b>${active.length} / ${eliminated.length}</b></div>
      </div>
      <div class="v55-actions">
        <button type="button" class="v55-clock" id="v55OpenClock">Abrir Blind Clock</button>
        <button type="button" class="v55-elim" id="v55OpenEliminations">Ver / registrar eliminações</button>
      </div>
      <div class="v55-eliminated">
        <strong>Eliminados registrados</strong>
        ${eliminated.length
          ? eliminated.map(e => `<span>${Number(e.finish_position)||'—'}º • ${esc(e.name)}</span>`).join('')
          : '<span>Nenhuma eliminação foi gravada nesta etapa até agora.</span>'}
      </div>
    `;

    if (!old) {
      const flow = document.getElementById('v52GameFlow');
      const anchor = flow || document.querySelector('#gameDay > .v18-card');
      if (anchor) anchor.insertAdjacentElement('afterend',host);
      else document.getElementById('gdContent')?.prepend(host);
    }

    host.querySelector('#v55OpenClock')?.addEventListener('click', () => {
      try { goTo('clockScreen'); } catch (_) { toast('Não foi possível abrir o Blind Clock.'); }
    });
    host.querySelector('#v55OpenEliminations')?.addEventListener('click', () => {
      const panel = document.getElementById('v25EliminationAdmin');
      if (panel) return panel.scrollIntoView({behavior:'smooth',block:'start'});
      toast('Carregando o controle de eliminações…');
      window.setTimeout(() => {
        document.getElementById('v25EliminationAdmin')?.scrollIntoView({behavior:'smooth',block:'start'});
      },500);
    });
  }

  async function refresh(force=false) {
    if (!backendReady() || !document.getElementById('gameDay')?.classList.contains('active')) return;
    if (state.busy && !force) return;
    state.busy = true;
    try {
      const data = await fetchData();
      if (data) render(data);
    } finally { state.busy = false; }
  }

  function init() {
    ensureStyles();
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-go="gameDay"]')) window.setTimeout(() => refresh(true),180);
    },true);
    state.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh(false).catch(()=>{});
    },1800);
    const wait = window.setInterval(() => {
      if (!backendReady()) return;
      window.clearInterval(wait);
      state.channel = supa.channel('plp-v55-live-ops')
        .on('postgres_changes',{event:'*',schema:'public',table:'stages'},()=>window.setTimeout(()=>refresh(true),80))
        .on('postgres_changes',{event:'*',schema:'public',table:'stage_entries'},()=>window.setTimeout(()=>refresh(true),80))
        .on('postgres_changes',{event:'*',schema:'public',table:'clock_state'},()=>window.setTimeout(()=>refresh(true),80))
        .subscribe();
      refresh(true).catch(()=>{});
    },120);
    console.info('PLP Poker V55 • Blind Clock e eliminações sempre acessíveis');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();