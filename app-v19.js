/* PLP V19 • inscrições públicas, pré-jogo e financeiro pelo regulamento */
(() => {
  'use strict';

  const REGULATION_PRIZES = {
    7:[150,90,60], 8:[170,105,75], 9:[190,120,90], 10:[210,135,105],
    11:[210,135,105,50], 12:[225,150,115,60], 13:[240,165,125,70], 14:[255,180,135,80],
    15:[270,195,145,90], 16:[285,210,155,100], 17:[285,210,155,100,50], 18:[295,220,165,110,60],
    19:[305,230,175,120,70], 20:[315,240,185,130,80], 21:[325,250,195,140,90], 22:[335,260,205,150,100]
  };
  const JACKPOT_SPLIT = [32,17,13,10,8,7,6,5,2];
  const V19 = {
    ready:false,
    snapshot:null,
    poll:null,
    adminRefresh:null,
    patchTimer:null,
    lastAdminStageId:null,
    renderingAdmin:false
  };
  window.PLP_V19 = V19;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const fmtDate = d => {
    if(!d) return '—';
    const [y,m,day] = String(d).slice(0,10).split('-');
    return `${day}/${m}/${y}`;
  };
  const normName = name => {
    try { return typeof normalizePlayerName === 'function' ? normalizePlayerName(String(name||'')) : String(name||'').trim(); }
    catch { return String(name||'').trim(); }
  };
  const playerKey = name => {
    const normalized=normName(name);
    return normalized==='Daniel All Capone'
      ? 'daniel'
      : normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'jogador';
  };
  const paymentText = status => ({confirmed:'PAGO CONFIRMADO',informed:'PAGAMENTO INFORMADO',pending:'PENDENTE',exempt:'ISENTO'}[status] || String(status||'PENDENTE').toUpperCase());
  const paymentClass = status => status==='confirmed'?'good':status==='informed'?'warn':status==='exempt'?'exempt':'bad';

  function calcStage(stage, entries, finalizedJackpot=0){
    entries = Array.isArray(entries) ? entries : [];
    const field = entries.length;
    const host = entries.find(e=>e.is_host) || null;
    const payers = entries.filter(e=>!e.is_host).length;
    const buyin = Number(stage?.buy_in)||60;
    const automatic = {
      collected:payers*buyin,
      jackpot:payers*10,
      prizePool:payers*50
    };
    const manual = stage?.financial_mode==='manual';
    const current = {
      collected:manual && stage.collected_amount!=null ? Number(stage.collected_amount) : automatic.collected,
      jackpot:manual && stage.jackpot_amount!=null ? Number(stage.jackpot_amount) : automatic.jackpot,
      prizePool:manual && stage.prize_pool!=null ? Number(stage.prize_pool) : automatic.prizePool
    };
    const payout = REGULATION_PRIZES[field] || [];
    const projectedJackpot = Number(finalizedJackpot||0) + current.jackpot;
    return {field,host,payers,buyin,automatic,current,payout,projectedJackpot,manual};
  }

  async function waitForBackend(){
    for(let i=0;i<120;i++){
      try{
        if(typeof supa!=='undefined' && supa && window.PLP_V18) return true;
      }catch{}
      await sleep(100);
    }
    return false;
  }

  function loadCss(){
    if(document.querySelector('link[data-plp-v19]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='v19.css?v=19';link.dataset.plpV19='1';
    document.head.appendChild(link);
  }

  function injectHomeCard(){
    if(document.getElementById('liveStageV19')) return;
    const anchor=document.querySelector('#home .home-section-title');
    if(!anchor) return;
    anchor.insertAdjacentHTML('beforebegin',`<button class="v19-live-stage" id="liveStageV19" type="button">
      <span class="v19-live-dot"></span>
      <div class="v19-live-copy"><b id="liveStageV19Title">Etapa atual</b><span id="liveStageV19Sub">Carregando informações…</span></div>
      <span class="v19-live-arrow">›</span>
    </button>`);
    document.getElementById('liveStageV19').addEventListener('click',()=>{
      try{goTo('stageLiveV19')}catch{}
      renderPublicStage();
    });
  }

  function injectPublicScreen(){
    if(document.getElementById('stageLiveV19')) return;
    const main=document.querySelector('main');
    if(!main) return;
    main.insertAdjacentHTML('beforeend',`<section class="screen" id="stageLiveV19">
      <div class="screen-top"><div class="screen-top-inner"><img class="mini-logo" src="assets/plp-logo-v47.png"><div><h2>Etapa atual</h2><p>Inscrições, pagamentos e premiação projetada</p></div><button class="back-home" data-go="home">⌂</button></div></div>
      <div id="stageLiveV19Body"><div class="v19-card"><div class="empty-state">Carregando etapa…</div></div></div>
    </section>`);
  }

  function upgradeVersionLabel(){
    document.querySelectorAll('.muted.small').forEach(el=>{
      if(/Versão\s+\d+.*Temporada\s+2026/i.test(el.textContent||'')) el.textContent='Versão 19 Operacional • Temporada 2026';
    });
  }

  async function loadSnapshot(silent=false){
    if(typeof supa==='undefined' || !supa) return null;
    const {data,error}=await supa.rpc('plp_public_stage_snapshot');
    if(error){
      if(!silent) showToast('Não foi possível atualizar a etapa atual.');
      return null;
    }
    const snapshot=data||{stage:null,entries:[],finalized_jackpot:0};
    V19.snapshot=typeof normalizeStageSnapshot==='function'?normalizeStageSnapshot(snapshot):snapshot;
    renderHomeStage();
    if(document.getElementById('stageLiveV19')?.classList.contains('active')) renderPublicStage();
    if(document.getElementById('gameDay')?.classList.contains('active')) scheduleAdminPatch(60);
    return V19.snapshot;
  }

  function renderHomeStage(){
    const btn=document.getElementById('liveStageV19');
    if(!btn) return;
    const snap=V19.snapshot, s=snap?.stage;
    btn.classList.toggle('show',!!s);
    if(!s) return;
    const entries=snap.entries||[];
    const calc=calcStage(s,entries,snap.finalized_jackpot);
    const host=(s.host_name||calc.host?.name||'A DEFINIR').toUpperCase();
    const phase=s.game_started?'EM TEMPO REAL':s.registration_closed?'INSCRIÇÕES ENCERRADAS':'INSCRIÇÕES ABERTAS';
    const confirmed=entries.filter(e=>e.payment_status==='confirmed').length;
    const informed=entries.filter(e=>e.payment_status==='informed').length;
    document.getElementById('liveStageV19Title').textContent=`${String(s.championship).toUpperCase()} - ETAPA ${s.stage_number} - LOCAL: ${host}`;
    document.getElementById('liveStageV19Sub').textContent=`${phase} • ${entries.length} inscrito${entries.length===1?'':'s'} • ${confirmed} pago${confirmed===1?'':'s'} confirmado${confirmed===1?'':'s'}${informed?` • ${informed} informado${informed===1?'':'s'}`:''} • toque para acompanhar`;
    btn.classList.toggle('game-started',!!s.game_started);
    btn.classList.toggle('registration-closed',!!s.registration_closed && !s.game_started);
    const kicker=document.querySelector('#home .hero-kicker');
    if(kicker) kicker.textContent=`Temporada 2026 • ${String(s.championship).toUpperCase()} • ${phase}`;
  }

  function jackpotDistribution(total){
    if(!total) return '<div class="v19-empty-inline">O valor aparecerá conforme as inscrições forem lançadas.</div>';
    return JACKPOT_SPLIT.map((pct,i)=>`<div class="v19-split-row"><b>${i+1}º</b><span>${pct}%</span><strong>${money(total*pct/100)}</strong></div>`).join('');
  }

  function payoutRows(calc){
    if(calc.field<7) return `<div class="v19-warning">A etapa precisa de no mínimo <b>7 jogadores</b> para ter quórum válido. Faltam ${7-calc.field}.</div>`;
    if(calc.field>22) return '<div class="v19-warning">O regulamento recebido traz a tabela de premiação até 22 jogadores. Para um field maior, a diretoria deverá definir o rateio manualmente.</div>';
    return `<div class="v19-payout-grid">${calc.payout.map((v,i)=>`<div><span>${i+1}º lugar</span><b>${money(v)}</b></div>`).join('')}</div>`;
  }

  function renderPublicStage(){
    const host=document.getElementById('stageLiveV19Body');
    if(!host) return;
    const snap=V19.snapshot, s=snap?.stage;
    if(!s){host.innerHTML='<div class="v19-card"><div class="empty-state">Não há etapa publicada no momento.</div></div>';return}
    const entries=snap.entries||[], calc=calcStage(s,entries,snap.finalized_jackpot);
    const local=s.host_name||calc.host?.name||'A definir';
    const confirmed=entries.filter(e=>e.payment_status==='confirmed').length;
    const informed=entries.filter(e=>e.payment_status==='informed').length;
    const pending=entries.filter(e=>e.payment_status==='pending').length;
    const phase=s.game_started?'JOGO EM ANDAMENTO':s.registration_closed?'INSCRIÇÕES ENCERRADAS':'INSCRIÇÕES ABERTAS';
    const rows=entries.map((e,i)=>`<div class="v19-entry-row">
      <div class="v19-entry-num">${i+1}</div><div class="v19-entry-name"><b>${esc(e.name)}</b><small>${e.is_host?'Anfitrião / local':'Participante'}</small></div>
      <span class="v19-pay ${paymentClass(e.payment_status)}">${paymentText(e.payment_status)}</span>
    </div>`).join('') || '<div class="empty-state">Nenhum inscrito até o momento.</div>';

    const form=(!s.registration_closed && s.status!=='finalized') ? `<div class="v19-card v19-signup-card">
      <h3>Inscrever-se nesta etapa</h3><p>Digite seu nome e informe se já fez o pagamento. Pagamento informado pelo próprio jogador fica pendente de conferência do administrador.</p>
      <div class="v19-signup-grid"><input class="v19-input" id="v19SignupName" maxlength="60" placeholder="Seu nome"><select class="v19-select" id="v19SignupPaid"><option value="0">Ainda não paguei</option><option value="1">Já fiz o pagamento</option></select></div>
      <button class="btn gold v19-full" id="v19SignupButton">Confirmar inscrição</button>
    </div>` : `<div class="v19-card"><div class="v19-warning">As inscrições públicas estão encerradas. O administrador ainda pode incluir um participante atrasado, se necessário.</div></div>`;

    host.innerHTML=`
      <div class="v19-stage-head-card">
        <div class="v19-stage-kicker">${phase}</div>
        <h2>${String(s.championship).toUpperCase()} • ETAPA ${s.stage_number}</h2>
        <div class="v19-location">LOCAL: <b>${esc(local.toUpperCase())}</b></div>
        <div class="v19-stage-date">${fmtDate(s.stage_date)} • Temporada ${s.season||2026}</div>
      </div>
      <div class="v19-metrics">
        <div><span>Inscritos</span><b>${entries.length}</b></div><div><span>Pagos confirmados</span><b>${confirmed}</b></div><div><span>Pagamento informado</span><b>${informed}</b></div><div><span>Pendentes</span><b>${pending}</b></div>
      </div>
      <div class="v19-card"><div class="v19-card-title"><div><h3>Lista atual</h3><p>Atualizada conforme o administrador aplica a lista do WhatsApp ou os jogadores se inscrevem.</p></div><span class="v19-count">${entries.length}</span></div><div class="v19-entry-list">${rows}</div></div>
      ${form}
      <div class="v19-card">
        <div class="v19-card-title"><div><h3>Financeiro projetado da etapa</h3><p>${calc.manual?'Valores em modo manual definido pela administração.':'Cálculo automático: cada pagante = R$ 50 para a etapa + R$ 10 para o Jackpot; anfitrião isento.'}</p></div><span class="v19-mode ${calc.manual?'manual':'auto'}">${calc.manual?'MANUAL':'AUTOMÁTICO'}</span></div>
        <div class="v19-finance-grid"><div><span>Arrecadação</span><b>${money(calc.current.collected)}</b></div><div><span>Premiação da etapa</span><b>${money(calc.current.prizePool)}</b></div><div><span>Jackpot desta etapa</span><b>${money(calc.current.jackpot)}</b></div></div>
        <div class="v19-note">Jackpot pode sofrer alterações até o fechamento das inscrições e conferência dos pagamentos.</div>
      </div>
      <div class="v19-card"><h3>Divisão da premiação da etapa</h3><p>Tabela calculada pela quantidade atual de jogadores, conforme o regulamento.</p>${payoutRows(calc)}</div>
      <div class="v19-card">
        <h3>Jackpot da Libertadores • projeção atual</h3><p>Acumulado das etapas finalizadas + projeção desta etapa.</p>
        <div class="v19-jackpot-total"><span>Jackpot projetado</span><b>${money(calc.projectedJackpot)}</b></div>
        <div class="v19-split-list">${jackpotDistribution(calc.projectedJackpot)}</div>
        <div class="v19-note">Distribuição prevista: 32%, 17%, 13%, 10%, 8%, 7%, 6%, 5% e 2%. Os valores finais podem sofrer alterações porque o regulamento prevê o desconto das despesas do torneio antes da divisão.</div>
      </div>`;

    const signupBtn=document.getElementById('v19SignupButton');
    if(signupBtn) signupBtn.onclick=publicSignup;
  }

  async function publicSignup(){
    const s=V19.snapshot?.stage;
    if(!s) return showToast('Nenhuma etapa disponível.');
    const input=document.getElementById('v19SignupName');
    const name=String(input?.value||'').trim();
    const paid=document.getElementById('v19SignupPaid')?.value==='1';
    if(name.length<2) return showToast('Digite seu nome para se inscrever.');
    const btn=document.getElementById('v19SignupButton');
    if(btn){btn.disabled=true;btn.textContent='Salvando…'}
    const {error}=await supa.rpc('plp_public_signup',{p_stage_id:s.id,p_name:name,p_paid:paid});
    if(btn){btn.disabled=false;btn.textContent='Confirmar inscrição'}
    if(error){showToast(error.message?.includes('encerrad')?'As inscrições foram encerradas.':'Não foi possível concluir a inscrição.');return}
    if(input) input.value='';
    showToast(paid?'Inscrição registrada. Pagamento informado e aguardando conferência.':'Inscrição registrada com sucesso.');
    await loadSnapshot(true);
  }

  function scheduleAdminPatch(ms=120){
    clearTimeout(V19.adminRefresh);
    V19.adminRefresh=setTimeout(()=>augmentGameDay().catch(console.error),ms);
  }

  async function fetchAdminStageData(stageId){
    if(!stageId || typeof isAdmin==='undefined' || !isAdmin) return null;
    const [stageQ,entryQ,playersQ]=await Promise.all([
      supa.from('stages').select('*').eq('id',stageId).maybeSingle(),
      supa.from('stage_entries').select('*').eq('stage_id',stageId).order('list_position'),
      supa.from('players').select('player_key,name').order('name')
    ]);
    if(stageQ.error || !stageQ.data) return null;
    const names=new Map((playersQ.data||[]).map(p=>[p.player_key,normName(p.name)]));
    const entries=(entryQ.data||[]).map(e=>({...e,name:names.get(e.player_key)||e.player_key}));
    return {stage:stageQ.data,entries,players:playersQ.data||[]};
  }

  function patchLegacyGameDayHeader(stage, entries){
    const box=document.getElementById('gdContent');
    if(!box) return;
    const head=box.querySelector('.v18-live-title');
    const host=stage.host_name || entries.find(e=>e.is_host)?.name || 'A DEFINIR';
    if(head){
      const b=head.querySelector('b'); const span=head.querySelector('span:last-child');
      if(b) b.textContent=`${stage.championship.toUpperCase()} • Etapa ${stage.stage_number} • LOCAL: ${host.toUpperCase()}`;
      if(span) span.textContent=stage.game_started?'Jogo em andamento':stage.registration_closed?'Inscrições encerradas':'Inscrições abertas • jogo ainda não iniciado';
    }
    const open=document.getElementById('gdOpenStage');
    const active=V19.snapshot?.stage?.id===stage.id;
    if(open){
      if(active){open.textContent=stage.game_started?'Etapa ativa • jogo em andamento':'Inscrições publicadas na Home';open.disabled=true}
      else if(stage.status==='scheduled'){open.textContent='Abrir inscrições na Home';open.disabled=false}
    }
  }

  function adminEntryRows(data){
    if(!data.entries.length) return '<div class="empty-state">Nenhum participante lançado.</div>';
    return data.entries.map((e,i)=>`<div class="v19-admin-entry" data-v19-player="${esc(e.player_key)}">
      <div class="v19-admin-pos">${i+1}</div><div class="v19-admin-who"><b>${esc(e.name)}</b><small>${e.is_host?'LOCAL / ANFITRIÃO':'Participante'}</small></div>
      <select class="v19-select v19-admin-payment" ${e.is_host?'disabled':''}>
        <option value="pending" ${e.payment_status==='pending'?'selected':''}>Pendente</option>
        <option value="informed" ${e.payment_status==='informed'?'selected':''}>Pagamento informado</option>
        <option value="confirmed" ${e.payment_status==='confirmed'?'selected':''}>Pago confirmado</option>
        <option value="exempt" ${e.payment_status==='exempt'?'selected':''}>Isento</option>
      </select>
      <div class="v19-admin-mini-actions"><button class="v19-mini-btn v19-host-btn" ${e.is_host?'disabled':''}>Definir local</button><button class="v19-mini-btn danger v19-remove-btn">Remover</button></div>
    </div>`).join('');
  }

  async function augmentGameDay(){
    if(V19.renderingAdmin) return;
    const content=document.getElementById('gdContent');
    if(!content || !document.getElementById('gameDay')?.classList.contains('active')) return;
    if(typeof isAdmin==='undefined' || !isAdmin) return;
    const stageId=window.PLP_V18?.selectedStageId || V19.snapshot?.stage?.id;
    if(!stageId) return;
    V19.renderingAdmin=true;
    try{
      const data=await fetchAdminStageData(stageId);
      if(!data) return;
      patchLegacyGameDayHeader(data.stage,data.entries);
      const old=document.getElementById('v19AdminRegistrations'); if(old) old.remove();
      const calc=calcStage(data.stage,data.entries,V19.snapshot?.finalized_jackpot||0);
      const host=data.stage.host_name || data.entries.find(e=>e.is_host)?.name || 'A definir';
      const phase=data.stage.game_started?'JOGO EM ANDAMENTO':data.stage.registration_closed?'INSCRIÇÕES ENCERRADAS':'INSCRIÇÕES ABERTAS';
      const panel=document.createElement('div');
      panel.id='v19AdminRegistrations';
      panel.innerHTML=`<div class="v19-card v19-admin-card">
        <div class="v19-card-title"><div><h3>Inscrições da etapa</h3><p>${data.stage.championship.toUpperCase()} • Etapa ${data.stage.stage_number} • Local: <b>${esc(host)}</b></p></div><span class="v19-phase">${phase}</span></div>
        <div class="v19-admin-summary"><div><span>Inscritos</span><b>${data.entries.length}</b></div><div><span>Pagantes</span><b>${calc.payers}</b></div><div><span>Premiação</span><b>${money(calc.current.prizePool)}</b></div><div><span>Jackpot etapa</span><b>${money(calc.current.jackpot)}</b></div></div>
        <div class="v19-actions-row"><button class="btn ghost" id="v19ToggleRegistrations">${data.stage.registration_closed?'Reabrir inscrições':'Fechar inscrições'}</button><button class="btn gold" id="v19StartGame" ${data.stage.game_started?'disabled':''}>${data.stage.game_started?'Jogo já iniciado':'Iniciar jogo agora'}</button></div>
        <div class="v19-admin-add"><h4>Adicionar participante</h4><div class="v19-admin-add-grid"><input class="v19-input" id="v19AdminName" placeholder="Nome"><select class="v19-select" id="v19AdminPayment"><option value="pending">Pendente</option><option value="informed">Pagamento informado</option><option value="confirmed">Pago confirmado</option></select></div><label class="v19-check"><input type="checkbox" id="v19AdminHost" ${data.entries.length===0?'checked':''}> Este jogador é o anfitrião / local (isento)</label><button class="btn gold v19-full" id="v19AdminAdd">Adicionar à etapa</button></div>
        <div class="v19-admin-list">${adminEntryRows(data)}</div>
      </div>
      <div class="v19-card v19-admin-finance">
        <div class="v19-card-title"><div><h3>Cálculo financeiro</h3><p>Modo atual: <b>${data.stage.financial_mode==='manual'?'manual':'automático pelo regulamento'}</b>. Adições e remoções recalculam a sugestão automaticamente.</p></div><span class="v19-mode ${data.stage.financial_mode==='manual'?'manual':'auto'}">${data.stage.financial_mode==='manual'?'MANUAL':'AUTO'}</span></div>
        <div class="v19-payout-preview">${payoutRows(calc)}</div>
        <div class="v19-actions-row"><button class="btn ghost" id="v19AutoFinance">Usar cálculo automático</button><button class="btn gold" id="v19ManualFinance">Salvar valores manuais acima</button></div>
        <div class="v19-note">“Valores manuais acima” usa os campos Arrecadação, Jackpot e Premiação já existentes na tela. Você pode voltar ao automático a qualquer momento antes do fechamento.</div>
      </div>`;
      content.prepend(panel);
      bindAdminPanel(data,calc);
      applyFinanceInputs(data.stage,calc);
    }finally{
      V19.renderingAdmin=false;
    }
  }

  function applyFinanceInputs(stage,calc){
    const c=document.getElementById('gdCollected'),j=document.getElementById('gdJackpot'),p=document.getElementById('gdPrizePool');
    if(!c||!j||!p) return;
    if(stage.financial_mode==='manual'){
      c.value=stage.collected_amount ?? calc.automatic.collected;
      j.value=stage.jackpot_amount ?? calc.automatic.jackpot;
      p.value=stage.prize_pool ?? calc.automatic.prizePool;
    }else{
      c.value=calc.automatic.collected;j.value=calc.automatic.jackpot;p.value=calc.automatic.prizePool;
    }
    const old=document.getElementById('applySuggestionV18');
    if(old){old.textContent='Recalcular pelo regulamento';old.onclick=()=>{c.value=calc.automatic.collected;j.value=calc.automatic.jackpot;p.value=calc.automatic.prizePool;showToast('Valores recalculados conforme o regulamento.')}}
  }

  function bindAdminPanel(data,calc){
    const stage=data.stage;
    document.getElementById('v19ToggleRegistrations').onclick=async()=>{
      const next=!stage.registration_closed;
      const q=await supa.from('stages').update({registration_closed:next,updated_at:new Date().toISOString()}).eq('id',stage.id);
      if(q.error) return showToast('Não foi possível alterar as inscrições.');
      showToast(next?'Inscrições públicas encerradas.':'Inscrições públicas reabertas.');
      await refreshAfterAdmin(stage.id);
    };
    document.getElementById('v19StartGame').onclick=async()=>{
      const q=await supa.from('stages').update({game_started:true,opened_at:stage.opened_at||new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',stage.id);
      if(q.error) return showToast('Não foi possível iniciar o jogo.');
      showToast('Jogo iniciado. A Home agora mostra “em tempo real”.');
      await refreshAfterAdmin(stage.id);
    };
    document.getElementById('v19AdminAdd').onclick=()=>adminAddEntry(stage.id);
    document.querySelectorAll('#v19AdminRegistrations .v19-admin-entry').forEach(row=>{
      const key=row.dataset.v19Player;
      const sel=row.querySelector('.v19-admin-payment');
      if(sel) sel.onchange=()=>adminChangePayment(stage.id,key,sel.value);
      const hostBtn=row.querySelector('.v19-host-btn'); if(hostBtn) hostBtn.onclick=()=>adminSetHost(stage.id,key);
      const remove=row.querySelector('.v19-remove-btn'); if(remove) remove.onclick=()=>adminRemoveEntry(stage.id,key);
    });
    document.getElementById('v19AutoFinance').onclick=async()=>{
      const q=await supa.from('stages').update({financial_mode:'auto',collected_amount:null,jackpot_amount:null,prize_pool:null,updated_at:new Date().toISOString()}).eq('id',stage.id);
      if(q.error) return showToast('Não foi possível voltar ao cálculo automático.');
      showToast('Cálculo automático reativado.');
      await refreshAfterAdmin(stage.id);
    };
    document.getElementById('v19ManualFinance').onclick=async()=>{
      const col=Number(document.getElementById('gdCollected')?.value)||0;
      const jack=Number(document.getElementById('gdJackpot')?.value)||0;
      const prize=Number(document.getElementById('gdPrizePool')?.value)||0;
      const q=await supa.from('stages').update({financial_mode:'manual',collected_amount:col,jackpot_amount:jack,prize_pool:prize,updated_at:new Date().toISOString()}).eq('id',stage.id);
      if(q.error) return showToast('Não foi possível salvar os valores manuais.');
      showToast('Valores manuais salvos para esta etapa.');
      await refreshAfterAdmin(stage.id);
    };
  }

  async function ensureAdminPlayer(name){
    const normalized=normName(name);
    const key=playerKey(normalized);
    const q=await supa.from('players').upsert({player_key:key,name:normalized,active:true},{onConflict:'player_key'});
    if(q.error) throw q.error;
    return {key,name:normalized};
  }

  async function adminAddEntry(stageId){
    const input=document.getElementById('v19AdminName');
    const name=String(input?.value||'').trim();
    if(name.length<2) return showToast('Digite o nome do participante.');
    const isHost=!!document.getElementById('v19AdminHost')?.checked;
    let payment=document.getElementById('v19AdminPayment')?.value||'pending';
    try{
      const player=await ensureAdminPlayer(name);
      const current=await supa.from('stage_entries').select('list_position').eq('stage_id',stageId).order('list_position',{ascending:false}).limit(1);
      const next=(Number(current.data?.[0]?.list_position)||0)+1;
      if(isHost){
        await supa.from('stage_entries').update({is_host:false,payment_status:'pending',amount_paid:null,updated_at:new Date().toISOString()}).eq('stage_id',stageId).eq('is_host',true);
        payment='exempt';
      }
      const row={stage_id:stageId,player_key:player.key,list_position:next,payment_status:payment,attendance_status:'unchecked',amount_paid:payment==='confirmed'?60:null,is_host:isHost,source:'admin',updated_at:new Date().toISOString()};
      const q=await supa.from('stage_entries').upsert(row,{onConflict:'stage_id,player_key'});
      if(q.error) throw q.error;
      const stageUpdate={updated_at:new Date().toISOString()}; if(isHost) stageUpdate.host_name=player.name;
      await supa.from('stages').update(stageUpdate).eq('id',stageId);
      if(input) input.value='';
      showToast(`${player.name} adicionado à etapa.`);
      await refreshAfterAdmin(stageId);
    }catch(e){console.error(e);showToast('Não foi possível adicionar o participante.')}
  }

  async function adminChangePayment(stageId,key,status){
    const amount=status==='confirmed'?60:null;
    const q=await supa.from('stage_entries').update({payment_status:status,amount_paid:amount,updated_at:new Date().toISOString()}).eq('stage_id',stageId).eq('player_key',key);
    if(q.error) return showToast('Não foi possível alterar o pagamento.');
    await supa.from('stages').update({updated_at:new Date().toISOString()}).eq('id',stageId);
    showToast('Pagamento atualizado.');
    await refreshAfterAdmin(stageId);
  }

  async function adminSetHost(stageId,key){
    const players=await supa.from('players').select('player_key,name').eq('player_key',key).maybeSingle();
    if(players.error||!players.data) return showToast('Jogador não encontrado.');
    await supa.from('stage_entries').update({is_host:false,payment_status:'pending',amount_paid:null,updated_at:new Date().toISOString()}).eq('stage_id',stageId).eq('is_host',true);
    const q=await supa.from('stage_entries').update({is_host:true,payment_status:'exempt',amount_paid:null,updated_at:new Date().toISOString()}).eq('stage_id',stageId).eq('player_key',key);
    if(q.error) return showToast('Não foi possível definir o local.');
    await supa.from('stages').update({host_name:players.data.name,updated_at:new Date().toISOString()}).eq('id',stageId);
    showToast(`${players.data.name} definido como anfitrião e isento.`);
    await refreshAfterAdmin(stageId);
  }

  async function adminRemoveEntry(stageId,key){
    const row=await supa.from('stage_entries').select('is_host').eq('stage_id',stageId).eq('player_key',key).maybeSingle();
    const q=await supa.from('stage_entries').delete().eq('stage_id',stageId).eq('player_key',key);
    if(q.error) return showToast('Não foi possível remover o participante.');
    const upd={updated_at:new Date().toISOString()}; if(row.data?.is_host) upd.host_name=null;
    await supa.from('stages').update(upd).eq('id',stageId);
    showToast('Participante removido. Valores recalculados.');
    await refreshAfterAdmin(stageId);
  }

  async function refreshAfterAdmin(stageId){
    await loadSnapshot(true);
    window.PLP_V18.selectedStageId=stageId;
    scheduleAdminPatch(80);
  }

  function patchImporter(){
    const out=document.getElementById('signupOutput');
    if(!out) return;
    const legacy=document.getElementById('saveSignupState');
    if(legacy){
      legacy.id='saveSignupStateLocalV19';
      legacy.textContent='Salvar rascunho neste aparelho';
    }
    if(!out.children.length || document.getElementById('v19WhatsappApply')) return;
    const target=document.getElementById('saveSignupStateLocalV19') || out.lastElementChild;
    if(!target) return;
    target.insertAdjacentHTML('afterend',`<div class="v19-whatsapp-apply" id="v19WhatsappApply">
      <b>Aplicar no acompanhamento público</b><span>Você pode aplicar somente os selecionados e completar a lista depois. O primeiro nome da lista é sempre tratado como anfitrião/local e fica isento.</span>
      <div class="v19-actions-row"><button class="btn ghost" id="v19ApplySelectedSignup">Aplicar selecionados</button><button class="btn gold" id="v19ApplyAllSignup">Aplicar lista completa</button></div>
    </div>`);
    document.getElementById('v19ApplySelectedSignup').onclick=()=>applyWhatsapp(false);
    document.getElementById('v19ApplyAllSignup').onclick=()=>applyWhatsapp(true);
  }

  async function applyWhatsapp(all){
    if(typeof isAdmin==='undefined' || !isAdmin) return showToast('Apenas administradores podem aplicar a lista.');
    if(typeof signupParsed==='undefined' || !Array.isArray(signupParsed) || !signupParsed.length) return showToast('Interprete uma lista antes de aplicar.');
    const br=signupMeta?.br?`br${signupMeta.br}`:null;
    const n=Number(signupMeta?.stage||0);
    if(!br||!n) return showToast('Não consegui identificar BR e etapa na mensagem.');
    const stq=await supa.from('stages').select('*').eq('season',2026).eq('championship',br).eq('stage_number',n).maybeSingle();
    if(stq.error||!stq.data) return showToast('Etapa não encontrada no calendário.');
    const stage=stq.data;
    let indices=all?signupParsed.map((_,i)=>i):Array.from(signupSelected||[]).sort((a,b)=>a-b);
    if(!all && !indices.length) return showToast('Selecione pelo menos um jogador para aplicar.');
    if(!indices.includes(0)) indices.unshift(0);
    indices=[...new Set(indices)].filter(i=>signupParsed[i]);
    const hostPlayer=signupParsed[0];
    try{
      await supa.from('stage_entries').update({is_host:false,payment_status:'pending',amount_paid:null,updated_at:new Date().toISOString()}).eq('stage_id',stage.id).eq('is_host',true);
      const payload=[];
      for(const i of indices){
        const p=signupParsed[i];
        const player=await ensureAdminPlayer(p.name);
        const isHost=i===0;
        const pm={informado:'informed',conferido:'confirmed',pendente:'pending',isento:'exempt'};
        const attendance={presente:'present',faltou:'absent',nao_conferido:'unchecked'};
        let status=isHost?'exempt':(pm[p.payment]||'pending');
        payload.push({stage_id:stage.id,player_key:player.key,list_position:Number(p.n)||i+1,payment_status:status,attendance_status:attendance[p.presence]||'unchecked',amount_paid:status==='confirmed'?Number(stage.buy_in||60):null,is_host:isHost,source:'whatsapp',updated_at:new Date().toISOString()});
      }
      const q=await supa.from('stage_entries').upsert(payload,{onConflict:'stage_id,player_key'});
      if(q.error) throw q.error;
      await supa.from('stages').update({host_name:normName(hostPlayer.name),updated_at:new Date().toISOString()}).eq('id',stage.id);
      showToast(`${indices.length} nome${indices.length===1?'':'s'} aplicado${indices.length===1?'':'s'}. ${normName(hostPlayer.name)} definido como local e isento.`);
      if(window.PLP_V18) window.PLP_V18.selectedStageId=stage.id;
      await loadSnapshot(true);
      if(document.getElementById('gameDay')?.classList.contains('active')) scheduleAdminPatch(80);
    }catch(e){console.error(e);showToast('Não foi possível aplicar a lista no banco.')}
  }

  function observeUi(){
    const obs=new MutationObserver(()=>{
      clearTimeout(V19.patchTimer);
      V19.patchTimer=setTimeout(()=>{
        patchImporter();
        upgradeVersionLabel();
        if(document.getElementById('gameDay')?.classList.contains('active') && !document.getElementById('v19AdminRegistrations')) scheduleAdminPatch(50);
      },30);
    });
    obs.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{
      const g=e.target.closest('[data-go]');
      if(g?.dataset.go==='gameDay') scheduleAdminPatch(160);
      if(g?.dataset.go==='home') setTimeout(renderHomeStage,30);
    });
  }

  async function init(){
    loadCss();injectHomeCard();injectPublicScreen();upgradeVersionLabel();observeUi();patchImporter();
    const ok=await waitForBackend();
    if(!ok){V19.ready=true;return}
    await loadSnapshot(true);
    V19.poll=setInterval(()=>loadSnapshot(true),6000);
    V19.ready=true;
  }

  init();
})();
