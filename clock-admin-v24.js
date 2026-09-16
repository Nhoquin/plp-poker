/* PLP V24 • reposicionamento administrativo do Blind Clock */
(() => {
  'use strict';

  const state = {busy:false,lastLoadedAt:0,editing:false};

  function canUse(){
    try{
      return typeof backendReady !== 'undefined' && backendReady &&
             typeof supa !== 'undefined' && !!supa &&
             typeof isAdmin !== 'undefined' && isAdmin;
    }catch(_){ return false; }
  }

  function getBlinds(){
    try{ return Array.isArray(blinds) ? blinds : []; }catch(_){ return []; }
  }

  function fmtTime(total){
    total=Math.max(0,Math.floor(Number(total)||0));
    const m=Math.floor(total/60),s=total%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function setMsg(text,kind='muted'){
    const el=document.getElementById('clockRepositionMsgV24');
    if(!el) return;
    el.textContent=text;
    el.dataset.kind=kind;
  }

  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

  function injectStyles(){
    if(document.getElementById('clockRepositionStylesV24')) return;
    const s=document.createElement('style');
    s.id='clockRepositionStylesV24';
    s.textContent=`
      #clockRepositionV24{display:none;margin:12px 0;padding:13px;border-radius:18px;border:1px solid rgba(244,201,20,.24);background:rgba(9,9,8,.84)}
      #clockRepositionV24.show{display:block}
      #clockRepositionV24 h3{margin:0 0 4px;font-size:13px;color:#ffe36a}
      #clockRepositionV24 p{margin:0 0 11px;color:#c5bcaa;font-size:10px;line-height:1.45}
      .clock-reposition-grid{display:grid;grid-template-columns:1fr 90px 90px;gap:8px}
      .clock-reposition-field label{display:block;margin-bottom:5px;color:#c5bcaa;font-size:9px;text-transform:uppercase;letter-spacing:.5px}
      .clock-reposition-field select,.clock-reposition-field input{width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#16140f;color:#fff;padding:9px 10px;font-size:16px}
      .clock-reposition-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .clock-reposition-actions button{min-height:46px;border-radius:13px;border:1px solid rgba(244,201,20,.30);font-weight:850}
      .clock-reposition-pause{background:#242019;color:#ffe36a}
      .clock-reposition-run{background:#f4c914;color:#111;border-color:#f4c914!important}
      .clock-reposition-refresh{width:100%;min-height:40px;margin-top:8px;border-radius:12px;border:1px solid rgba(255,255,255,.13);background:#15140f;color:#eee;font-size:10px;font-weight:750}
      #clockRepositionMsgV24{margin-top:8px;font-size:10px;color:#c5bcaa}
      #clockRepositionMsgV24[data-kind="ok"]{color:#7be6b3}
      #clockRepositionMsgV24[data-kind="bad"]{color:#ff9e9e}
      @media(max-width:520px){.clock-reposition-grid{grid-template-columns:1fr 1fr}.clock-reposition-field.level{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  function levelOptions(){
    const list=getBlinds();
    return list.map((b,i)=>`<option value="${i}">Nível ${i+1} — ${b[0]} — Ante ${b[1]}</option>`).join('');
  }

  function ensurePanel(){
    injectStyles();
    const screen=document.getElementById('clockScreen');
    if(!screen) return null;
    let panel=document.getElementById('clockRepositionV24');
    if(!panel){
      panel=document.createElement('div');
      panel.id='clockRepositionV24';
      panel.innerHTML=`
        <h3>Reposicionar Blind Clock</h3>
        <p>Uso administrativo. Escolha o nível e o tempo exato. O novo ponto só é aceito depois de confirmado no Supabase.</p>
        <div class="clock-reposition-grid">
          <div class="clock-reposition-field level"><label for="clockRepositionLevelV24">Nível / blinds</label><select id="clockRepositionLevelV24">${levelOptions()}</select></div>
          <div class="clock-reposition-field"><label for="clockRepositionMinV24">Minutos</label><input id="clockRepositionMinV24" type="number" inputmode="numeric" min="0" max="120" value="20"></div>
          <div class="clock-reposition-field"><label for="clockRepositionSecV24">Segundos</label><input id="clockRepositionSecV24" type="number" inputmode="numeric" min="0" max="59" value="0"></div>
        </div>
        <div class="clock-reposition-actions">
          <button type="button" class="clock-reposition-pause" id="clockApplyPausedV24">Aplicar pausado</button>
          <button type="button" class="clock-reposition-run" id="clockApplyRunningV24">Aplicar e iniciar</button>
        </div>
        <button type="button" class="clock-reposition-refresh" id="clockLoadOfficialV24">↻ Carregar posição oficial atual</button>
        <div id="clockRepositionMsgV24">Aguardando leitura do relógio oficial.</div>`;
      const anchor=document.getElementById('clockToolsV24') || screen.querySelector('.clock');
      if(anchor) anchor.insertAdjacentElement('afterend',panel); else screen.appendChild(panel);

      document.getElementById('clockApplyPausedV24').addEventListener('click',()=>applyPosition(false));
      document.getElementById('clockApplyRunningV24').addEventListener('click',()=>applyPosition(true));
      document.getElementById('clockLoadOfficialV24').addEventListener('click',()=>{state.editing=false;void loadOfficial(true);});
      ['clockRepositionLevelV24','clockRepositionMinV24','clockRepositionSecV24'].forEach(id=>{
        const el=document.getElementById(id);
        el?.addEventListener('input',()=>{state.editing=true;setMsg('Valores editados. Use “Aplicar pausado” ou “Aplicar e iniciar”.');});
        el?.addEventListener('change',()=>{state.editing=true;});
      });
    }
    panel.classList.toggle('show',canUse());
    return panel;
  }

  function fillFromRow(row){
    if(!row) return;
    const level=document.getElementById('clockRepositionLevelV24');
    const min=document.getElementById('clockRepositionMinV24');
    const sec=document.getElementById('clockRepositionSecV24');
    let remaining=Math.max(0,Number(row.remaining_seconds)||0);
    if(row.running && row.started_at){
      const elapsed=Math.max(0,Math.floor((Date.now()-Date.parse(row.started_at))/1000));
      remaining=Math.max(0,remaining-elapsed);
    }
    if(level) level.value=String(clamp(Number(row.level)||0,0,Math.max(0,getBlinds().length-1)));
    if(min) min.value=String(Math.floor(remaining/60));
    if(sec) sec.value=String(remaining%60);
    state.editing=false;
    setMsg(`Oficial: Nível ${(Number(row.level)||0)+1} • ${fmtTime(remaining)} • ${row.running?'rodando':'pausado'}`,'ok');
  }

  async function loadOfficial(showToastOnError=false){
    if(!canUse()){
      setMsg('Acesso administrativo ou conexão online indisponível.','bad');
      return null;
    }
    try{
      const {data,error}=await supa.from('clock_state').select('*').eq('id','main').single();
      if(error||!data) throw error||new Error('clock_state vazio');
      try{ remoteClock=data; if(typeof paintClock==='function') paintClock(); }catch(_){ }
      fillFromRow(data);
      state.lastLoadedAt=Date.now();
      return data;
    }catch(_){
      setMsg('Não foi possível ler o relógio oficial. Nenhuma alteração foi feita.','bad');
      if(showToastOnError && typeof showToast==='function') showToast('Não foi possível ler o relógio oficial.');
      return null;
    }
  }

  function readTarget(){
    const list=getBlinds();
    const level=clamp(Number(document.getElementById('clockRepositionLevelV24')?.value)||0,0,Math.max(0,list.length-1));
    const min=clamp(Math.floor(Number(document.getElementById('clockRepositionMinV24')?.value)||0),0,120);
    const sec=clamp(Math.floor(Number(document.getElementById('clockRepositionSecV24')?.value)||0),0,59);
    const remaining=min*60+sec;
    document.getElementById('clockRepositionMinV24').value=String(min);
    document.getElementById('clockRepositionSecV24').value=String(sec);
    return {level,remaining};
  }

  async function applyPosition(running){
    if(state.busy) return;
    if(!canUse()){
      setMsg('Sem conexão administrativa. Reposicionamento bloqueado.','bad');
      if(typeof showToast==='function') showToast('Sem conexão administrativa. O relógio não foi alterado.');
      return;
    }
    const target=readTarget();
    if(target.remaining<1){
      setMsg('Informe pelo menos 00:01 para reposicionar o relógio.','bad');
      return;
    }
    state.busy=true;
    const buttons=[document.getElementById('clockApplyPausedV24'),document.getElementById('clockApplyRunningV24')].filter(Boolean);
    buttons.forEach(b=>b.disabled=true);
    setMsg('Gravando e confirmando no relógio oficial…');
    try{
      const {data:before,error:beforeError}=await supa.from('clock_state').select('*').eq('id','main').single();
      if(beforeError||!before) throw beforeError||new Error('Falha ao ler estado atual');
      if(typeof saveRemoteClock!=='function') throw new Error('saveRemoteClock indisponível');

      const saved=await saveRemoteClock({level:target.level,remaining:target.remaining,running});
      if(!saved) throw new Error('Falha ao salvar');

      const {data,error}=await supa.from('clock_state').select('*').eq('id','main').single();
      if(error||!data) throw error||new Error('Falha ao confirmar');
      const levelOk=Number(data.level)===target.level;
      const runningOk=Boolean(data.running)===Boolean(running);
      let remainingOk=false;
      if(running){
        const elapsed=data.started_at?Math.max(0,Math.floor((Date.now()-Date.parse(data.started_at))/1000)):0;
        const live=Math.max(0,Number(data.remaining_seconds)-elapsed);
        remainingOk=Math.abs(live-target.remaining)<=4;
      }else{
        remainingOk=Number(data.remaining_seconds)===target.remaining;
      }
      if(!(levelOk&&runningOk&&remainingOk)) throw new Error('Confirmação divergente');

      try{ remoteClock=data; if(typeof paintClock==='function') paintClock(); }catch(_){ }
      fillFromRow(data);
      const label=getBlinds()[target.level]?.[0]||`Nível ${target.level+1}`;
      setMsg(`✓ Confirmado online: Nível ${target.level+1} • ${label} • ${fmtTime(target.remaining)} • ${running?'rodando':'pausado'}`,'ok');
      if(typeof showToast==='function') showToast(running?'✓ Relógio reposicionado e iniciado online.':'✓ Relógio reposicionado e mantido pausado.');
    }catch(_){
      setMsg('⚠ Reposicionamento não confirmado. Confira o relógio oficial antes de continuar.','bad');
      if(typeof showToast==='function') showToast('Reposicionamento não confirmado.');
    }finally{
      state.busy=false;
      buttons.forEach(b=>b.disabled=false);
    }
  }

  function refreshVisibility(){
    const panel=ensurePanel();
    if(panel && panel.classList.contains('show') && !state.editing && Date.now()-state.lastLoadedAt>15000) void loadOfficial(false);
  }

  ensurePanel();
  setInterval(refreshVisibility,1500);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') refreshVisibility(); });
})();
