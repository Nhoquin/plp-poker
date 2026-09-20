/* PLP V25 • controle de eliminações e classificação ao vivo */
(() => {
  'use strict';

  const V25 = {
    busy:false,
    adminData:null,
    publicSnapshot:null,
    lastAdminStageId:null,
    timer:null,
    publicPollAt:0,
    adminPollAt:0
  };
  window.PLP_V25 = V25;

  const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function toast(message){
    try{
      if(typeof showToast === 'function') return showToast(message);
    }catch(_){ }
    console.log('[PLP V25]', message);
  }

  function backendReady(){
    try{
      return typeof supa !== 'undefined' && !!supa;
    }catch(_){
      return false;
    }
  }

  function adminReady(){
    try{
      return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin;
    }catch(_){
      return false;
    }
  }

  function currentAdminStageId(){
    return window.PLP_V18?.selectedStageId || window.PLP_V19?.snapshot?.stage?.id || null;
  }

  function injectStyles(){
    if(document.getElementById('plpV25EliminationStyles')) return;
    const style=document.createElement('style');
    style.id='plpV25EliminationStyles';
    style.textContent=`
      .v25-card{margin:12px 0;padding:14px;border-radius:20px;border:1px solid rgba(244,201,20,.22);background:linear-gradient(145deg,rgba(20,18,13,.88),rgba(8,8,7,.95));box-shadow:0 16px 34px rgba(0,0,0,.24)}
      .v25-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.v25-head h3{margin:0;font-size:16px}.v25-head p{margin:4px 0 0;color:#c5bcaa;font-size:11px;line-height:1.45}
      .v25-live-badge{white-space:nowrap;padding:7px 10px;border-radius:999px;border:1px solid rgba(123,230,179,.35);background:rgba(123,230,179,.10);color:#7be6b3;font-size:9px;font-weight:900;letter-spacing:.8px}
      .v25-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.v25-summary>div{padding:10px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.v25-summary span{display:block;color:#c5bcaa;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.v25-summary b{display:block;margin-top:5px;color:#ffe36a;font-size:18px}
      .v25-block{margin-top:12px}.v25-block-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.v25-block-title b{font-size:12px}.v25-block-title span{color:#c5bcaa;font-size:10px}
      .v25-player-list{display:grid;gap:7px}.v25-player-row{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;padding:9px 10px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075)}
      .v25-pos{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#222019;color:#ffe36a;font-size:11px;font-weight:900}.v25-pos.active{color:#7be6b3}.v25-player-name b{display:block;font-size:12px}.v25-player-name small{display:block;margin-top:2px;color:#c5bcaa;font-size:9px}
      .v25-eliminate{border:1px solid rgba(255,158,158,.42);background:rgba(255,90,90,.10);color:#ffc3c3;border-radius:11px;padding:8px 10px;font-size:10px;font-weight:850}.v25-eliminate:disabled{opacity:.42;cursor:not-allowed}
      .v25-undo{width:100%;margin-top:9px;border:1px solid rgba(244,201,20,.30);background:rgba(244,201,20,.08);color:#ffe36a;border-radius:12px;padding:9px 11px;font-size:10px;font-weight:850}
      .v25-note{padding:11px 12px;border-radius:14px;background:rgba(244,201,20,.07);border:1px solid rgba(244,201,20,.18);color:#eadfae;font-size:10px;line-height:1.45}.v25-note strong{color:#ffe36a}
      .v25-lock{margin-top:10px;padding:9px 10px;border-radius:12px;background:rgba(255,158,158,.07);border:1px solid rgba(255,158,158,.18);color:#f4c9c9;font-size:9px;line-height:1.45}
      .v25-public-card{margin:12px 0;padding:14px;border-radius:20px;border:1px solid rgba(244,201,20,.22);background:linear-gradient(145deg,rgba(18,16,11,.90),rgba(7,7,6,.96))}.v25-public-card h3{margin:0}.v25-public-card>p{margin:4px 0 12px;color:#c5bcaa;font-size:11px}
      .v25-public-active{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.v25-chip{padding:7px 9px;border-radius:999px;border:1px solid rgba(123,230,179,.22);background:rgba(123,230,179,.07);color:#d8fff0;font-size:10px;font-weight:750}.v25-chip.winner{border-color:rgba(244,201,20,.38);background:rgba(244,201,20,.09);color:#ffe36a}
      .v25-public-standing{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:9px;padding:9px 0;border-top:1px solid rgba(255,255,255,.07)}.v25-public-standing:first-child{border-top:0}.v25-public-standing .place{color:#ffe36a;font-weight:900}.v25-public-standing .state{font-size:9px;color:#c5bcaa}
      .v25-copy{width:100%;margin-top:11px;border:1px solid rgba(244,201,20,.28);background:linear-gradient(145deg,rgba(244,201,20,.14),rgba(244,201,20,.05));color:#ffe36a;border-radius:12px;padding:10px;font-size:10px;font-weight:900}
      @media(max-width:520px){.v25-summary{grid-template-columns:1fr 1fr 1fr}.v25-summary b{font-size:15px}.v25-player-row{grid-template-columns:38px 1fr auto}.v25-pos{width:34px;height:34px}.v25-eliminate{padding:8px 8px}}
    `;
    document.head.appendChild(style);
  }

  function splitEntries(entries){
    const all=Array.isArray(entries)?entries:[];
    const active=all.filter(entry=>!entry.eliminated_at && !entry.elimination_order)
      .sort((a,b)=>(Number(a.list_position)||9999)-(Number(b.list_position)||9999) || String(a.name||'').localeCompare(String(b.name||'')));
    const eliminated=all.filter(entry=>entry.eliminated_at || entry.elimination_order)
      .sort((a,b)=>(Number(a.finish_position)||9999)-(Number(b.finish_position)||9999));
    const latest=[...eliminated].sort((a,b)=>(Number(b.elimination_order)||0)-(Number(a.elimination_order)||0))[0]||null;
    return {active,eliminated,latest};
  }

  async function fetchAdminData(stageId){
    if(!stageId || !adminReady()) return null;
    const [stageQ,entryQ,playersQ]=await Promise.all([
      supa.from('stages').select('*').eq('id',stageId).maybeSingle(),
      supa.from('stage_entries').select('*').eq('stage_id',stageId).order('list_position'),
      supa.from('players').select('player_key,name').order('name')
    ]);
    if(stageQ.error || !stageQ.data || entryQ.error) return null;
    const names=new Map((playersQ.data||[]).map(player=>[player.player_key,typeof normalizePlayerName==='function'?normalizePlayerName(String(player.name||'')):player.name]));
    const entries=(entryQ.data||[]).map(entry=>({...entry,name:names.get(entry.player_key)||entry.player_key}));
    return {stage:stageQ.data,entries};
  }

  async function refreshPublicSnapshot(force=false){
    if(!backendReady()) return null;
    const now=Date.now();
    if(!force && now-V25.publicPollAt<2200) return V25.publicSnapshot;
    V25.publicPollAt=now;
    const {data,error}=await supa.rpc('plp_public_stage_snapshot');
    if(error) return V25.publicSnapshot;
    const snapshot=data||{stage:null,entries:[],finalized_jackpot:0};
    V25.publicSnapshot=typeof normalizeStageSnapshot==='function'?normalizeStageSnapshot(snapshot):snapshot;
    if(window.PLP_V19) window.PLP_V19.snapshot=V25.publicSnapshot;
    return V25.publicSnapshot;
  }

  function applyLegacyLocks(data, split){
    const toggle=document.getElementById('v19ToggleRegistrations');
    if(toggle && data.stage.game_started){
      toggle.disabled=true;
      toggle.textContent='Inscrições encerradas após o início';
      toggle.title='Após iniciar o jogo, inscrições públicas ficam encerradas.';
    }

    const locked=split.eliminated.length>0;
    ['v19AdminName','v19AdminPayment','v19AdminHost','v19AdminAdd'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        el.disabled=locked;
        if(locked) el.title='A ordem de eliminações já começou. Desfaça as eliminações antes de alterar o field.';
      }
    });
    document.querySelectorAll('#v19AdminRegistrations .v19-remove-btn').forEach(btn=>{
      btn.disabled=locked;
      if(locked) btn.title='Remoção bloqueada para preservar a classificação já registrada.';
    });
  }

  function renderAdminPanel(data){
    const content=document.getElementById('gdContent');
    if(!content || !document.getElementById('gameDay')?.classList.contains('active') || !adminReady()) return;
    document.getElementById('v25EliminationAdmin')?.remove();

    const split=splitEntries(data.entries);
    applyLegacyLocks(data,split);

    const panel=document.createElement('div');
    panel.id='v25EliminationAdmin';
    panel.className='v25-card';

    if(!data.stage.game_started){
      panel.innerHTML=`<div class="v25-head"><div><h3>Controle de eliminações</h3><p>A classificação será registrada automaticamente conforme os jogadores forem saindo.</p></div><span class="v25-live-badge">PRONTO</span></div><div class="v25-note">Inicie o jogo para liberar os botões de eliminação. Com <strong>${data.entries.length} jogadores</strong>, o primeiro eliminado será registrado em <strong>${data.entries.length}º lugar</strong>.</div>`;
      const anchor=document.getElementById('v19AdminRegistrations');
      if(anchor) anchor.insertAdjacentElement('afterend',panel); else content.prepend(panel);
      return;
    }

    const nextPosition=split.active.length>1?split.active.length:1;
    const activeRows=split.active.map(entry=>{
      const lastOne=split.active.length===1;
      return `<div class="v25-player-row" data-v25-active="${esc(entry.player_key)}"><div class="v25-pos active">${lastOne?'1º':'●'}</div><div class="v25-player-name"><b>${esc(entry.name)}</b><small>${lastOne?'1º lugar provisório • último jogador em jogo':'Ainda em jogo'}</small></div>${lastOne?'<span class="v25-live-badge">1º PROVISÓRIO</span>':`<button class="v25-eliminate" type="button" data-v25-eliminate="${esc(entry.player_key)}" data-v25-name="${esc(entry.name)}">Eliminar → ${nextPosition}º</button>`}</div>`;
    }).join('') || '<div class="v25-note">Nenhum jogador ativo.</div>';

    const eliminatedRows=split.eliminated.map(entry=>`<div class="v25-player-row"><div class="v25-pos">${Number(entry.finish_position)||'—'}º</div><div class="v25-player-name"><b>${esc(entry.name)}</b><small>${Number(entry.elimination_order)||'—'}ª eliminação registrada</small></div><span class="v25-live-badge">ELIMINADO</span></div>`).join('') || '<div class="v25-note">Nenhuma eliminação registrada ainda.</div>';

    const complete=split.active.length===1 && data.entries.length>1;
    panel.innerHTML=`
      <div class="v25-head"><div><h3>Controle de eliminações</h3><p>Toque em “Eliminar” conforme cada jogador sair. A posição fica gravada no banco.</p></div><span class="v25-live-badge">AO VIVO</span></div>
      <div class="v25-summary"><div><span>Em jogo</span><b>${split.active.length}</b></div><div><span>Eliminados</span><b>${split.eliminated.length}</b></div><div><span>Próxima posição</span><b>${split.active.length>1?nextPosition+'º':'1º'}</b></div></div>
      <div class="v25-block"><div class="v25-block-title"><b>Jogadores ainda em jogo</b><span>${split.active.length}</span></div><div class="v25-player-list">${activeRows}</div></div>
      <div class="v25-block"><div class="v25-block-title"><b>Classificação provisória registrada</b><span>${split.eliminated.length} posição(ões)</span></div><div class="v25-player-list">${eliminatedRows}</div>${split.latest?`<button class="v25-undo" type="button" data-v25-undo="${esc(split.latest.player_key)}" data-v25-name="${esc(split.latest.name)}">↶ Desfazer última eliminação: ${esc(split.latest.name)}</button>`:''}</div>
      ${split.eliminated.length?'<div class="v25-lock">Para não perder a ordem da classificação, inclusão e remoção comum de participantes ficam bloqueadas depois da primeira eliminação. O botão “Desfazer última eliminação” corrige um toque acidental.</div>':''}
      ${complete?'<button class="v25-copy" type="button" id="v25CopyClassification">Copiar classificação completa</button>':''}
    `;

    const anchor=document.getElementById('v19AdminRegistrations');
    if(anchor) anchor.insertAdjacentElement('afterend',panel); else content.prepend(panel);

    panel.querySelectorAll('[data-v25-eliminate]').forEach(btn=>{
      btn.addEventListener('click',()=>eliminatePlayer(data,btn.dataset.v25Eliminate,btn.dataset.v25Name));
    });
    const undo=panel.querySelector('[data-v25-undo]');
    if(undo) undo.addEventListener('click',()=>restoreLast(data,undo.dataset.v25Undo,undo.dataset.v25Name));
    const copy=panel.querySelector('#v25CopyClassification');
    if(copy) copy.addEventListener('click',()=>copyClassification(data));
  }

  async function eliminatePlayer(data,playerKey,name){
    if(V25.busy) return;
    const split=splitEntries(data.entries);
    if(split.active.length<=1) return toast('O último jogador restante já ocupa o 1º lugar provisório.');
    const position=split.active.length;
    if(!window.confirm(`Eliminar ${name} agora?\n\nEle será registrado em ${position}º lugar.`)) return;
    V25.busy=true;
    try{
      const {data:result,error}=await supa.rpc('plp_admin_eliminate_player',{p_stage_id:data.stage.id,p_player_key:playerKey});
      if(error) throw error;
      toast(`${result?.name||name} registrado em ${result?.finish_position||position}º lugar.`);
      await refreshEverything(data.stage.id);
    }catch(error){
      console.error(error);
      toast(cleanError(error,'Não foi possível registrar a eliminação.'));
    }finally{
      V25.busy=false;
    }
  }

  async function restoreLast(data,playerKey,name){
    if(V25.busy) return;
    if(!window.confirm(`Desfazer a última eliminação de ${name}?`)) return;
    V25.busy=true;
    try{
      const {error}=await supa.rpc('plp_admin_restore_last_elimination',{p_stage_id:data.stage.id,p_player_key:playerKey});
      if(error) throw error;
      toast(`${name} voltou para a lista de jogadores em jogo.`);
      await refreshEverything(data.stage.id);
    }catch(error){
      console.error(error);
      toast(cleanError(error,'Não foi possível desfazer a eliminação.'));
    }finally{
      V25.busy=false;
    }
  }

  function cleanError(error,fallback){
    const msg=String(error?.message||'').replace(/^.*?P0001:?\s*/i,'').trim();
    if(/Acesso administrativo/i.test(msg)) return 'Acesso administrativo necessário.';
    if(/Inicie o jogo/i.test(msg)) return 'Inicie o jogo antes de registrar eliminações.';
    if(/último jogador/i.test(msg)) return 'O último jogador restante ocupa o 1º lugar provisório.';
    if(/Só é possível desfazer/i.test(msg)) return 'Só é possível desfazer a eliminação mais recente.';
    return msg && msg.length<150 ? msg : fallback;
  }

  function classificationRows(entries){
    const split=splitEntries(entries);
    const rows=[];
    if(split.active.length===1) rows.push({position:1,name:split.active[0].name,state:'Último jogador em jogo'});
    split.eliminated.forEach(entry=>rows.push({position:Number(entry.finish_position)||999,name:entry.name,state:'Eliminado'}));
    return rows.sort((a,b)=>a.position-b.position);
  }

  async function copyClassification(data){
    const rows=classificationRows(data.entries);
    if(!rows.length || splitEntries(data.entries).active.length!==1) return toast('A classificação completa ainda não foi definida.');
    const text=rows.map(row=>`${row.position}º - ${row.name}`).join('\n');
    try{
      await navigator.clipboard.writeText(text);
      toast('Classificação completa copiada.');
    }catch(_){
      const area=document.createElement('textarea');
      area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
      try{document.execCommand('copy');toast('Classificação completa copiada.')}catch(__){toast('Não foi possível copiar automaticamente.');}
      area.remove();
    }
  }

  function renderPublicPanel(snapshot){
    const body=document.getElementById('stageLiveV19Body');
    const screen=document.getElementById('stageLiveV19');
    if(!body || !screen?.classList.contains('active')) return;
    document.getElementById('v25PublicStandings')?.remove();
    const stage=snapshot?.stage;
    if(!stage?.game_started) return;

    body.querySelector('.v19-signup-card')?.remove();
    const split=splitEntries(snapshot.entries||[]);
    const nextPosition=split.active.length>1?split.active.length:1;
    const activeChips=split.active.map(entry=>`<span class="v25-chip ${split.active.length===1?'winner':''}">${split.active.length===1?'1º • ':''}${esc(entry.name)}</span>`).join('');
    const standings=classificationRows(snapshot.entries||[]);
    const standingHtml=standings.map(row=>`<div class="v25-public-standing"><div class="place">${row.position}º</div><b>${esc(row.name)}</b><span class="state">${esc(row.state)}</span></div>`).join('');

    const panel=document.createElement('div');
    panel.id='v25PublicStandings';
    panel.className='v25-public-card';
    panel.innerHTML=`<div class="v25-head"><div><h3>Classificação ao vivo</h3><p>A ordem é atualizada conforme o administrador registra cada eliminação.</p></div><span class="v25-live-badge">AO VIVO</span></div>
      <div class="v25-summary"><div><span>Em jogo</span><b>${split.active.length}</b></div><div><span>Eliminados</span><b>${split.eliminated.length}</b></div><div><span>Próxima posição</span><b>${split.active.length>1?nextPosition+'º':'1º'}</b></div></div>
      <div class="v25-block"><div class="v25-block-title"><b>Ainda em jogo</b><span>${split.active.length}</span></div><div class="v25-public-active">${activeChips||'<span class="v25-chip">Aguardando atualização</span>'}</div></div>
      <div class="v25-block"><div class="v25-block-title"><b>Posições já definidas</b><span>${standings.length}</span></div>${standingHtml||'<div class="v25-note">Nenhuma posição definida ainda. O primeiro eliminado ficará na última colocação do field.</div>'}</div>`;

    const metrics=body.querySelector('.v19-metrics');
    if(metrics) metrics.insertAdjacentElement('afterend',panel); else body.prepend(panel);
  }

  async function refreshEverything(stageId){
    const [adminData,snapshot]=await Promise.all([fetchAdminData(stageId),refreshPublicSnapshot(true)]);
    if(adminData){V25.adminData=adminData;V25.lastAdminStageId=stageId;renderAdminPanel(adminData);}
    if(snapshot) renderPublicPanel(snapshot);
  }

  async function adminTick(){
    if(!adminReady() || !document.getElementById('gameDay')?.classList.contains('active')) return;
    const stageId=currentAdminStageId();
    if(!stageId) return;
    const now=Date.now();
    if(now-V25.adminPollAt<2200) return;
    V25.adminPollAt=now;
    const data=await fetchAdminData(stageId);
    if(data){V25.adminData=data;V25.lastAdminStageId=stageId;renderAdminPanel(data);}
  }

  async function publicTick(){
    if(!document.getElementById('stageLiveV19')?.classList.contains('active')) return;
    const snapshot=await refreshPublicSnapshot(false) || window.PLP_V19?.snapshot;
    if(snapshot) renderPublicPanel(snapshot);
  }

  async function init(){
    injectStyles();
    for(let i=0;i<100;i++){
      if(backendReady() && window.PLP_V19) break;
      await sleep(100);
    }
    if(backendReady()) await refreshPublicSnapshot(true);
    V25.timer=setInterval(()=>{
      adminTick().catch(console.error);
      publicTick().catch(console.error);
    },900);
    document.addEventListener('click',event=>{
      const nav=event.target.closest('[data-go]')?.dataset.go;
      if(nav==='gameDay') setTimeout(()=>adminTick().catch(console.error),180);
      if(nav==='stageLiveV19') setTimeout(()=>publicTick().catch(console.error),180);
    });
  }

  init();
})();
