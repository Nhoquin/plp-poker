/* PLP V24 • Blind Clock seguro, sincronizado e pronto para projeção */
(() => {
  'use strict';

  const POLL_MS = 4000;
  let syncPromise = null;
  let wakeLock = null;
  let observedLevel = null;
  let baselineReady = false;
  let audioContext = null;
  let soundMode = localStorage.getItem('plpClockSoundMode') || 'voice';

  function hasBackend(){
    try{
      return typeof backendReady !== 'undefined' && backendReady && typeof supa !== 'undefined' && !!supa;
    }catch(_){ return false; }
  }

  function activeClockScreen(){
    return !!document.getElementById('clockScreen')?.classList.contains('active');
  }

  function clockView(){
    try{ if(typeof currentClockView === 'function') return currentClockView(); }catch(_){ }
    return {level:0,remaining:1200,running:false};
  }

  function formatTime(seconds){
    const total = Math.max(0, Number(seconds)||0);
    const m = Math.floor(total/60), s = total%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function setProof(text,kind='ok'){
    const el = document.getElementById('clockSyncProofV24');
    if(!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function paintProof(){
    const v = clockView();
    const state = v.running ? 'ONLINE • RODANDO' : 'PAUSA SINCRONIZADA ONLINE';
    setProof(`✓ ${state} • Nível ${Number(v.level)+1} • ${formatTime(v.remaining)}`,'ok');
  }

  async function fetchOfficialClock({silent=true,force=false}={}){
    if(!hasBackend()){
      setProof('⚠ SEM CONEXÃO • controle online indisponível','bad');
      return null;
    }
    if(syncPromise && !force) return syncPromise;

    const task = (async() => {
      try{
        const {data,error} = await supa.from('clock_state').select('*').eq('id','main').single();
        if(error || !data) throw error || new Error('clock_state vazio');

        if(!baselineReady){
          observedLevel = Math.max(0, Number(data.level)||0);
          baselineReady = true;
        }
        try{ remoteClock = data; }catch(_){ }
        try{ if(typeof paintClock === 'function') paintClock(); }catch(_){ }
        paintProof();
        return data;
      }catch(_){
        setProof('⚠ SEM SINCRONIZAÇÃO • relógio oficial não alterado','bad');
        if(!silent && typeof showToast === 'function') showToast('Não foi possível confirmar o Blind Clock online.');
        return null;
      }
    })();

    syncPromise = task;
    try{ return await task; }
    finally{ if(syncPromise === task) syncPromise = null; }
  }

  function rawStateMatches(row,expected){
    if(!row) return false;
    return Number(row.level) === Number(expected.level)
      && Number(row.remaining_seconds) === Number(expected.remaining)
      && Boolean(row.running) === Boolean(expected.running);
  }

  async function verifySavedState(expected){
    const row = await fetchOfficialClock({silent:false,force:true});
    if(!rawStateMatches(row,expected)){
      setProof('⚠ ALTERAÇÃO NÃO CONFIRMADA ONLINE','bad');
      if(typeof showToast === 'function') showToast('O servidor não confirmou a alteração do Blind Clock.');
      return false;
    }
    paintProof();
    return true;
  }

  async function controlOfficialClock(action,button){
    if(!hasBackend()){
      setProof('⚠ SEM CONEXÃO • controle bloqueado','bad');
      if(typeof showToast === 'function') showToast('Sem conexão. O relógio oficial não foi alterado.');
      return;
    }

    if(button) button.disabled = true;
    try{
      const row = await fetchOfficialClock({silent:false,force:true});
      if(!row) return;

      const v = typeof derivedRemoteClock === 'function' ? derivedRemoteClock() : clockView();
      let next = {level:Number(v.level)||0, remaining:Math.max(0,Number(v.remaining)||0), running:Boolean(v.running)};

      if(action === 'startPause'){
        next.running = !next.running;
      }else if(action === 'addMinute'){
        next.remaining += 60;
      }else if(action === 'nextLevel'){
        const max = Array.isArray(blinds) ? blinds.length-1 : 14;
        next.level = Math.min(next.level+1,max);
        next.remaining = 1200;
      }else if(action === 'resetClock'){
        next = {level:0,remaining:1200,running:false};
      }else{
        return;
      }

      const ok = await saveRemoteClock(next);
      if(!ok){
        setProof('⚠ ALTERAÇÃO NÃO SALVA ONLINE','bad');
        return;
      }

      if(!(await verifySavedState(next))) return;

      if(action === 'startPause'){
        if(typeof showToast === 'function') showToast(next.running ? '✓ Blind Clock iniciado e confirmado online.' : '✓ Pausa sincronizada online.');
      }else if(action === 'addMinute'){
        if(typeof showToast === 'function') showToast('✓ +1 minuto confirmado online.');
      }else if(action === 'nextLevel'){
        if(typeof showToast === 'function') showToast('✓ Próximo nível confirmado online.');
      }else if(action === 'resetClock'){
        observedLevel = 0;
        baselineReady = true;
        if(typeof showToast === 'function') showToast('✓ Blind Clock resetado e confirmado online.');
      }
    }catch(_){
      setProof('⚠ ERRO DE SINCRONIZAÇÃO • tente novamente','bad');
      if(typeof showToast === 'function') showToast('Não foi possível confirmar o comando no relógio oficial.');
    }finally{
      if(button) button.disabled = false;
    }
  }

  // Em produção, os controles oficiais nunca caem para um relógio local.
  document.addEventListener('click',e => {
    const btn = e.target?.closest?.('#startPause,#addMinute,#nextLevel,#resetClock');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void controlOfficialClock(btn.id,btn);
  },true);

  setInterval(() => {
    if(document.visibilityState === 'visible') void fetchOfficialClock({silent:true});
  },POLL_MS);

  document.addEventListener('visibilitychange',() => {
    if(document.visibilityState === 'visible'){
      void fetchOfficialClock({silent:true,force:true});
      if(activeClockScreen()) void requestWakeLock();
    }
  });
  window.addEventListener('focus',() => void fetchOfficialClock({silent:true,force:true}));
  window.addEventListener('online',() => void fetchOfficialClock({silent:false,force:true}));

  /* Wake Lock */
  function setWakeStatus(text){
    const el = document.getElementById('clockWakeStatusV24');
    if(el) el.textContent = text;
  }

  async function requestWakeLock(){
    if(!activeClockScreen()) return;
    if(!('wakeLock' in navigator)){
      setWakeStatus('Tela ativa: recurso não suportado neste navegador');
      return;
    }
    if(document.visibilityState !== 'visible') return;
    if(wakeLock && !wakeLock.released){
      setWakeStatus('📱 Tela mantida ligada');
      return;
    }
    try{
      wakeLock = await navigator.wakeLock.request('screen');
      setWakeStatus('📱 Tela mantida ligada');
      wakeLock.addEventListener('release',() => {
        wakeLock = null;
        setWakeStatus('Tela pode apagar');
      },{once:true});
    }catch(_){
      setWakeStatus('Toque na tela para permitir manter o display ligado');
    }
  }

  async function releaseWakeLock(){
    try{ if(wakeLock && !wakeLock.released) await wakeLock.release(); }catch(_){ }
    wakeLock = null;
  }

  function refreshWakeLock(){
    setTimeout(() => {
      if(activeClockScreen()) void requestWakeLock();
      else void releaseWakeLock();
    },40);
  }

  document.addEventListener('click',e => {
    if(e.target?.closest?.('[data-go]')) refreshWakeLock();
  });

  /* Voz / bip */
  function ptVoice(){
    if(!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    return voices.find(v => String(v.lang||'').toLowerCase() === 'pt-br')
      || voices.find(v => String(v.lang||'').toLowerCase().startsWith('pt'))
      || null;
  }

  function blindNumber(text){
    return Number(String(text||'0').replace(/\./g,'').replace(/[^0-9]/g,'')) || 0;
  }

  function announcement(level){
    try{
      const item = blinds[level];
      if(!item) return '';
      const parts = String(item[0]).split('/');
      return `Atenção. Novo nível. Blinds ${blindNumber(parts[0])} e ${blindNumber(parts[1])}. Ante ${blindNumber(item[1])}.`;
    }catch(_){ return ''; }
  }

  function speakLevel(level){
    if(soundMode !== 'voice' || !('speechSynthesis' in window)) return;
    const text = announcement(level);
    if(!text) return;
    try{
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 0.95;
      u.pitch = 1;
      const voice = ptVoice();
      if(voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    }catch(_){ }
  }

  function beep(){
    if(soundMode !== 'beep') return;
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!audioContext) audioContext = new Ctx();
      if(audioContext.state === 'suspended') void audioContext.resume();
      const now = audioContext.currentTime;
      [0,0.22].forEach(offset => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001,now+offset);
        gain.gain.exponentialRampToValueAtTime(0.18,now+offset+0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.15);
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.start(now+offset); osc.stop(now+offset+0.17);
      });
    }catch(_){ }
  }

  function announceLevel(level){
    if(soundMode === 'voice') speakLevel(level);
    else if(soundMode === 'beep') beep();
  }

  function setSoundMode(mode,{preview=false}={}){
    if(!['voice','beep','silent'].includes(mode)) mode='voice';
    soundMode = mode;
    localStorage.setItem('plpClockSoundMode',mode);
    document.querySelectorAll('[data-clock-sound]').forEach(btn => btn.classList.toggle('active',btn.dataset.clockSound===mode));
    if(!preview) return;

    if(mode === 'voice' && 'speechSynthesis' in window){
      try{
        const u = new SpeechSynthesisUtterance('Voz do Blind Clock ativada.');
        u.lang='pt-BR';
        const voice=ptVoice(); if(voice) u.voice=voice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }catch(_){ }
    }else if(mode === 'beep'){
      beep();
    }
  }

  document.addEventListener('click',e => {
    const btn=e.target?.closest?.('[data-clock-sound]');
    if(!btn) return;
    setSoundMode(btn.dataset.clockSound,{preview:true});
  });

  setInterval(() => {
    if(!baselineReady) return;
    const level=Math.max(0,Number(clockView().level)||0);
    if(observedLevel===null){ observedLevel=level; return; }
    if(level!==observedLevel){
      observedLevel=level;
      announceLevel(level);
    }
  },500);

  /* UI */
  function injectStyles(){
    if(document.getElementById('plpClockV24Styles')) return;
    const style=document.createElement('style');
    style.id='plpClockV24Styles';
    style.textContent=`
      .plp-clock-v24-panel{margin:10px 0 12px;padding:11px;border:1px solid rgba(244,201,20,.22);border-radius:17px;background:rgba(8,8,7,.76)}
      .plp-clock-v24-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      .plp-clock-v24-sound{flex:1;min-width:92px;border:1px solid rgba(255,255,255,.14);background:#171510;color:#f6f0df;border-radius:12px;padding:9px 8px;font-size:10px;font-weight:800}
      .plp-clock-v24-sound.active{border-color:#f4c914;color:#ffe36a;box-shadow:0 0 0 1px rgba(244,201,20,.14) inset}
      .plp-clock-v24-proof{margin-top:8px;font-size:10px;font-weight:800;color:#7be6b3;letter-spacing:.2px}
      .plp-clock-v24-proof[data-kind="bad"]{color:#ff9e9e}
      .plp-clock-v24-wake{margin-top:5px;font-size:10px;color:#c5bcaa}
      #clockQuickAccessV24{display:none;width:100%;margin:10px 0 16px;padding:12px 13px;border-radius:18px;border:1px solid rgba(244,201,20,.34);background:linear-gradient(145deg,rgba(35,29,15,.92),rgba(8,8,7,.94));color:#fff;text-align:left;align-items:center;gap:11px}
      #clockQuickAccessV24.show{display:flex}
      #clockQuickAccessV24 .clock-dot{width:10px;height:10px;border-radius:50%;background:#f4c914;box-shadow:0 0 12px rgba(244,201,20,.65);flex:0 0 auto}
      #clockQuickAccessV24 .clock-copy{flex:1;min-width:0}
      #clockQuickAccessV24 .clock-copy b{display:block;color:#ffe36a;font-size:12px}
      #clockQuickAccessV24 .clock-copy span{display:block;margin-top:3px;color:#d7cfbe;font-size:10px}
      #clockQuickAccessV24 .clock-arrow{color:#ffe36a;font-size:22px}`;
    document.head.appendChild(style);
  }

  function ensureUI(){
    injectStyles();
    const clock=document.querySelector('#clockScreen .clock');
    if(clock && !document.getElementById('clockToolsV24')){
      const panel=document.createElement('div');
      panel.id='clockToolsV24';
      panel.className='plp-clock-v24-panel';
      panel.innerHTML=`
        <div class="plp-clock-v24-row">
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="voice">🔊 Voz</button>
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="beep">🔔 Bip</button>
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="silent">🔇 Silencioso</button>
        </div>
        <div class="plp-clock-v24-proof" id="clockSyncProofV24">Conferindo relógio oficial…</div>
        <div class="plp-clock-v24-wake" id="clockWakeStatusV24">Tela pode apagar</div>`;
      clock.insertAdjacentElement('afterend',panel);
      setSoundMode(soundMode,{preview:false});
    }

    const home=document.getElementById('home');
    if(home && !document.getElementById('clockQuickAccessV24')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.id='clockQuickAccessV24';
      btn.innerHTML='<span class="clock-dot"></span><span class="clock-copy"><b>BLIND CLOCK</b><span id="clockQuickAccessTextV24">Abrir relógio oficial</span></span><span class="clock-arrow">›</span>';
      const live=document.getElementById('liveStageV19');
      if(live) live.insertAdjacentElement('afterend',btn);
      else{
        const anchor=home.querySelector('.home-section-title') || home.firstElementChild;
        if(anchor) anchor.insertAdjacentElement('beforebegin',btn); else home.appendChild(btn);
      }
      btn.addEventListener('click',() => {
        try{ goTo('clockScreen'); }catch(_){ }
        void fetchOfficialClock({silent:false,force:true});
        setTimeout(() => void requestWakeLock(),60);
      });
    }
  }

  function updateQuickAccess(){
    ensureUI();
    const btn=document.getElementById('clockQuickAccessV24');
    const text=document.getElementById('clockQuickAccessTextV24');
    if(!btn || !text) return;
    const stage=window.PLP_V19?.snapshot?.stage;
    const v=clockView();
    const stageLive=!!stage?.game_started && stage?.status!=='finalized';
    const show=stageLive || Boolean(v.running);
    btn.classList.toggle('show',show);
    if(show) text.textContent=`Nível ${Number(v.level)+1} • ${formatTime(v.remaining)} • ${v.running?'rodando':'pausado'} • toque para abrir`;
  }

  const clockScreen=document.getElementById('clockScreen');
  if(clockScreen){
    new MutationObserver(refreshWakeLock).observe(clockScreen,{attributes:true,attributeFilter:['class']});
  }

  ensureUI();
  updateQuickAccess();
  setInterval(updateQuickAccess,1000);
  void fetchOfficialClock({silent:true,force:true});
})();
