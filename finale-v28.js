/* PLP V28 • fechamento automático, campeão, compartilhamento e edição pós-finalização */
(() => {
  'use strict';

  const V28 = {
    busy:false,
    timer:null,
    lastSnapshotRefresh:0,
    lastAdminFetch:0,
    adminData:null,
    celebratedStageId:null
  };
  window.PLP_V28 = V28;

  const REGULATION_PRIZES = {
    7:[150,90,60], 8:[170,105,75], 9:[190,120,90], 10:[210,135,105],
    11:[210,135,105,50], 12:[225,150,115,60], 13:[240,165,125,70], 14:[255,180,135,80],
    15:[270,195,145,90], 16:[285,210,155,100], 17:[285,210,155,100,50], 18:[295,220,165,110,60],
    19:[305,230,175,120,70], 20:[315,240,185,130,80], 21:[325,250,195,140,90], 22:[335,260,205,150,100]
  };

  const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function toast(message){
    try{ if(typeof showToast === 'function') return showToast(message); }catch(_){ }
    console.log('[PLP V28]', message);
  }

  function backendReady(){
    try{ return typeof supa !== 'undefined' && !!supa; }catch(_){ return false; }
  }

  function adminReady(){
    try{ return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; }catch(_){ return false; }
  }

  function fmtDate(value){
    if(!value) return '—';
    const [y,m,d]=String(value).slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  }

  function splitEntries(entries){
    const all=Array.isArray(entries)?entries:[];
    const active=all.filter(entry=>!entry.eliminated_at && !entry.elimination_order)
      .sort((a,b)=>(Number(a.list_position)||9999)-(Number(b.list_position)||9999) || String(a.name||'').localeCompare(String(b.name||'')));
    const eliminated=all.filter(entry=>entry.eliminated_at || entry.elimination_order)
      .sort((a,b)=>(Number(a.finish_position)||9999)-(Number(b.finish_position)||9999));
    return {all,active,eliminated};
  }

  function classificationRows(entries){
    const split=splitEntries(entries);
    const rows=[];
    split.active.forEach(entry=>{
      const pos=Number(entry.finish_position)||1;
      rows.push({position:pos,player_key:entry.player_key,name:entry.name,state:pos===1?'Campeão':'Em jogo'});
    });
    split.eliminated.forEach(entry=>rows.push({position:Number(entry.finish_position)||9999,player_key:entry.player_key,name:entry.name,state:'Eliminado'}));
    return rows.sort((a,b)=>a.position-b.position || String(a.name||'').localeCompare(String(b.name||'')));
  }

  function pointFor(position,field){
    const offsets=[8,4,1,-1,-3,-5,-6];
    if(position<=7) return Math.max(1,field+offsets[position-1]);
    return Math.max(1,field-(position-1));
  }

  function prizeFor(position,field){
    return REGULATION_PRIZES[field]?.[position-1] ?? null;
  }

  function injectStyles(){
    if(document.getElementById('plpV28FinaleStyles')) return;
    const style=document.createElement('style');
    style.id='plpV28FinaleStyles';
    style.textContent=`
      .v28-final-card{position:relative;overflow:hidden;margin:12px 0;padding:18px;border-radius:24px;border:1px solid rgba(244,201,20,.38);background:radial-gradient(circle at 50% 0%,rgba(244,201,20,.19),transparent 34%),linear-gradient(145deg,rgba(22,18,9,.96),rgba(5,5,4,.98));box-shadow:0 18px 44px rgba(0,0,0,.38)}
      .v28-final-card::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 0 37%,rgba(255,255,255,.03) 46%,transparent 55%);pointer-events:none}.v28-final-card>*{position:relative;z-index:1}
      .v28-final-kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;border:1px solid rgba(123,230,179,.34);background:rgba(123,230,179,.10);color:#8ef0c1;font-size:9px;font-weight:950;letter-spacing:1px;text-transform:uppercase}
      .v28-champion{display:grid;grid-template-columns:74px 1fr;gap:14px;align-items:center;margin:16px 0 14px}.v28-champion-badge{width:74px;height:74px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(145deg,#ffe36a,#9a7000);color:#171206;font-size:31px;font-weight:1000;box-shadow:0 10px 30px rgba(244,201,20,.22)}
      .v28-champion-copy small{display:block;color:#e6d9a8;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:850}.v28-champion-copy h2{margin:4px 0 4px;font-size:24px;line-height:1.02;color:#fff}.v28-champion-copy p{margin:0;color:#c5bcaa;font-size:10px}
      .v28-final-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:13px 0}.v28-final-metrics>div{padding:10px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}.v28-final-metrics span{display:block;color:#bfb5a1;font-size:8px;text-transform:uppercase;letter-spacing:.6px}.v28-final-metrics b{display:block;margin-top:5px;color:#ffe36a;font-size:14px}
      .v28-podium{display:grid;gap:7px;margin:12px 0}.v28-podium-row{display:grid;grid-template-columns:42px 1fr auto;gap:9px;align-items:center;padding:10px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075)}.v28-podium-row.first{border-color:rgba(244,201,20,.30);background:rgba(244,201,20,.07)}.v28-podium-pos{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#242018;color:#ffe36a;font-weight:950}.v28-podium-row b{font-size:12px}.v28-podium-row small{display:block;margin-top:2px;color:#c5bcaa;font-size:9px}.v28-podium-prize{color:#8ef0c1;font-size:10px;font-weight:900;white-space:nowrap}
      .v28-final-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.v28-final-actions button{min-height:42px;border-radius:13px;padding:9px 10px;font-size:10px;font-weight:900}.v28-share{border:1px solid rgba(244,201,20,.45);background:linear-gradient(145deg,#f4c914,#b48700);color:#151006}.v28-copy{border:1px solid rgba(244,201,20,.28);background:rgba(244,201,20,.08);color:#ffe36a}.v28-edit{grid-column:1/-1;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.045);color:#f4efe3}
      .v28-edit-note{margin-top:9px;padding:10px 11px;border-radius:13px;background:rgba(136,188,255,.07);border:1px solid rgba(136,188,255,.16);color:#cbdcf4;font-size:9px;line-height:1.5}
      .v28-editing-card{margin:12px 0;padding:14px;border-radius:20px;border:1px solid rgba(136,188,255,.34);background:linear-gradient(145deg,rgba(16,24,34,.94),rgba(6,8,12,.98));box-shadow:0 16px 34px rgba(0,0,0,.25)}.v28-editing-card h3{margin:0;color:#b9d8ff;font-size:16px}.v28-editing-card p{margin:5px 0 0;color:#c8c3b7;font-size:10px;line-height:1.45}.v28-editing-badge{display:inline-flex;margin-top:9px;padding:6px 9px;border-radius:999px;border:1px solid rgba(136,188,255,.28);background:rgba(136,188,255,.08);color:#b9d8ff;font-size:9px;font-weight:900;letter-spacing:.7px}.v28-editing-actions{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px}.v28-editing-actions button{border-radius:12px;padding:10px 12px;font-size:10px;font-weight:900}.v28-editing-actions .finish{border:1px solid rgba(123,230,179,.4);background:rgba(123,230,179,.1);color:#9ef0c7}.v28-editing-actions .finish:disabled{opacity:.42}
      .v28-full-list{margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}.v28-full-row{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)}.v28-full-row:last-child{border-bottom:0}.v28-full-row strong{color:#ffe36a;font-size:10px}.v28-full-row span{font-size:10px}.v28-full-row em{font-style:normal;color:#bfb5a1;font-size:9px}
      .v28-public-final{margin:12px 0}.v28-public-final .v28-final-actions{display:none}.v28-public-final .v28-edit-note{display:none}
      .v28-celebration{position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.86);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.v28-celebration-card{width:min(100%,430px);max-height:90vh;overflow:auto;border-radius:30px;padding:24px;border:1px solid rgba(244,201,20,.45);background:radial-gradient(circle at 50% 0%,rgba(244,201,20,.26),transparent 34%),#090806;box-shadow:0 30px 80px rgba(0,0,0,.65);text-align:center}.v28-celebration-logo{width:86px;height:86px;border-radius:50%;object-fit:cover;border:2px solid rgba(244,201,20,.55);box-shadow:0 0 28px rgba(244,201,20,.18)}.v28-celebration-card h1{margin:12px 0 4px;color:#ffe36a;font-size:27px}.v28-celebration-card h2{margin:0 0 5px;font-size:31px}.v28-celebration-card p{margin:0;color:#c5bcaa;font-size:11px}.v28-celebration-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.v28-celebration-actions button{padding:12px;border-radius:14px;font-size:11px;font-weight:900}.v28-celebration-actions .close{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff}.v28-celebration-actions .share{border:1px solid #f4c914;background:#f4c914;color:#151006}
      body.plp-v28-finalized #v25EliminationAdmin{display:none!important}
      @media(max-width:520px){.v28-champion{grid-template-columns:62px 1fr}.v28-champion-badge{width:62px;height:62px;border-radius:20px;font-size:26px}.v28-champion-copy h2{font-size:21px}.v28-final-actions{grid-template-columns:1fr}.v28-edit{grid-column:auto}.v28-final-metrics b{font-size:12px}}
    `;
    document.head.appendChild(style);
  }

  function upgradeVersionLabel(){
    document.querySelectorAll('.muted.small').forEach(el=>{
      if(/Versão\s+\d+.*Temporada\s+2026/i.test(el.textContent||'')) el.textContent='Versão 28 Operacional • Temporada 2026';
    });
  }

  async function refreshSnapshot(force=false){
    if(!backendReady()) return window.PLP_V19?.snapshot||null;
    const now=Date.now();
    if(!force && now-V28.lastSnapshotRefresh<2500) return window.PLP_V19?.snapshot||null;
    V28.lastSnapshotRefresh=now;
    try{
      const {data,error}=await supa.rpc('plp_public_stage_snapshot');
      if(error) return window.PLP_V19?.snapshot||null;
      if(window.PLP_V19) window.PLP_V19.snapshot=data;
      return data;
    }catch(_){ return window.PLP_V19?.snapshot||null; }
  }

  async function fetchAdminData(stageId){
    if(!stageId || !adminReady()) return null;
    const now=Date.now();
    if(V28.adminData?.stage?.id===stageId && now-V28.lastAdminFetch<1800) return V28.adminData;
    V28.lastAdminFetch=now;
    try{
      const [stageQ,entryQ,playersQ]=await Promise.all([
        supa.from('stages').select('*').eq('id',stageId).maybeSingle(),
        supa.from('stage_entries').select('*').eq('stage_id',stageId).order('list_position'),
        supa.from('players').select('player_key,name').order('name')
      ]);
      if(stageQ.error || !stageQ.data || entryQ.error) return null;
      const names=new Map((playersQ.data||[]).map(player=>[player.player_key,typeof normalizePlayerName==='function'?normalizePlayerName(String(player.name||'')):player.name]));
      const entries=(entryQ.data||[]).map(entry=>({...entry,name:names.get(entry.player_key)||entry.player_key}));
      V28.adminData={stage:stageQ.data,entries};
      return V28.adminData;
    }catch(_){ return null; }
  }

  function currentAdminStageId(){
    return window.PLP_V18?.selectedStageId || window.PLP_V25?.adminData?.stage?.id || window.PLP_V19?.snapshot?.stage?.id || null;
  }

  function finalCardHtml(stage,entries,{publicView=false}={}){
    const rows=classificationRows(entries);
    const champion=rows.find(row=>row.position===1) || rows[0];
    if(!champion) return '<div class="v28-final-card"><div class="empty-state">Classificação final indisponível.</div></div>';
    const field=rows.length;
    const podium=rows.slice(0,Math.min(3,rows.length));
    const podiumHtml=podium.map(row=>{
      const prize=prizeFor(row.position,field);
      return `<div class="v28-podium-row ${row.position===1?'first':''}"><div class="v28-podium-pos">${row.position}º</div><div><b>${esc(row.name)}</b><small>${pointFor(row.position,field)} pontos</small></div><div class="v28-podium-prize">${prize==null?'':money(prize)}</div></div>`;
    }).join('');
    const fullRows=rows.map(row=>`<div class="v28-full-row"><strong>${row.position}º</strong><span>${esc(row.name)}</span><em>${pointFor(row.position,field)} pts</em></div>`).join('');
    return `<div class="v28-final-card ${publicView?'v28-public-final':''}">
      <span class="v28-final-kicker">✓ ETAPA FINALIZADA</span>
      <div class="v28-champion"><div class="v28-champion-badge">♠</div><div class="v28-champion-copy"><small>CAMPEÃO DA NOITE</small><h2>${esc(champion.name)}</h2><p>${String(stage.championship||'').toUpperCase()} • ETAPA ${stage.stage_number} • ${fmtDate(stage.stage_date)}</p></div></div>
      <div class="v28-final-metrics"><div><span>Field</span><b>${field} jogadores</b></div><div><span>Premiação</span><b>${money(stage.prize_pool)}</b></div><div><span>Jackpot</span><b>${money(stage.jackpot_amount)}</b></div></div>
      <div class="v28-podium">${podiumHtml}</div>
      <div class="v28-final-actions"><button class="v28-share" type="button" data-v28-share="${esc(stage.id)}">Compartilhar arte do campeão</button><button class="v28-copy" type="button" data-v28-copy="${esc(stage.id)}">Copiar classificação</button>${publicView?'':`<button class="v28-edit" type="button" data-v28-edit="${esc(stage.id)}">Editar classificação / reabrir torneio</button>`}</div>
      ${publicView?'':'<div class="v28-edit-note">Mesmo depois de finalizada, a etapa continua editável. Ao reabrir, o resultado atual fica preservado até você concluir a correção e o sistema fechar novamente.</div>'}
      <div class="v28-full-list"><div class="v25-block-title"><b>Classificação final</b><span>${field} posições</span></div>${fullRows}</div>
    </div>`;
  }

  function bindFinalActions(container,stage,entries){
    if(!container) return;
    container.querySelector('[data-v28-share]')?.addEventListener('click',()=>shareChampionCard(stage,entries));
    container.querySelector('[data-v28-copy]')?.addEventListener('click',()=>copyClassification(entries));
    container.querySelector('[data-v28-edit]')?.addEventListener('click',()=>reopenStage(stage.id));
  }

  function renderAdminFinal(data){
    const gameDay=document.getElementById('gameDay');
    const content=document.getElementById('gdContent');
    if(!gameDay?.classList.contains('active') || !content) return;
    const stage=data?.stage;
    if(stage?.status!=='finalized'){
      document.body.classList.remove('plp-v28-finalized');
      document.getElementById('v28FinalAdmin')?.remove();
      const old=document.getElementById('v25EliminationAdmin'); if(old) old.style.display='';
      return;
    }
    document.body.classList.add('plp-v28-finalized');
    const finalizeBtn=document.getElementById('gdFinalize');
    if(finalizeBtn){ finalizeBtn.disabled=true; finalizeBtn.textContent='Etapa finalizada automaticamente'; }
    const openBtn=document.getElementById('gdOpenStage');
    if(openBtn){ openBtn.disabled=true; openBtn.textContent='Etapa finalizada'; }

    let host=document.getElementById('v28FinalAdmin');
    if(!host){
      host=document.createElement('div');
      host.id='v28FinalAdmin';
      const old=document.getElementById('v25EliminationAdmin');
      if(old) old.insertAdjacentElement('afterend',host); else content.prepend(host);
    }
    host.innerHTML=finalCardHtml(stage,data.entries||[]);
    bindFinalActions(host,stage,data.entries||[]);
  }

  function renderAdminEditing(data){
    const gameDay=document.getElementById('gameDay');
    const content=document.getElementById('gdContent');
    if(!gameDay?.classList.contains('active') || !content) return;
    const stage=data?.stage;
    if(!stage?.result_editing){ document.getElementById('v28EditingAdmin')?.remove(); return; }
    document.body.classList.remove('plp-v28-finalized');
    document.getElementById('v28FinalAdmin')?.remove();
    const split=splitEntries(data.entries||[]);
    let host=document.getElementById('v28EditingAdmin');
    if(!host){
      host=document.createElement('div');host.id='v28EditingAdmin';
      const old=document.getElementById('v25EliminationAdmin');
      if(old) old.insertAdjacentElement('beforebegin',host); else content.prepend(host);
    }
    const ready=split.active.length===1 && data.entries.length>1;
    host.innerHTML=`<div class="v28-editing-card"><h3>Classificação em edição</h3><p>O resultado final anterior continua salvo até você concluir esta correção. Use “Desfazer última eliminação” e registre novamente a ordem correta.</p><span class="v28-editing-badge">${split.active.length} EM JOGO • ${split.eliminated.length} ELIMINADOS</span><div class="v28-editing-actions"><button class="finish" type="button" id="v28FinishEdit" ${ready?'':'disabled'}>${ready?'Concluir correção e finalizar novamente':'Deixe apenas 1 jogador em jogo para concluir'}</button></div></div>`;
    const btn=host.querySelector('#v28FinishEdit');
    if(btn && ready) btn.onclick=()=>finalizeFromEliminations(data,{celebrate:false});
  }

  function renderPublicFinal(snapshot){
    const body=document.getElementById('stageLiveV19Body');
    const screen=document.getElementById('stageLiveV19');
    if(!body || !screen?.classList.contains('active')) return;
    const stage=snapshot?.stage;
    if(stage?.status!=='finalized'){
      document.getElementById('v28PublicFinal')?.remove();
      return;
    }
    body.querySelector('.v19-stage-kicker') && (body.querySelector('.v19-stage-kicker').textContent='ETAPA FINALIZADA');
    const subtitle=screen.querySelector('.screen-top p'); if(subtitle) subtitle.textContent='Campeão, pódio e classificação final';
    let host=document.getElementById('v28PublicFinal');
    if(!host){
      host=document.createElement('div');host.id='v28PublicFinal';
      const head=body.querySelector('.v19-stage-head-card');
      if(head) head.insertAdjacentElement('afterend',host); else body.prepend(host);
    }
    host.innerHTML=finalCardHtml(stage,snapshot.entries||[],{publicView:true});
    bindFinalActions(host,stage,snapshot.entries||[]);
  }

  function patchHome(snapshot){
    const stage=snapshot?.stage;
    if(!stage) return;
    if(stage.result_editing){
      const title=document.getElementById('liveStageV19Title');
      const sub=document.getElementById('liveStageV19Sub');
      if(title) title.textContent=`${String(stage.championship).toUpperCase()} - ETAPA ${stage.stage_number} - RESULTADO EM EDIÇÃO`;
      if(sub) sub.textContent='ADMINISTRADOR CORRIGINDO A CLASSIFICAÇÃO • acompanhe a atualização';
      const v18Title=document.getElementById('liveStageV18Title');
      const v18Sub=document.getElementById('liveStageV18Sub');
      if(v18Title) v18Title.textContent=`${String(stage.championship).toUpperCase()} • Etapa ${stage.stage_number} • resultado em edição`;
      if(v18Sub) v18Sub.textContent='Classificação em revisão pelo administrador';
      const kicker=document.querySelector('#home .hero-kicker');
      if(kicker) kicker.textContent=`Temporada ${stage.season||2026} • ${String(stage.championship).toUpperCase()} • RESULTADO EM EDIÇÃO`;
      return;
    }
    if(stage.status!=='finalized') return;
    const rows=classificationRows(snapshot.entries||[]),champion=rows.find(row=>row.position===1)?.name||'Campeão';
    const title=document.getElementById('liveStageV19Title');
    const sub=document.getElementById('liveStageV19Sub');
    if(title) title.textContent=`${String(stage.championship).toUpperCase()} - ETAPA ${stage.stage_number} - FINALIZADA`;
    if(sub) sub.textContent=`CAMPEÃO: ${champion.toUpperCase()} • ${rows.length} jogadores • toque para ver a classificação final`;
    const v18Title=document.getElementById('liveStageV18Title');
    const v18Sub=document.getElementById('liveStageV18Sub');
    if(v18Title) v18Title.textContent=`${String(stage.championship).toUpperCase()} • Etapa ${stage.stage_number} finalizada`;
    if(v18Sub) v18Sub.textContent=`Campeão: ${champion} • toque para ver o resultado`;
    const kicker=document.querySelector('#home .hero-kicker');
    if(kicker) kicker.textContent=`Temporada ${stage.season||2026} • ${String(stage.championship).toUpperCase()} • ETAPA FINALIZADA`;
  }

  async function finalizeFromEliminations(data,{celebrate=true}={}){
    if(V28.busy || !adminReady()) return;
    const stage=data?.stage;
    const split=splitEntries(data?.entries||[]);
    if(!stage || stage.status!=='open' || split.active.length!==1 || data.entries.length<2) return;
    V28.busy=true;
    try{
      const {data:result,error}=await supa.rpc('plp_admin_finalize_from_eliminations',{p_stage_id:stage.id});
      if(error) throw error;
      const snapshot=await refreshSnapshot(true);
      V28.adminData=null;V28.lastAdminFetch=0;
      const fresh=await fetchAdminData(stage.id);
      if(fresh) renderAdminFinal(fresh);
      const champion=result?.champion_name || classificationRows(snapshot?.entries||data.entries)[0]?.name || 'Campeão';
      toast(`Torneio finalizado. Campeão: ${champion}.`);
      if(celebrate && snapshot?.stage?.status==='finalized') showCelebration(snapshot);
    }catch(error){
      console.error('[PLP V28] finalize',error);
      const msg=String(error?.message||'').replace(/^.*?P0001:?\s*/i,'').trim();
      toast(msg && msg.length<150 ? msg : 'A classificação terminou, mas não foi possível fechar a etapa.');
    }finally{ V28.busy=false; }
  }

  async function maybeFinalize(data){
    if(V28.busy || !adminReady()) return;
    const stage=data?.stage;
    const split=splitEntries(data?.entries||[]);
    const publicStageId=window.PLP_V19?.snapshot?.stage?.id;
    if(!stage || stage.status!=='open' || !stage.game_started || stage.result_editing || split.active.length!==1 || data.entries.length<2) return;
    if(publicStageId && publicStageId!==stage.id) return;
    await finalizeFromEliminations(data,{celebrate:true});
  }

  async function reopenStage(stageId){
    if(V28.busy || !adminReady()) return;
    if(!window.confirm('Reabrir esta etapa para editar a classificação?\n\nO resultado atual e o ranking ficam preservados até você concluir a correção.')) return;
    V28.busy=true;
    try{
      const {error}=await supa.rpc('plp_admin_reopen_finalized_stage',{p_stage_id:stageId});
      if(error) throw error;
      toast('Etapa reaberta para edição. Corrija a ordem e depois toque em “Concluir correção”.');
      document.getElementById('v28Celebration')?.remove();
      document.body.classList.remove('plp-v28-finalized');
      V28.adminData=null;V28.lastAdminFetch=0;
      await refreshSnapshot(true);
      setTimeout(()=>window.PLP_V18 && (window.PLP_V18.selectedStageId=stageId),50);
    }catch(error){
      console.error('[PLP V28] reopen',error);
      toast('Não foi possível reabrir a etapa para edição.');
    }finally{ V28.busy=false; }
  }

  async function copyClassification(entries){
    const rows=classificationRows(entries);
    const text=rows.map(row=>`${row.position}º - ${row.name}`).join('\n');
    try{ await navigator.clipboard.writeText(text); toast('Classificação final copiada.'); }
    catch(_){
      const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
      try{document.execCommand('copy');toast('Classificação final copiada.');}catch(__){toast('Não foi possível copiar automaticamente.');}
      area.remove();
    }
  }

  function loadImage(src){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
      img.src=`${src}${src.includes('?')?'&':'?'}v=28`;
    });
  }

  function drawCover(ctx,img,x,y,w,h){
    if(!img) return;
    const scale=Math.max(w/img.width,h/img.height);const sw=w/scale,sh=h/scale;const sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }

  function fitFont(ctx,text,maxWidth,maxSize=64,minSize=32,weight=900){
    let size=maxSize;
    while(size>minSize){ctx.font=`${weight} ${size}px Arial`;if(ctx.measureText(text).width<=maxWidth) break;size-=2;}
    return size;
  }

  async function shareChampionCard(stage,entries){
    const rows=classificationRows(entries),champion=rows.find(row=>row.position===1)||rows[0];
    if(!champion) return toast('Classificação final indisponível.');
    const field=rows.length;
    let dbResults=[];
    try{
      if(backendReady()){
        const q=await supa.from('stage_results').select('position,player_key,points,prize').eq('stage_id',stage.id).order('position');
        if(!q.error) dbResults=q.data||[];
      }
    }catch(_){ }
    const resultMap=new Map(dbResults.map(r=>[Number(r.position),r]));
    const [bg,logo]=await Promise.all([loadImage('assets/poker-bg-v32.webp'),loadImage('assets/plp-logo-v47.png')]);
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#050504';ctx.fillRect(0,0,1080,1350);
    if(bg){ctx.save();ctx.globalAlpha=.18;drawCover(ctx,bg,0,0,1080,1350);ctx.restore();}
    const glow=ctx.createRadialGradient(540,205,20,540,205,640);glow.addColorStop(0,'rgba(244,201,20,.25)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,900);
    ctx.strokeStyle='#d8ad17';ctx.lineWidth=4;ctx.strokeRect(42,42,996,1266);
    if(logo){ctx.save();ctx.beginPath();ctx.arc(540,135,70,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,470,65,140,140);ctx.restore();ctx.strokeStyle='#d8ad17';ctx.lineWidth=3;ctx.beginPath();ctx.arc(540,135,72,0,Math.PI*2);ctx.stroke();}
    ctx.textAlign='center';ctx.fillStyle='#e9d899';ctx.font='800 28px Arial';ctx.fillText('1ª LIGA DE POKER',540,250);
    ctx.fillStyle='#ffe36a';ctx.font='900 34px Arial';ctx.fillText('CAMPEÃO DA NOITE',540,325);
    const champName=String(champion.name||'CAMPEÃO').toUpperCase();const champSize=fitFont(ctx,champName,880,78,42,900);ctx.font=`900 ${champSize}px Arial`;ctx.fillStyle='#fff';ctx.fillText(champName,540,415);
    ctx.fillStyle='#c6baa0';ctx.font='700 28px Arial';ctx.fillText(`${String(stage.championship||'').toUpperCase()} • ETAPA ${stage.stage_number} • ${fmtDate(stage.stage_date)}`,540,470);
    if(stage.host_name){ctx.font='24px Arial';ctx.fillText(`LOCAL: ${String(stage.host_name).toUpperCase()}`,540,508);}

    ctx.fillStyle='rgba(255,255,255,.055)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(100,555,880,330,28);else ctx.rect(100,555,880,330);ctx.fill();ctx.strokeStyle='rgba(244,201,20,.22)';ctx.stroke();
    ctx.fillStyle='#ffe36a';ctx.font='800 28px Arial';ctx.fillText('PÓDIO',540,615);
    rows.slice(0,3).forEach((row,i)=>{
      const y=685+i*78;const db=resultMap.get(row.position);const pts=db?.points??pointFor(row.position,field);const prize=db?.prize??prizeFor(row.position,field);
      ctx.textAlign='left';ctx.fillStyle=i===0?'#ffe36a':'#f2eee4';ctx.font=i===0?'900 38px Arial':'800 34px Arial';ctx.fillText(`${row.position}º  ${row.name}`,160,y);
      ctx.textAlign='right';ctx.fillStyle='#9debc5';ctx.font='800 25px Arial';ctx.fillText(prize==null?`${pts} pts`:`${pts} pts • ${money(prize)}`,920,y);
    });

    ctx.textAlign='center';ctx.fillStyle='#d9ca9b';ctx.font='800 25px Arial';ctx.fillText(`${field} JOGADORES`,260,970);ctx.fillText(`PREMIAÇÃO ${money(stage.prize_pool)}`,540,970);ctx.fillText(`JACKPOT ${money(stage.jackpot_amount)}`,820,970);
    ctx.strokeStyle='rgba(244,201,20,.24)';ctx.beginPath();ctx.moveTo(140,1015);ctx.lineTo(940,1015);ctx.stroke();
    ctx.fillStyle='#ffe36a';ctx.font='800 27px Arial';ctx.fillText('CLASSIFICAÇÃO FINAL',540,1070);
    ctx.fillStyle='#f0eadb';ctx.font='700 24px Arial';
    const compact=rows.slice(0,6).map(r=>`${r.position}º ${r.name}`).join('   •   ');
    const parts=[];let current='';compact.split('   •   ').forEach(bit=>{const test=current?`${current}   •   ${bit}`:bit;if(ctx.measureText(test).width>850){parts.push(current);current=bit}else current=test;});if(current)parts.push(current);
    parts.slice(0,3).forEach((line,i)=>ctx.fillText(line,540,1120+i*38));
    if(rows.length>6){ctx.fillStyle='#b9ae96';ctx.font='22px Arial';ctx.fillText(`+ ${rows.length-6} posições no aplicativo`,540,1230);}
    ctx.fillStyle='#9f947e';ctx.font='22px Arial';ctx.fillText('Temporada 2026 • 1ª Liga de Poker',540,1280);

    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.96));
    if(!blob) return toast('Não foi possível gerar a arte.');
    const filename=`PLP_${String(stage.championship||'etapa').toUpperCase()}_Etapa_${stage.stage_number}_${String(champion.name||'campeao').replace(/[^a-z0-9]+/gi,'_')}.png`;
    const file=new File([blob],filename,{type:'image/png'});
    if(navigator.canShare?.({files:[file]})){
      try{
        await navigator.share({title:'1ª Liga de Poker',text:`${String(stage.championship||'').toUpperCase()} • Etapa ${stage.stage_number} • Campeão: ${champion.name}`,files:[file]});
        return;
      }catch(error){ if(error?.name==='AbortError') return; }
    }
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Arte do campeão gerada.');
  }

  function showCelebration(snapshot){
    const stage=snapshot?.stage;
    if(stage?.status!=='finalized' || !adminReady()) return;
    const key=`plpV28Celebrated:${stage.id}`;
    if(sessionStorage.getItem(key)==='1' || document.getElementById('v28Celebration')) return;
    const rows=classificationRows(snapshot.entries||[]),champion=rows.find(row=>row.position===1)||rows[0];
    if(!champion) return;
    sessionStorage.setItem(key,'1');
    const overlay=document.createElement('div');overlay.id='v28Celebration';overlay.className='v28-celebration';
    overlay.innerHTML=`<div class="v28-celebration-card"><img class="v28-celebration-logo" src="assets/plp-logo-v47.png" alt="1ª Liga de Poker"><h1>TORNEIO FINALIZADO</h1><h2>${esc(champion.name)}</h2><p>Campeão • ${String(stage.championship||'').toUpperCase()} • Etapa ${stage.stage_number}</p><div class="v28-podium" style="text-align:left;margin-top:18px">${rows.slice(0,3).map(r=>`<div class="v28-podium-row ${r.position===1?'first':''}"><div class="v28-podium-pos">${r.position}º</div><div><b>${esc(r.name)}</b><small>${pointFor(r.position,rows.length)} pontos</small></div><div class="v28-podium-prize">${prizeFor(r.position,rows.length)==null?'':money(prizeFor(r.position,rows.length))}</div></div>`).join('')}</div><div class="v28-celebration-actions"><button class="close" type="button">Fechar</button><button class="share" type="button">Compartilhar arte</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.close').onclick=()=>overlay.remove();
    overlay.querySelector('.share').onclick=()=>shareChampionCard(stage,snapshot.entries||[]);
  }

  async function tick(){
    upgradeVersionLabel();
    const snapshot=await refreshSnapshot(false);
    if(snapshot?.stage){
      patchHome(snapshot);
      renderPublicFinal(snapshot);
      if(snapshot.stage.status==='finalized' && document.getElementById('gameDay')?.classList.contains('active')) showCelebration(snapshot);
    }
    if(!adminReady()) return;
    const stageId=currentAdminStageId();
    if(!stageId) return;
    let data=window.PLP_V25?.adminData;
    if(!data || data.stage?.id!==stageId || data.stage?.status==='finalized') data=await fetchAdminData(stageId) || data;
    if(!data) return;
    V28.adminData=data;
    if(data.stage?.status==='finalized'){
      renderAdminEditing(data);
      renderAdminFinal(data);
    }else if(data.stage?.result_editing){
      renderAdminFinal(data);
      renderAdminEditing(data);
    }else{
      renderAdminEditing(data);
      renderAdminFinal(data);
      await maybeFinalize(data);
    }
  }

  async function init(){
    injectStyles();
    for(let i=0;i<120;i++){
      if(window.PLP_V19 && window.PLP_V25) break;
      await sleep(100);
    }
    await refreshSnapshot(true);
    await tick();
    V28.timer=setInterval(()=>tick().catch(error=>console.error('[PLP V28] tick',error)),900);
    document.addEventListener('click',event=>{
      const nav=event.target.closest('[data-go]')?.dataset.go;
      if(nav==='gameDay'||nav==='stageLiveV19'||nav==='home') setTimeout(()=>tick().catch(()=>{}),160);
    });
  }

  init();
})();
