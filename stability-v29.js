/* PLP V29 • estabilidade, pausa automática do Blind Clock e edição direta da classificação */
(() => {
  'use strict';

  const V29 = {
    frozenStageId: null,
    syncTimer: null,
    lastClockPauseStageId: null,
    editorOrder: [],
    editorStage: null,
    restoringScroll: false,
    lastStableScrollY: window.scrollY,
    lastUserInteractionAt: 0
  };
  window.PLP_V29 = V29;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);

  function toast(message){
    try{ if(typeof showToast === 'function') return showToast(message); }catch(_){ }
    console.log('[PLP V29]', message);
  }

  function backendReady(){
    try{ return typeof supa !== 'undefined' && !!supa; }catch(_){ return false; }
  }

  function adminReady(){
    try{ return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; }catch(_){ return false; }
  }

  function shortDate(value){
    if(!value) return '—';
    const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
    return `${String(d).padStart(2,'0')}/${months[(m||1)-1]||String(m).padStart(2,'0')}`;
  }

  function nextDate(value){
    if(!value) return null;
    const date=new Date(`${String(value).slice(0,10)}T12:00:00`);
    date.setDate(date.getDate()+7);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function championshipLabel(value){ return String(value||'').toUpperCase(); }
  function ordinalStage(n){ return `${Number(n)||0}ª Etapa`; }

  function injectStyles(){
    if(document.getElementById('plpV29Styles')) return;
    const style=document.createElement('style');
    style.id='plpV29Styles';
    style.textContent=`
      .v29-editor{position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.86);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;padding:10px}
      .v29-editor-card{width:min(100%,520px);max-height:92vh;overflow:auto;border-radius:26px 26px 18px 18px;padding:18px;border:1px solid rgba(244,201,20,.35);background:linear-gradient(180deg,#14110b,#070706);box-shadow:0 24px 70px rgba(0,0,0,.62)}
      .v29-editor-head{display:flex;align-items:flex-start;gap:12px}.v29-editor-head>div{flex:1}.v29-editor-head h3{margin:0;color:#ffe36a;font-size:19px}.v29-editor-head p{margin:5px 0 0;color:#c5bcaa;font-size:10px;line-height:1.45}.v29-close{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;border-radius:12px;width:38px;height:38px;font-weight:900}
      .v29-editor-list{display:grid;gap:7px;margin-top:14px}.v29-editor-row{display:grid;grid-template-columns:70px 1fr 38px 38px;gap:7px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.035)}
      .v29-editor-row:first-child{border-color:rgba(244,201,20,.28);background:rgba(244,201,20,.07)}.v29-pos-select{width:100%;border:1px solid rgba(244,201,20,.28);border-radius:10px;background:#15130e;color:#ffe36a;padding:9px 6px;font-weight:900}.v29-name{font-size:11px;font-weight:850;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v29-move{border:1px solid rgba(255,255,255,.12);background:#171510;color:#fff;border-radius:10px;height:38px;font-weight:900}.v29-move:disabled{opacity:.28}
      .v29-editor-note{margin-top:12px;padding:10px 11px;border-radius:12px;background:rgba(136,188,255,.07);border:1px solid rgba(136,188,255,.16);color:#cbdcf4;font-size:9px;line-height:1.5}.v29-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.v29-editor-actions button{min-height:44px;border-radius:13px;font-size:11px;font-weight:900}.v29-cancel{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff}.v29-save{border:1px solid #f4c914;background:#f4c914;color:#151006}
      @media(max-width:430px){.v29-editor-row{grid-template-columns:64px 1fr 36px 36px}.v29-editor-card{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function recordUserInteraction(){ V29.lastUserInteractionAt=Date.now(); }

  function installScrollStability(){
    window.addEventListener('scroll',()=>{
      if(!V29.restoringScroll) V29.lastStableScrollY=window.scrollY;
    },{passive:true});
    ['touchstart','touchmove','pointerdown','wheel'].forEach(type=>document.addEventListener(type,recordUserInteraction,{passive:true}));

    const host=document.getElementById('stageLiveV19Body');
    if(!host) return;
    const observer=new MutationObserver(()=>{
      const screen=document.getElementById('stageLiveV19');
      if(!screen?.classList.contains('active')) return;
      if(Date.now()-V29.lastUserInteractionAt<280) return;
      const active=document.activeElement;
      if(active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;
      const target=V29.lastStableScrollY;
      requestAnimationFrame(()=>{
        if(Math.abs(window.scrollY-target)<8) return;
        V29.restoringScroll=true;
        window.scrollTo(0,target);
        requestAnimationFrame(()=>{V29.restoringScroll=false;V29.lastStableScrollY=window.scrollY;});
      });
    });
    observer.observe(host,{childList:true,subtree:true});
  }

  function findPremiumStat(labelMatcher){
    return Array.from(document.querySelectorAll('#home .premium-stat')).find(card=>labelMatcher(String(card.querySelector('span')?.textContent||'').toLowerCase()));
  }

  function patchHome(snapshot){
    const stage=snapshot?.stage;
    if(!stage || stage.status!=='finalized') return;
    const home=document.getElementById('home');
    if(!home) return;

    const entries=Array.isArray(snapshot.entries)?snapshot.entries:[];
    const champ=championshipLabel(stage.championship);
    const stageDate=shortDate(stage.stage_date);
    const nextStageDate=shortDate(nextDate(stage.stage_date));
    const nextStageNumber=(Number(stage.stage_number)||0)+1;
    const totalResults=String(stage.championship||'').toLowerCase()==='br4' ? 11+(Number(stage.stage_number)||0) : null;

    const pills=home.querySelectorAll('.hero-pill');
    if(pills[0] && totalResults) pills[0].textContent=`${totalResults} etapas com resultado`;
    if(pills[1]) pills[1].textContent='Ranking geral atualizado';
    if(pills[2]) pills[2].textContent=`Próxima etapa ${champ} • ${nextStageDate}`;

    const sectionInfo=home.querySelector('.home-section-title small');
    if(sectionInfo) sectionInfo.textContent=`Dados atualizados até a ${ordinalStage(stage.stage_number)} do ${champ} • ${stageDate}`;

    const stageCard=findPremiumStat(text=>text.includes('etapa atual')||text.includes('última etapa'));
    if(stageCard){
      const span=stageCard.querySelector('span'), b=stageCard.querySelector('b'), small=stageCard.querySelector('small');
      if(span) span.textContent=`${champ} • última etapa`;
      if(b) b.textContent=ordinalStage(stage.stage_number);
      if(small) small.textContent=`${stageDate} • ${entries.length} jogador${entries.length===1?'':'es'}`;
    }

    const nextCard=findPremiumStat(text=>text.includes('próximo campeonato')||text.includes('próxima etapa'));
    if(nextCard){
      const span=nextCard.querySelector('span'), b=nextCard.querySelector('b'), small=nextCard.querySelector('small');
      if(span) span.textContent='Próxima etapa';
      if(b) b.textContent=`${champ} • ${nextStageDate}`;
      if(small) small.textContent=`${ordinalStage(nextStageNumber)} • temporada ${stage.season||2026}`;
    }

    const jackpotCard=findPremiumStat(text=>text==='jackpot');
    if(jackpotCard){
      const total=(Number(snapshot.finalized_jackpot)||0)+(Number(stage.jackpot_amount)||0);
      if(total>0){ const b=jackpotCard.querySelector('b'); if(b) b.textContent=money(total); }
    }

    document.querySelectorAll('[data-v28-edit]').forEach(btn=>btn.textContent='Editar classificação');
  }

  function freezeFinalizedLoops(stageId){
    if(V29.frozenStageId===stageId) return;
    try{
      if(window.PLP_V19?.poll){ clearInterval(window.PLP_V19.poll); window.PLP_V19.poll=null; }
      if(window.PLP_V28?.timer){ clearInterval(window.PLP_V28.timer); window.PLP_V28.timer=null; }
    }catch(_){ }
    V29.frozenStageId=stageId;
  }

  async function pauseBlindClock(stageId){
    if(V29.lastClockPauseStageId===stageId) return;
    V29.lastClockPauseStageId=stageId;
    try{ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(_){ }
    if(!adminReady()) return;
    try{
      if(typeof derivedRemoteClock==='function' && typeof saveRemoteClock==='function'){
        const view=derivedRemoteClock();
        if(view?.running){
          const ok=await saveRemoteClock({level:Number(view.level)||0,remaining:Math.max(0,Number(view.remaining)||0),running:false});
          if(ok) toast('Etapa finalizada: Blind Clock pausado automaticamente.');
        }
      }else{
        const {data,error}=await supa.from('clock_state').select('*').eq('id','main').single();
        if(!error && data?.running){
          await supa.from('clock_state').update({running:false,started_at:null,updated_at:new Date().toISOString()}).eq('id','main');
        }
      }
    }catch(error){ console.error('[PLP V29] pause clock',error); }
  }

  async function fetchSnapshot(){
    if(!backendReady()) return window.PLP_V19?.snapshot||null;
    try{
      const {data,error}=await supa.rpc('plp_public_stage_snapshot');
      if(error) return window.PLP_V19?.snapshot||null;
      const snapshot=typeof normalizeStageSnapshot==='function'?normalizeStageSnapshot(data):data;
      if(window.PLP_V19) window.PLP_V19.snapshot=snapshot;
      return snapshot;
    }catch(_){ return window.PLP_V19?.snapshot||null; }
  }

  async function stabilize(){
    const snapshot=await fetchSnapshot();
    const stage=snapshot?.stage;
    if(!stage) return;
    if(stage.status==='finalized'){
      patchHome(snapshot);
      freezeFinalizedLoops(stage.id);
      await pauseBlindClock(stage.id);
      return;
    }
    if(V29.frozenStageId && stage.id!==V29.frozenStageId){
      sessionStorage.setItem('plpV29StageChanged','1');
      location.reload();
    }
  }

  function editorHtml(){
    const stage=V29.editorStage;
    const options=V29.editorOrder.map((_,i)=>`<option value="${i+1}">${i+1}º</option>`).join('');
    const rows=V29.editorOrder.map((entry,i)=>`<div class="v29-editor-row" data-v29-key="${esc(entry.player_key)}">
      <select class="v29-pos-select" data-v29-pos="${esc(entry.player_key)}">${options.replace(`value="${i+1}"`,`value="${i+1}" selected`)}</select>
      <div class="v29-name">${esc(entry.name)}</div>
      <button type="button" class="v29-move" data-v29-up="${esc(entry.player_key)}" ${i===0?'disabled':''}>↑</button>
      <button type="button" class="v29-move" data-v29-down="${esc(entry.player_key)}" ${i===V29.editorOrder.length-1?'disabled':''}>↓</button>
    </div>`).join('');
    return `<div class="v29-editor-card">
      <div class="v29-editor-head"><div><h3>Editar classificação</h3><p>${championshipLabel(stage?.championship)} • ${ordinalStage(stage?.stage_number)}. Troque a posição pelo seletor ou use as setas.</p></div><button type="button" class="v29-close" id="v29CloseEditor">✕</button></div>
      <div class="v29-editor-list">${rows}</div>
      <div class="v29-editor-note">Ao salvar, o sistema recalcula os pontos, o pódio e a premiação da etapa mantendo o torneio finalizado.</div>
      <div class="v29-editor-actions"><button type="button" class="v29-cancel" id="v29CancelEditor">Cancelar</button><button type="button" class="v29-save" id="v29SaveEditor">Salvar classificação</button></div>
    </div>`;
  }

  function rerenderEditor(){
    const overlay=document.getElementById('v29ClassificationEditor');
    if(!overlay) return;
    overlay.innerHTML=editorHtml();
    bindEditor();
  }

  function movePlayer(key,targetIndex){
    const from=V29.editorOrder.findIndex(entry=>entry.player_key===key);
    if(from<0) return;
    const to=Math.max(0,Math.min(V29.editorOrder.length-1,targetIndex));
    if(from===to) return;
    const [item]=V29.editorOrder.splice(from,1);
    V29.editorOrder.splice(to,0,item);
    rerenderEditor();
  }

  function bindEditor(){
    document.getElementById('v29CloseEditor')?.addEventListener('click',closeEditor);
    document.getElementById('v29CancelEditor')?.addEventListener('click',closeEditor);
    document.getElementById('v29SaveEditor')?.addEventListener('click',saveClassification);
    document.querySelectorAll('[data-v29-pos]').forEach(select=>select.addEventListener('change',()=>movePlayer(select.dataset.v29Pos,Number(select.value)-1)));
    document.querySelectorAll('[data-v29-up]').forEach(btn=>btn.addEventListener('click',()=>{
      const i=V29.editorOrder.findIndex(entry=>entry.player_key===btn.dataset.v29Up); movePlayer(btn.dataset.v29Up,i-1);
    }));
    document.querySelectorAll('[data-v29-down]').forEach(btn=>btn.addEventListener('click',()=>{
      const i=V29.editorOrder.findIndex(entry=>entry.player_key===btn.dataset.v29Down); movePlayer(btn.dataset.v29Down,i+1);
    }));
  }

  function closeEditor(){
    document.getElementById('v29ClassificationEditor')?.remove();
    V29.editorOrder=[];V29.editorStage=null;
  }

  async function openEditor(stageId){
    if(!adminReady()) return toast('Apenas administradores podem editar a classificação.');
    try{
      const [stageQ,entryQ,playersQ]=await Promise.all([
        supa.from('stages').select('*').eq('id',stageId).maybeSingle(),
        supa.from('stage_entries').select('*').eq('stage_id',stageId),
        supa.from('players').select('player_key,name')
      ]);
      if(stageQ.error || !stageQ.data || entryQ.error) throw stageQ.error||entryQ.error||new Error('Etapa não encontrada');
      const names=new Map((playersQ.data||[]).map(player=>[player.player_key,typeof normalizePlayerName==='function'?normalizePlayerName(String(player.name||'')):player.name]));
      const order=(entryQ.data||[]).map(entry=>({...entry,name:names.get(entry.player_key)||entry.player_key}))
        .sort((a,b)=>(Number(a.finish_position)||9999)-(Number(b.finish_position)||9999) || (Number(a.list_position)||9999)-(Number(b.list_position)||9999));
      if(order.length<2) return toast('Classificação insuficiente para edição.');
      V29.editorStage=stageQ.data;V29.editorOrder=order;
      let overlay=document.getElementById('v29ClassificationEditor');
      if(!overlay){ overlay=document.createElement('div'); overlay.id='v29ClassificationEditor'; overlay.className='v29-editor'; document.body.appendChild(overlay); }
      rerenderEditor();
    }catch(error){ console.error('[PLP V29] editor',error); toast('Não foi possível abrir a classificação para edição.'); }
  }

  async function saveClassification(){
    if(!V29.editorStage || !adminReady()) return;
    const btn=document.getElementById('v29SaveEditor');
    if(btn){btn.disabled=true;btn.textContent='Salvando…';}
    try{
      const order=V29.editorOrder.map(entry=>entry.player_key);
      const {error}=await supa.rpc('plp_admin_replace_classification',{p_stage_id:V29.editorStage.id,p_player_order:order});
      if(error) throw error;
      toast('Classificação atualizada. Ranking, pontos e premiação recalculados.');
      closeEditor();
      setTimeout(()=>location.reload(),500);
    }catch(error){
      console.error('[PLP V29] save classification',error);
      toast(String(error?.message||'').includes('function')?'A atualização V29 do banco ainda não foi aplicada.':'Não foi possível salvar a classificação.');
      if(btn){btn.disabled=false;btn.textContent='Salvar classificação';}
    }
  }

  function interceptLegacyEdit(){
    document.addEventListener('click',event=>{
      const btn=event.target.closest?.('[data-v28-edit]');
      if(!btn) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void openEditor(btn.dataset.v28Edit);
    },true);
  }

  async function init(){
    injectStyles();
    for(let i=0;i<120;i++){
      if(window.PLP_V19 && window.PLP_V28) break;
      await sleep(100);
    }
    installScrollStability();
    interceptLegacyEdit();
    await sleep(250);
    await stabilize();
    V29.syncTimer=setInterval(()=>stabilize().catch(error=>console.error('[PLP V29] stabilize',error)),5000);
    document.addEventListener('click',event=>{
      const nav=event.target.closest?.('[data-go]')?.dataset.go;
      if(nav==='home') setTimeout(()=>patchHome(window.PLP_V19?.snapshot),80);
    });
  }

  init();
})();
