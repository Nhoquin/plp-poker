/* PLP V59 - Modo Projetor independente */
(() => {
  'use strict';

  const BUILD = '59';
  const mode = new URLSearchParams(location.search).get('projector') === 'clock';
  const fallbackBlinds = [
    ['100 / 200','200'],['200 / 400','400'],['300 / 600','600'],['400 / 800','800'],
    ['500 / 1.000','1.000'],['750 / 1.500','1.500'],['1.000 / 2.000','2.000'],
    ['1.500 / 3.000','3.000'],['2.000 / 4.000','4.000'],['2.500 / 5.000','5.000'],
    ['3.000 / 6.000','6.000'],['4.000 / 8.000','8.000'],['5.000 / 10.000','10.000'],
    ['7.500 / 15.000','15.000'],['10.000 / 20.000','20.000']
  ];
  const state = {
    client:null, clock:null, stage:null, field:0, active:0, online:false,
    serverMs:null, perfMs:null, channel:null, wake:null, busy:false
  };
  window.PLP_PROJECTOR_V59 = state;

  function list(){
    try { return typeof blinds !== 'undefined' && Array.isArray(blinds) && blinds.length ? blinds : fallbackBlinds; }
    catch(_) { return fallbackBlinds; }
  }

  function url(){
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('projector','clock');
    return u.toString();
  }

  function toast(msg){
    try { if(typeof showToast === 'function') return showToast(msg); } catch(_) {}
    console.log('[PLP V59]',msg);
  }

  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch(_) {
      try {
        const a=document.createElement('textarea');
        a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);
        a.select();const ok=document.execCommand('copy');a.remove();return ok;
      } catch(_) { return false; }
    }
  }

  function installControl(){
    if(mode) return;
    const style=document.createElement('style');
    style.id='plpProjectorControlStylesV59';
    style.textContent=
      '.p59-control{margin:10px 0 12px;padding:12px;border-radius:17px;border:1px solid rgba(244,201,20,.24);background:#11100b}' +
      '.p59-control b{display:block;color:#ffe36a;font-size:12px}.p59-control p{margin:4px 0 9px;color:#c9c0ae;font-size:9px}' +
      '.p59-control-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.p59-control button{min-height:42px;border-radius:12px;border:1px solid rgba(244,201,20,.3);background:#19160f;color:#ffe36a;font-weight:900}' +
      '.p59-control button:first-child{background:#f4c914;color:#151108}.p59-control small{display:block;margin-top:8px;color:#8f887a;word-break:break-all}' +
      '@media(max-width:520px){.p59-control-actions{grid-template-columns:1fr}}';
    document.head.appendChild(style);

    const attach=()=>{
      if(document.getElementById('projectorControlV59')) return true;
      const anchor=document.getElementById('clockToolsV24');
      if(!anchor) return false;
      const box=document.createElement('div');
      box.id='projectorControlV59';
      box.className='p59-control';
      box.innerHTML='<b>Modo Projetor</b><p>Use o box no projetor. O celular fica livre para trocar de tela ou apagar o display.</p>' +
        '<div class="p59-control-actions"><button id="p59Open" type="button">Abrir modo projetor</button><button id="p59Copy" type="button">Copiar link do projetor</button></div>' +
        '<small>'+url()+'</small>';
      anchor.insertAdjacentElement('afterend',box);
      box.querySelector('#p59Open').addEventListener('click',()=>{
        const w=window.open(url(),'_blank','noopener');
        if(!w) toast('O navegador bloqueou a nova janela. Use Copiar link do projetor.');
      });
      box.querySelector('#p59Copy').addEventListener('click',async()=>{
        toast(await copy(url()) ? 'Link do projetor copiado.' : 'Não foi possível copiar o link.');
      });
      return true;
    };
    if(attach()) return;
    const t=setInterval(()=>{if(attach())clearInterval(t)},250);
    setTimeout(()=>clearInterval(t),20000);
  }

  function nowServer(){
    if(Number.isFinite(state.serverMs) && Number.isFinite(state.perfMs)){
      return state.serverMs + (performance.now()-state.perfMs);
    }
    return Date.now();
  }

  function view(){
    const b=list();
    const r=state.clock;
    if(!r) return {level:0,remaining:1200,running:false};
    let level=Math.max(0,Math.min(b.length-1,Number(r.level)||0));
    let rem=Math.max(0,Number(r.remaining_seconds)||0);
    if(!r.running || !r.started_at) return {level:level,remaining:rem,running:false};
    let elapsed=Math.max(0,Math.floor((nowServer()-Date.parse(r.started_at))/1000));
    while(elapsed>=rem && level<b.length-1){ elapsed-=rem; level++; rem=1200; }
    if(level===b.length-1 && elapsed>=rem) return {level:level,remaining:0,running:false};
    return {level:level,remaining:Math.max(0,rem-elapsed),running:true};
  }

  function fmt(sec){
    sec=Math.max(0,Math.floor(Number(sec)||0));
    return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  }

  function createUI(){
    document.body.classList.add('p59-projector-mode');
    const style=document.createElement('style');
    style.id='p59ProjectorStyles';
    style.textContent=
      'html,body{background:#050505!important}body.p59-projector-mode{margin:0!important;overflow:hidden!important}' +
      'body.p59-projector-mode>*:not(#p59Projector):not(script){display:none!important}' +
      '#p59Projector{position:fixed;inset:0;z-index:2147483647;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(circle at 45% 35%,rgba(110,88,16,.22),transparent 38%),#050505;color:#fff;font-family:Arial,sans-serif}' +
      '.p59-top{display:flex;align-items:center;gap:2vw;padding:2vh 3vw;border-bottom:1px solid rgba(244,201,20,.18)}.p59-logo{width:min(8vw,110px);height:min(8vw,110px);object-fit:contain}' +
      '.p59-title{flex:1}.p59-title b{display:block;color:#ffe052;font-size:clamp(24px,3.2vw,56px)}.p59-title span{display:block;margin-top:.5vh;color:#aaa391;font-size:clamp(12px,1.2vw,22px);font-weight:800;letter-spacing:.12em}' +
      '.p59-full{min-height:42px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#121212;color:#ddd;font-weight:800}' +
      '.p59-main{display:grid;grid-template-columns:1.5fr 1fr;gap:2vw;align-items:center;padding:2vh 4vw}.p59-clock{text-align:center}.p59-level{color:#f4c914;font-size:clamp(22px,3vw,52px);font-weight:950;letter-spacing:.12em}' +
      '.p59-time{font-size:clamp(150px,22vw,380px);line-height:.86;font-weight:950;letter-spacing:-.07em;font-variant-numeric:tabular-nums}.p59-status{display:inline-block;margin-top:2vh;padding:8px 14px;border-radius:999px;border:1px solid rgba(123,230,179,.3);color:#9eeec8;font-size:clamp(10px,1vw,18px);font-weight:900}' +
      '.p59-side{display:grid;gap:1.5vh}.p59-card{padding:2vh 2vw;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035)}.p59-label{color:#aaa391;font-size:clamp(11px,1vw,19px);font-weight:900;letter-spacing:.12em;text-transform:uppercase}' +
      '.p59-blinds{margin-top:.7vh;font-size:clamp(46px,6.2vw,110px);font-weight:950}.p59-ante{margin-top:.6vh;color:#ffe052;font-size:clamp(24px,3vw,52px);font-weight:900}.p59-next{margin-top:.7vh;font-size:clamp(28px,3.4vw,60px);font-weight:900}' +
      '.p59-bottom{display:flex;justify-content:space-between;gap:2vw;padding:1.4vh 3vw;border-top:1px solid rgba(255,255,255,.08);color:#918a7c;font-size:clamp(10px,1vw,17px);font-weight:800}' +
      '#p59Conn[data-online="0"]{color:#ffad88}#p59Conn[data-online="1"]{color:#8ce6b6}.p59-paused .p59-time{color:#ffe052}.p59-wait .p59-time{opacity:.32}' +
      '@media(max-aspect-ratio:4/3){.p59-main{grid-template-columns:1fr;overflow:auto}.p59-side{grid-template-columns:1fr 1fr}.p59-time{font-size:clamp(110px,25vw,280px)}}';
    document.head.appendChild(style);

    const root=document.createElement('main');
    root.id='p59Projector';
    root.innerHTML=
      '<div class="p59-top"><img class="p59-logo" src="assets/plp-logo-v47.png"><div class="p59-title"><b id="p59Stage">PRIMEIRA LIGA DE POKER</b><span id="p59Sub">CONECTANDO AO BLIND CLOCK...</span></div><button class="p59-full" id="p59Full" type="button">Tela cheia</button></div>' +
      '<div class="p59-main"><section class="p59-clock"><div class="p59-level" id="p59Level">NÍVEL 1</div><div class="p59-time" id="p59Time">20:00</div><div class="p59-status" id="p59Conn" data-online="0">CONECTANDO...</div></section>' +
      '<aside class="p59-side"><div class="p59-card"><div class="p59-label">Blinds</div><div class="p59-blinds" id="p59Blinds">100 / 200</div><div class="p59-ante">ANTE <span id="p59Ante">200</span></div></div>' +
      '<div class="p59-card"><div class="p59-label">Próximo nível</div><div class="p59-next" id="p59Next">200 / 400</div><div class="p59-ante">ANTE <span id="p59NextAnte">400</span></div></div></aside></div>' +
      '<div class="p59-bottom"><span id="p59Players">Aguardando etapa ativa</span><span id="p59Wake">Mantendo tela ativa...</span><span>PLP • MODO PROJETOR • V'+BUILD+'</span></div>';
    document.body.appendChild(root);
    root.querySelector('#p59Full').addEventListener('click',async()=>{
      try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch(_) {}
      wake();
    });
    root.addEventListener('click',wake,{passive:true});
  }

  async function wake(){
    const el=document.getElementById('p59Wake');
    if(!('wakeLock' in navigator)){ if(el)el.textContent='Wake Lock não suportado pelo box'; return; }
    if(document.visibilityState!=='visible')return;
    try{
      if(state.wake && !state.wake.released){ if(el)el.textContent='Tela do box mantida ativa'; return; }
      state.wake=await navigator.wakeLock.request('screen');
      if(el)el.textContent='Tela do box mantida ativa';
      state.wake.addEventListener('release',()=>{state.wake=null},{once:true});
    }catch(_){ if(el)el.textContent='Toque uma vez para manter a tela ativa'; }
  }

  function render(){
    const root=document.getElementById('p59Projector');
    if(!root)return;
    const b=list(),v=view(),level=Math.max(0,Math.min(b.length-1,v.level)),next=Math.min(level+1,b.length-1),s=state.stage;
    const started=!!s?.game_started && s?.status==='open',finalized=s?.status==='finalized';
    root.querySelector('#p59Stage').textContent=s ? String(s.championship||'').toUpperCase()+' • ETAPA '+s.stage_number : 'PRIMEIRA LIGA DE POKER';
    root.querySelector('#p59Sub').textContent=finalized ? 'ETAPA FINALIZADA' : started ? (v.running?'BLIND CLOCK EM ANDAMENTO':'BLIND CLOCK PAUSADO') : 'AGUARDANDO INÍCIO DA PARTIDA';
    root.querySelector('#p59Level').textContent='NÍVEL '+(level+1);
    root.querySelector('#p59Time').textContent=fmt(v.remaining);
    root.querySelector('#p59Blinds').textContent=b[level][0];
    root.querySelector('#p59Ante').textContent=b[level][1];
    root.querySelector('#p59Next').textContent=b[next][0];
    root.querySelector('#p59NextAnte').textContent=b[next][1];
    root.querySelector('#p59Players').textContent=s ? state.active+' em jogo • '+state.field+' inscritos' : 'Aguardando etapa ativa';
    const conn=root.querySelector('#p59Conn');
    conn.textContent=state.online?'ONLINE • SINCRONIZADO':'SEM CONEXÃO • CONTAGEM LOCAL';
    conn.dataset.online=state.online?'1':'0';
    root.classList.toggle('p59-paused',started&&!v.running);
    root.classList.toggle('p59-wait',!started||finalized);
  }

  async function client(){
    if(state.client)return state.client;
    const cfg=window.PLP_SUPABASE_CONFIG;
    if(!cfg?.url||!cfg?.anonKey||!window.supabase?.createClient)return null;
    state.client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return state.client;
  }

  async function sync(){
    if(state.busy)return;
    state.busy=true;
    try{
      const c=await client();
      if(!c)throw new Error('sem cliente');
      const q=await c.rpc('plp_public_projector_snapshot');
      if(q.error||!q.data)throw q.error||new Error('sem dados');
      const d=q.data;
      state.clock=d.clock||null;state.stage=d.stage||null;state.field=Number(d.field)||0;state.active=Number(d.active_players)||0;
      const ms=Date.parse(d.server_now||'');
      if(Number.isFinite(ms)){state.serverMs=ms;state.perfMs=performance.now();}
      state.online=true;
    }catch(_){state.online=false}
    finally{state.busy=false;render()}
  }

  async function realtime(){
    const c=await client();
    if(!c||state.channel)return;
    state.channel=c.channel('plp-projector-v59')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'clock_state',filter:'id=eq.main'},p=>{state.clock=p.new||state.clock;state.online=true;render();setTimeout(sync,120)})
      .on('postgres_changes',{event:'*',schema:'public',table:'stages'},()=>setTimeout(sync,120))
      .on('postgres_changes',{event:'*',schema:'public',table:'league_state'},()=>setTimeout(sync,120))
      .subscribe(st=>{if(st==='SUBSCRIBED')state.online=true;if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED')state.online=false;render()});
  }

  async function startProjector(){
    createUI();
    await sync();
    await realtime();
    wake();
    setInterval(render,250);
    setInterval(sync,5000);
    addEventListener('online',()=>{state.online=true;sync()});
    addEventListener('offline',()=>{state.online=false;render()});
    addEventListener('focus',sync);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sync();wake()}});
    console.info('PLP V59 - Modo Projetor ativo');
  }

  if(mode) startProjector();
  else installControl();
})();