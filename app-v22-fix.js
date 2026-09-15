/* PLP V24 • preserva formulário + reforça Blind Clock */
(() => {
  'use strict';

  /* =========================
     Formulário público V23
     ========================= */
  let editingSignup = false;
  let draftName = '';
  let draftPaid = '0';

  const isSignupField = el => el && (el.id === 'v19SignupName' || el.id === 'v19SignupPaid');

  function sameName(a,b){
    return String(a||'').trim().toLocaleLowerCase('pt-BR') === String(b||'').trim().toLocaleLowerCase('pt-BR');
  }

  function draftAlreadyRegistered(){
    if(!draftName) return false;
    const entries = window.PLP_V19?.snapshot?.entries || [];
    return entries.some(e => sameName(e.name, draftName));
  }

  function captureDraft(){
    const name = document.getElementById('v19SignupName');
    const paid = document.getElementById('v19SignupPaid');
    if(name) draftName = name.value || '';
    if(paid) draftPaid = paid.value || '0';
  }

  function restoreDraft(){
    if(draftAlreadyRegistered()){
      draftName = '';
      draftPaid = '0';
      return;
    }

    const name = document.getElementById('v19SignupName');
    const paid = document.getElementById('v19SignupPaid');

    if(name && draftName && name.value !== draftName) name.value = draftName;
    if(paid && paid.value !== draftPaid) paid.value = draftPaid;
  }

  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if(desc?.get && desc?.set && !Element.prototype.__plpV23SignupGuard){
    Object.defineProperty(Element.prototype, '__plpV23SignupGuard', {value:true, configurable:false});
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: desc.configurable,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value){
        if(this.id === 'stageLiveV19Body' && editingSignup){
          captureDraft();
          return;
        }
        return desc.set.call(this, value);
      }
    });
  }

  document.addEventListener('focusin', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('input', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('change', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('focusout', e => {
    if(!isSignupField(e.target)) return;
    captureDraft();
    setTimeout(() => {
      if(!isSignupField(document.activeElement)) editingSignup = false;
    }, 250);
  }, true);

  document.addEventListener('pointerdown', e => {
    if(e.target?.closest?.('#v19SignupPaid')){
      captureDraft();
      editingSignup = true;
    }
    if(e.target?.closest?.('#v19SignupButton')){
      captureDraft();
      editingSignup = false;
    }
  }, true);

  const signupObserver = new MutationObserver(() => restoreDraft());
  signupObserver.observe(document.documentElement, {childList:true, subtree:true});
  restoreDraft();

  /* =========================
     Blind Clock V24
     ========================= */
  let clockSyncBusy = false;
  let wakeLock = null;
  let observedLevel = null;
  let audioContext = null;
  let soundMode = localStorage.getItem('plpClockSoundMode') || 'voice';
  const CLOCK_SYNC_MS = 4000;

  function hasOfficialBackend(){
    try{
      return typeof backendReady !== 'undefined' && backendReady && typeof supa !== 'undefined' && !!supa;
    }catch(_){
      return false;
    }
  }

  function clockScreenActive(){
    return !!document.getElementById('clockScreen')?.classList.contains('active');
  }

  function safeClockView(){
    try{
      if(typeof currentClockView === 'function') return currentClockView();
    }catch(_){ }
    return {level:0,remaining:1200,running:false};
  }

  function clockTime(seconds){
    const total = Math.max(0, Number(seconds)||0);
    const m = Math.floor(total/60);
    const s = total%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function setSyncProof(text,kind='ok'){
    const el = document.getElementById('clockSyncProofV24');
    if(!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function updateSyncProofFromView(){
    const view = safeClockView();
    const level = Math.max(0, Number(view.level)||0) + 1;
    const state = view.running ? 'ONLINE • RODANDO' : 'PAUSA SINCRONIZADA ONLINE';
    setSyncProof(`✓ ${state} • Nível ${level} • ${clockTime(view.remaining)}`, 'ok');
  }

  async function syncClockFromServer({silent=true}={}){
    if(clockSyncBusy || !hasOfficialBackend()) return null;
    clockSyncBusy = true;
    try{
      const {data,error} = await supa.from('clock_state').select('*').eq('id','main').single();
      if(error || !data){
        setSyncProof('⚠ SEM SINCRONIZAÇÃO • não use controle local', 'bad');
        if(!silent && typeof showToast === 'function') showToast('Não foi possível confirmar o Blind Clock online.');
        return null;
      }
      try{ remoteClock = data; }catch(_){ }
      try{ if(typeof paintClock === 'function') paintClock(); }catch(_){ }
      updateSyncProofFromView();
      return data;
    }catch(_){
      setSyncProof('⚠ SEM CONEXÃO • relógio oficial não alterado', 'bad');
      if(!silent && typeof showToast === 'function') showToast('Sem conexão com o relógio oficial.');
      return null;
    }finally{
      clockSyncBusy = false;
    }
  }

  async function verifyOfficialState(expectedRunning){
    const row = await syncClockFromServer({silent:false});
    if(!row) return false;
    const ok = Boolean(row.running) === Boolean(expectedRunning);
    if(!ok){
      setSyncProof('⚠ ALTERAÇÃO NÃO CONFIRMADA ONLINE', 'bad');
      if(typeof showToast === 'function') showToast('A alteração não foi confirmada no relógio oficial.');
      return false;
    }
    updateSyncProofFromView();
    return true;
  }

  async function controlOfficialClock(action,button){
    if(!hasOfficialBackend()){
      setSyncProof('⚠ SEM CONEXÃO • controle bloqueado', 'bad');
      if(typeof showToast === 'function') showToast('Sem conexão. O relógio oficial não foi alterado.');
      return;
    }

    if(button) button.disabled = true;
    try{
      const fresh = await syncClockFromServer({silent:false});
      if(!fresh) return;

      const view = typeof derivedRemoteClock === 'function' ? derivedRemoteClock() : safeClockView();
      let next = {level:view.level,remaining:view.remaining,running:view.running};
      let expectedRunning = view.running;

      if(action === 'startPause'){
        next.running = !view.running;
        expectedRunning = next.running;
      }else if(action === 'addMinute'){
        next.remaining = view.remaining + 60;
      }else if(action === 'nextLevel'){
        const max = Array.isArray(blinds) ? blinds.length-1 : 14;
        next.level = Math.min(view.level+1,max);
        next.remaining = 1200;
      }else if(action === 'resetClock'){
        next = {level:0,remaining:1200,running:false};
        expectedRunning = false;
      }

      const ok = await saveRemoteClock(next);
      if(!ok){
        setSyncProof('⚠ ALTERAÇÃO NÃO SALVA ONLINE', 'bad');
        return;
      }

      const confirmed = await verifyOfficialState(expectedRunning);
      if(!confirmed) return;

      if(action === 'startPause'){
        if(typeof showToast === 'function') showToast(next.running ? '✓ Blind Clock iniciado e confirmado online.' : '✓ Pausa sincronizada online.');
      }else if(action === 'addMinute'){
        if(typeof showToast === 'function') showToast('✓ +1 minuto confirmado online.');
      }else if(action === 'nextLevel'){
        if(typeof showToast === 'function') showToast('✓ Próximo nível confirmado online.');
      }else if(action === 'resetClock'){
        observedLevel = 0;
        if(typeof showToast === 'function') showToast('✓ Blind Clock resetado e confirmado online.');
      }
    }catch(_){
      setSyncProof('⚠ ERRO DE SINCRONIZAÇÃO • tente novamente', 'bad');
      if(typeof showToast === 'function') showToast('Não foi possível confirmar o comando no relógio oficial.');
    }finally{
      if(button) button.disabled = false;
    }
  }

  // Intercepta os quatro controles antes dos listeners antigos. Em produção,
  // nenhuma ação vira “local” quando a conexão com o backend não puder ser confirmada.
  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('#startPause,#addMinute,#nextLevel,#resetClock');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const action = btn.id;
    void controlOfficialClock(action,btn);
  }, true);

  // Revalidação periódica: o Realtime continua ativo, mas não é mais o único caminho.
  // Se um evento for perdido, a tela volta ao estado oficial em no máximo alguns segundos.
  setInterval(() => {
    if(document.visibilityState === 'visible') void syncClockFromServer({silent:true});
  }, CLOCK_SYNC_MS);

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible'){
      void syncClockFromServer({silent:true});
      if(clockScreenActive()) void requestWakeLock();
    }
  });
  window.addEventListener('focus', () => void syncClockFromServer({silent:true}));
  window.addEventListener('online', () => void syncClockFromServer({silent:false}));

  /* =========================
     Wake Lock
     ========================= */
  function setWakeStatus(text){
    const el = document.getElementById('clockWakeStatusV24');
    if(el) el.textContent = text;
  }

  async function requestWakeLock(){
    if(!clockScreenActive()) return;
    if(!('wakeLock' in navigator)){
      setWakeStatus('Tela ativa: não suportado neste navegador');
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
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        setWakeStatus('Tela pode apagar');
      }, {once:true});
    }catch(_){
      setWakeStatus('Toque na tela para manter o display ligado');
    }
  }

  async function releaseWakeLock(){
    try{
      if(wakeLock && !wakeLock.released) await wakeLock.release();
    }catch(_){ }
    wakeLock = null;
  }

  function handleClockVisibility(){
    setTimeout(() => {
      if(clockScreenActive()) void requestWakeLock();
      else void releaseWakeLock();
    }, 30);
  }

  document.addEventListener('click', e => {
    if(e.target?.closest?.('[data-go]')) handleClockVisibility();
  });

  /* =========================
     Voz / bip na mudança de nível
     ========================= */
  function getPortugueseVoice(){
    if(!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    return voices.find(v => String(v.lang||'').toLowerCase() === 'pt-br') ||
           voices.find(v => String(v.lang||'').toLowerCase().startsWith('pt')) || null;
  }

  function numberFromBlind(text){
    return Number(String(text||'0').replace(/\./g,'').replace(/[^0-9]/g,'')) || 0;
  }

  function blindAnnouncement(level){
    try{
      const item = blinds[level];
      if(!item) return '';
      const parts = String(item[0]).split('/');
      const sb = numberFromBlind(parts[0]);
      const bb = numberFromBlind(parts[1]);
      const ante = numberFromBlind(item[1]);
      return `Atenção. Novo nível. Blinds ${sb} e ${bb}. Ante ${ante}.`;
    }catch(_){
      return '';
    }
  }

  function speakLevel(level){
    if(soundMode !== 'voice' || !('speechSynthesis' in window)) return;
    const text = blindAnnouncement(level);
    if(!text) return;
    try{
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 0.95;
      utter.pitch = 1;
      const voice = getPortugueseVoice();
      if(voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
    }catch(_){ }
  }

  function beepLevel(){
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
        gain.gain.setValueAtTime(0.0001, now+offset);
        gain.gain.exponentialRampToValueAtTime(0.18, now+offset+0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now+offset+0.15);
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.start(now+offset); osc.stop(now+offset+0.17);
      });
    }catch(_){ }
  }

  function announceLevel(level){
    if(soundMode === 'voice') speakLevel(level);
    else if(soundMode === 'beep') beepLevel();
  }

  function setSoundMode(mode){
    if(!['voice','beep','silent'].includes(mode)) mode = 'voice';
    soundMode = mode;
    localStorage.setItem('plpClockSoundMode',mode);
    document.querySelectorAll('[data-clock-sound]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.clockSound === mode);
    });
    if(mode === 'voice' && 'speechSynthesis' in window){
      try{
        const u = new SpeechSynthesisUtterance('Voz do Blind Clock ativada.');
        u.lang = 'pt-BR';
        u.rate = 1;
        const voice = getPortugueseVoice();
        if(voice) u.voice = voice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }catch(_){ }
    }else if(mode === 'beep'){
      beepLevel();
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('[data-clock-sound]');
    if(!btn) return;
    setSoundMode(btn.dataset.clockSound);
  });

  setInterval(() => {
    const view = safeClockView();
    const level = Math.max(0, Number(view.level)||0);
    if(observedLevel === null){
      observedLevel = level;
      return;
    }
    if(level !== observedLevel){
      observedLevel = level;
      announceLevel(level);
    }
  }, 500);

  /* =========================
     Acesso rápido + UI
     ========================= */
  function injectClockStyles(){
    if(document.getElementById('plpClockV24Styles')) return;
    const style = document.createElement('style');
    style.id = 'plpClockV24Styles';
    style.textContent = `
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
      #clockQuickAccessV24 .clock-arrow{color:#ffe36a;font-size:22px}
    `;
    document.head.appendChild(style);
  }

  function ensureClockTools(){
    injectClockStyles();
    const clock = document.querySelector('#clockScreen .clock');
    if(clock && !document.getElementById('clockToolsV24')){
      const panel = document.createElement('div');
      panel.id = 'clockToolsV24';
      panel.className = 'plp-clock-v24-panel';
      panel.innerHTML = `
        <div class="plp-clock-v24-row">
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="voice">🔊 Voz</button>
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="beep">🔔 Bip</button>
          <button type="button" class="plp-clock-v24-sound" data-clock-sound="silent">🔇 Silencioso</button>
        </div>
        <div class="plp-clock-v24-proof" id="clockSyncProofV24">Conferindo relógio oficial…</div>
        <div class="plp-clock-v24-wake" id="clockWakeStatusV24">Tela pode apagar</div>`;
      clock.insertAdjacentElement('afterend',panel);
      setSoundMode(soundMode);
    }

    const home = document.getElementById('home');
    if(home && !document.getElementById('clockQuickAccessV24')){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'clockQuickAccessV24';
      btn.innerHTML = '<span class="clock-dot"></span><span class="clock-copy"><b>BLIND CLOCK</b><span id="clockQuickAccessTextV24">Abrir relógio oficial</span></span><span class="clock-arrow">›</span>';
      const live = document.getElementById('liveStageV19');
      if(live) live.insertAdjacentElement('afterend',btn);
      else{
        const anchor = home.querySelector('.home-section-title') || home.firstElementChild;
        if(anchor) anchor.insertAdjacentElement('beforebegin',btn);
        else home.appendChild(btn);
      }
      btn.addEventListener('click', () => {
        try{ goTo('clockScreen'); }catch(_){ }
        void syncClockFromServer({silent:false});
        setTimeout(() => void requestWakeLock(),60);
      });
    }
  }

  function updateClockQuickAccess(){
    ensureClockTools();
    const btn = document.getElementById('clockQuickAccessV24');
    const txt = document.getElementById('clockQuickAccessTextV24');
    if(!btn || !txt) return;
    const stageStarted = !!window.PLP_V19?.snapshot?.stage?.game_started;
    btn.classList.toggle('show', stageStarted);
    if(!stageStarted) return;
    const view = safeClockView();
    const level = Math.max(0, Number(view.level)||0) + 1;
    txt.textContent = `Nível ${level} • ${clockTime(view.remaining)} • ${view.running?'rodando':'pausado'} • toque para abrir`;
  }

  const uiObserver = new MutationObserver(() => {
    ensureClockTools();
    handleClockVisibility();
  });
  uiObserver.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['class']});

  ensureClockTools();
  updateClockQuickAccess();
  setInterval(updateClockQuickAccess,1000);
  void syncClockFromServer({silent:true});
})();
