/* PLP V30 • financeiro dinâmico da etapa atual, Jackpot da Libertadores e edição administrativa */
(() => {
  'use strict';

  const JACKPOT_SPLIT = [32,17,13,10,8,7,6,5,2];
  const V30 = {
    ready:false,
    loading:false,
    lastLoad:0,
    snapshot:null,
    stages:[],
    refreshTimer:null
  };
  window.PLP_V30 = V30;

  const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const num = value => Number(value || 0);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function backendReady(){
    try{ return typeof supa !== 'undefined' && !!supa; }catch(_){ return false; }
  }

  function adminReady(){
    try{ return backendReady() && typeof isAdmin !== 'undefined' && !!isAdmin; }catch(_){ return false; }
  }

  function toast(message){
    try{ if(typeof showToast === 'function') return showToast(message); }catch(_){ }
    console.log('[PLP V30]', message);
  }

  function fmtDate(value){
    if(!value) return '—';
    const [y,m,d] = String(value).slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  }

  function shortDate(value){
    if(!value) return '—';
    const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
    return `${String(d).padStart(2,'0')}/${months[(m||1)-1]||String(m).padStart(2,'0')}`;
  }

  function statusText(status){
    return ({finalized:'FINALIZADA',running:'EM ANDAMENTO',open:'ABERTA',scheduled:'PROGRAMADA'}[String(status||'').toLowerCase()] || String(status||'').toUpperCase() || 'ETAPA');
  }

  function financial(stage, entries, previousJackpot){
    entries = Array.isArray(entries) ? entries : [];
    const buyIn = num(stage?.buy_in) || 60;
    const hostCount = entries.filter(entry=>entry.is_host).length;
    const payers = Math.max(0, entries.length - hostCount);
    const automatic = {collected:payers*buyIn, prizePool:payers*50, jackpot:payers*10};
    const manual = stage?.financial_mode === 'manual';
    const current = {
      collected: manual && stage?.collected_amount != null ? num(stage.collected_amount) : automatic.collected,
      prizePool: manual && stage?.prize_pool != null ? num(stage.prize_pool) : automatic.prizePool,
      jackpot: manual && stage?.jackpot_amount != null ? num(stage.jackpot_amount) : automatic.jackpot
    };
    return {
      buyIn, hostCount, payers, automatic, current, manual,
      libertadores:num(previousJackpot)+current.jackpot
    };
  }

  function aggregateChampionship(stages, championship){
    return (stages||[]).filter(stage=>stage.status==='finalized' && String(stage.championship).toLowerCase()===championship)
      .reduce((acc,stage)=>{
        acc.collected += num(stage.collected_amount);
        acc.prizePool += num(stage.prize_pool);
        acc.jackpot += num(stage.jackpot_amount);
        acc.count += 1;
        return acc;
      },{collected:0,prizePool:0,jackpot:0,count:0});
  }

  function totalFinalized(stages){
    return (stages||[]).filter(stage=>stage.status==='finalized').reduce((acc,stage)=>{
      acc.collected += num(stage.collected_amount);
      acc.prizePool += num(stage.prize_pool);
      acc.jackpot += num(stage.jackpot_amount);
      acc.count += 1;
      return acc;
    },{collected:0,prizePool:0,jackpot:0,count:0});
  }

  function ensureStyles(){
    if(document.getElementById('plpV30FinanceStyles')) return;
    const style=document.createElement('style');
    style.id='plpV30FinanceStyles';
    style.textContent=`
      #finance .v30-finance-root{padding-bottom:8px}
      .v30-metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.v30-metric{padding:12px;border-radius:18px;border:1px solid rgba(244,201,20,.18);background:linear-gradient(145deg,rgba(18,16,11,.82),rgba(7,7,6,.94));min-width:0}.v30-metric span{display:block;color:#bfb6a4;font-size:8px;line-height:1.25;text-transform:uppercase;letter-spacing:.45px}.v30-metric b{display:block;margin-top:6px;color:#ffe36a;font-size:17px;line-height:1.05}.v30-metric small{display:block;margin-top:5px;color:#8fe9bc;font-size:8px;line-height:1.25}
      .v30-section-title{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:18px 2px 9px}.v30-section-title h3{margin:0;font-size:14px}.v30-section-title span{color:#bfb6a4;font-size:9px;text-align:right}
      .v30-champ-card{border:1px solid rgba(244,201,20,.15);border-radius:22px;background:linear-gradient(145deg,rgba(13,12,9,.83),rgba(7,7,6,.94));overflow:hidden}.v30-champ-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.v30-champ-row:last-child{border-bottom:0}.v30-champ-row b{font-size:13px}.v30-champ-row p{margin:4px 0 0;color:#bfb6a4;font-size:9px;line-height:1.35}.v30-champ-jackpot{text-align:right;color:#ffe36a;font-weight:900;font-size:11px}.v30-champ-jackpot small{display:block;color:#bfb6a4;font-size:8px;font-weight:600;margin-bottom:3px}
      .v30-current{width:100%;text-align:left;border:1px solid rgba(244,201,20,.30);border-radius:24px;background:radial-gradient(circle at 88% 10%,rgba(244,201,20,.14),transparent 30%),linear-gradient(145deg,rgba(24,20,11,.96),rgba(7,7,6,.98));padding:16px;color:#fff;box-shadow:0 18px 40px rgba(0,0,0,.28)}.v30-current-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.v30-current-kicker{font-size:8px;color:#ffe36a;letter-spacing:1px;text-transform:uppercase;font-weight:900}.v30-current-status{padding:6px 8px;border-radius:999px;border:1px solid rgba(123,230,179,.30);background:rgba(123,230,179,.08);color:#8fe9bc;font-size:8px;font-weight:900;white-space:nowrap}.v30-current h3{margin:10px 0 3px;font-size:20px}.v30-current-sub{color:#c5bcaa;font-size:10px}.v30-current-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:13px}.v30-current-grid div{padding:9px 10px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075)}.v30-current-grid span{display:block;color:#bfb6a4;font-size:8px}.v30-current-grid b{display:block;margin-top:4px;color:#ffe36a;font-size:13px}.v30-open{display:flex;align-items:center;justify-content:space-between;margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08);color:#f6e9af;font-size:10px;font-weight:850}.v30-open strong{font-size:20px;line-height:1}
      .v30-note{margin-top:12px;padding:11px 12px;border-radius:16px;border:1px dashed rgba(244,201,20,.22);background:rgba(15,13,9,.68);color:#c8beab;font-size:9px;line-height:1.55}
      .v30-overlay{position:fixed;inset:0;z-index:16000;background:rgba(0,0,0,.86);backdrop-filter:blur(9px);display:flex;align-items:flex-end;justify-content:center;padding:9px}.v30-sheet{width:min(100%,540px);max-height:94vh;overflow:auto;border-radius:26px 26px 18px 18px;padding:17px;border:1px solid rgba(244,201,20,.34);background:radial-gradient(circle at 85% 0%,rgba(244,201,20,.12),transparent 28%),linear-gradient(180deg,#15120c,#070706);box-shadow:0 28px 80px rgba(0,0,0,.68)}.v30-sheet-head{display:flex;gap:12px;align-items:flex-start}.v30-sheet-head>div{flex:1}.v30-sheet-head small{display:block;color:#ffe36a;font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.v30-sheet-head h2{margin:5px 0 4px;font-size:22px}.v30-sheet-head p{margin:0;color:#bfb6a4;font-size:9px}.v30-close{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:#fff;font-weight:900}.v30-detail-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:15px 0}.v30-detail-metrics>div{padding:11px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075)}.v30-detail-metrics span{display:block;color:#bfb6a4;font-size:8px;text-transform:uppercase;letter-spacing:.4px}.v30-detail-metrics b{display:block;margin-top:5px;color:#ffe36a;font-size:16px}.v30-info{border:1px solid rgba(255,255,255,.075);border-radius:17px;padding:0 12px;background:rgba(255,255,255,.025)}.v30-info-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.065);font-size:10px}.v30-info-row:last-child{border-bottom:0}.v30-info-row span{color:#bfb6a4}.v30-info-row b{text-align:right}.v30-split{margin-top:14px}.v30-split h3{margin:0 0 4px;font-size:14px}.v30-split p{margin:0 0 8px;color:#bfb6a4;font-size:9px;line-height:1.4}.v30-split-row{display:grid;grid-template-columns:44px 1fr auto;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:9px}.v30-split-row strong{color:#ffe36a}.v30-admin-actions{margin-top:14px;display:grid;grid-template-columns:1fr;gap:8px}.v30-admin-edit{min-height:44px;border-radius:13px;border:1px solid #f4c914;background:#f4c914;color:#151006;font-weight:900;font-size:11px}.v30-public-hint{margin-top:11px;color:#a9a08f;font-size:8px;line-height:1.4;text-align:center}
      .v30-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.v30-field{display:grid;gap:5px}.v30-field.full{grid-column:1/-1}.v30-field label{color:#c6bda9;font-size:8px;text-transform:uppercase;letter-spacing:.45px}.v30-field input,.v30-field select{width:100%;border:1px solid rgba(244,201,20,.22);border-radius:12px;background:#14110c;color:#fff;padding:11px;font-size:11px;outline:none}.v30-field input:focus,.v30-field select:focus{border-color:rgba(255,227,106,.65)}.v30-edit-help{grid-column:1/-1;padding:10px 11px;border-radius:12px;border:1px solid rgba(136,188,255,.16);background:rgba(136,188,255,.06);color:#cbdcf4;font-size:8px;line-height:1.5}.v30-edit-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.v30-edit-actions button{min-height:43px;border-radius:12px;font-size:10px;font-weight:900}.v30-cancel{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:#fff}.v30-save{border:1px solid #f4c914;background:#f4c914;color:#151006}.v30-save:disabled{opacity:.55}
      @media(max-width:430px){.v30-metric-grid{grid-template-columns:1fr 1fr}.v30-metric-grid .v30-metric:first-child{grid-column:1/-1}.v30-detail-metrics{grid-template-columns:1fr 1fr}.v30-sheet{padding:14px}.v30-edit-grid{grid-template-columns:1fr}.v30-field.full,.v30-edit-help,.v30-edit-actions{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot(){
    const screen=document.getElementById('finance');
    if(!screen) return null;
    let root=document.getElementById('financeV30Root');
    if(root) return root;
    Array.from(screen.children).forEach((child,index)=>{
      if(index===0 || child.id==='financeV30Root') return;
      child.dataset.v30Original='1';
      child.style.display='none';
    });
    root=document.createElement('div');
    root.id='financeV30Root';
    root.className='v30-finance-root';
    screen.appendChild(root);
    return root;
  }

  function stageEntries(){ return Array.isArray(V30.snapshot?.entries) ? V30.snapshot.entries : []; }

  function renderFinance(){
    const root=ensureRoot();
    if(!root) return;
    const snapshot=V30.snapshot;
    const stage=snapshot?.stage;
    if(!stage){
      root.innerHTML='<div class="card"><div class="empty-state">Não há etapa atual publicada no momento.</div></div>';
      return;
    }

    const entries=stageEntries();
    const calc=financial(stage,entries,snapshot.finalized_jackpot);
    const total=totalFinalized(V30.stages);
    const currentJackpotTotal=calc.libertadores;
    const confirmed=entries.filter(e=>e.payment_status==='confirmed').length;
    const informed=entries.filter(e=>e.payment_status==='informed').length;
    const exempt=entries.filter(e=>e.payment_status==='exempt').length;
    const winner=entries.find(e=>Number(e.finish_position)===1)?.name || null;

    const championshipRows=['br1','br2','br3','br4'].map(key=>{
      const agg=aggregateChampionship(V30.stages,key);
      return `<div class="v30-champ-row"><div><b>${key.toUpperCase()}</b><p>${agg.count} etapa${agg.count===1?'':'s'} finalizada${agg.count===1?'':'s'} • Arrec. ${money(agg.collected)} • Prêmios ${money(agg.prizePool)}</p></div><div class="v30-champ-jackpot"><small>Jackpot</small>${money(agg.jackpot)}</div></div>`;
    }).join('');

    root.innerHTML=`
      <div class="v30-metric-grid">
        <div class="v30-metric"><span>Jackpot da Libertadores</span><b>${money(currentJackpotTotal)}</b><small>${stage.status==='finalized'?'acumulado atualizado':'inclui projeção da etapa atual'}</small></div>
        <div class="v30-metric"><span>Arrecadação finalizada</span><b>${money(total.collected)}</b><small>${total.count} etapas</small></div>
        <div class="v30-metric"><span>Premiações finalizadas</span><b>${money(total.prizePool)}</b><small>temporada ${stage.season||2026}</small></div>
      </div>

      <div class="v30-section-title"><h3>Por campeonato</h3><span>valores das etapas finalizadas</span></div>
      <div class="v30-champ-card">${championshipRows}</div>

      <div class="v30-section-title"><h3>Etapa atual</h3><span>toque para abrir todos os detalhes</span></div>
      <button type="button" class="v30-current" id="v30OpenCurrentFinance">
        <div class="v30-current-top"><span class="v30-current-kicker">${esc(String(stage.championship).toUpperCase())} • ${fmtDate(stage.stage_date)}</span><span class="v30-current-status">${esc(statusText(stage.status))}</span></div>
        <h3>${esc(String(stage.championship).toUpperCase())} • ETAPA ${Number(stage.stage_number)||0}</h3>
        <div class="v30-current-sub">${entries.length} jogador${entries.length===1?'':'es'} • ${confirmed} pagamento${confirmed===1?'':'s'} confirmado${confirmed===1?'':'s'}${informed?` • ${informed} informado${informed===1?'':'s'}`:''}${exempt?` • ${exempt} isento${exempt===1?'':'s'}`:''}${winner?` • campeão: ${esc(winner)}`:''}</div>
        <div class="v30-current-grid"><div><span>Jackpot desta rodada</span><b>${money(calc.current.jackpot)}</b></div><div><span>Jackpot Libertadores</span><b>${money(currentJackpotTotal)}</b></div><div><span>Arrecadação</span><b>${money(calc.current.collected)}</b></div><div><span>Premiação</span><b>${money(calc.current.prizePool)}</b></div></div>
        <div class="v30-open"><span>Abrir detalhes financeiros${adminReady()?' e edição':''}</span><strong>›</strong></div>
      </button>
      <div class="v30-note">O Jackpot da Libertadores considera o acumulado das etapas anteriores mais o Jackpot da etapa atual. Quando a etapa ainda não estiver finalizada, o valor aparece como projeção.</div>
    `;

    document.getElementById('v30OpenCurrentFinance')?.addEventListener('click',openDetails);
  }

  function splitHtml(total){
    return JACKPOT_SPLIT.map((pct,index)=>`<div class="v30-split-row"><b>${index+1}º</b><span>${pct}%</span><strong>${money(total*pct/100)}</strong></div>`).join('');
  }

  function closeOverlay(){ document.getElementById('v30FinanceOverlay')?.remove(); }

  function openDetails(){
    closeOverlay();
    const stage=V30.snapshot?.stage;
    if(!stage) return;
    const entries=stageEntries();
    const calc=financial(stage,entries,V30.snapshot?.finalized_jackpot);
    const confirmed=entries.filter(e=>e.payment_status==='confirmed').length;
    const informed=entries.filter(e=>e.payment_status==='informed').length;
    const pending=entries.filter(e=>e.payment_status==='pending').length;
    const exempt=entries.filter(e=>e.payment_status==='exempt').length;
    const winner=entries.find(e=>Number(e.finish_position)===1)?.name || '—';
    const host=stage.host_name || entries.find(e=>e.is_host)?.name || 'A definir';
    const overlay=document.createElement('div');
    overlay.id='v30FinanceOverlay';
    overlay.className='v30-overlay';
    overlay.innerHTML=`<div class="v30-sheet">
      <div class="v30-sheet-head"><div><small>Financeiro da etapa atual</small><h2>${esc(String(stage.championship).toUpperCase())} • ETAPA ${Number(stage.stage_number)||0}</h2><p>${fmtDate(stage.stage_date)} • ${esc(statusText(stage.status))} • temporada ${stage.season||2026}</p></div><button type="button" class="v30-close" id="v30CloseFinance">✕</button></div>
      <div class="v30-detail-metrics"><div><span>Jackpot Libertadores</span><b>${money(calc.libertadores)}</b></div><div><span>Jackpot da rodada</span><b>${money(calc.current.jackpot)}</b></div><div><span>Arrecadação</span><b>${money(calc.current.collected)}</b></div><div><span>Premiação da etapa</span><b>${money(calc.current.prizePool)}</b></div></div>
      <div class="v30-info">
        <div class="v30-info-row"><span>Acumulado antes desta etapa</span><b>${money(V30.snapshot?.finalized_jackpot)}</b></div>
        <div class="v30-info-row"><span>Buy-in</span><b>${money(calc.buyIn)}</b></div>
        <div class="v30-info-row"><span>Jogadores</span><b>${entries.length}</b></div>
        <div class="v30-info-row"><span>Pagantes previstos</span><b>${calc.payers}</b></div>
        <div class="v30-info-row"><span>Pagamentos</span><b>${confirmed} confirmados${informed?` • ${informed} informados`:''}${pending?` • ${pending} pendentes`:''}${exempt?` • ${exempt} isento${exempt===1?'':'s'}`:''}</b></div>
        <div class="v30-info-row"><span>Anfitrião</span><b>${esc(host)}</b></div>
        <div class="v30-info-row"><span>Local</span><b>${esc(stage.location||host||'A definir')}</b></div>
        <div class="v30-info-row"><span>Campeão</span><b>${esc(winner)}</b></div>
        <div class="v30-info-row"><span>Modo financeiro</span><b>${calc.manual?'MANUAL':'AUTOMÁTICO'}</b></div>
      </div>
      <div class="v30-split"><h3>Divisão projetada da Libertadores</h3><p>Percentuais previstos no regulamento sobre o Jackpot acumulado atual.</p>${splitHtml(calc.libertadores)}</div>
      ${adminReady()?'<div class="v30-admin-actions"><button type="button" class="v30-admin-edit" id="v30EditFinance">Editar dados da etapa</button></div>':'<div class="v30-public-hint">A edição aparece somente para administradores autenticados.</div>'}
    </div>`;
    overlay.addEventListener('click',event=>{ if(event.target===overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    document.getElementById('v30CloseFinance')?.addEventListener('click',closeOverlay);
    document.getElementById('v30EditFinance')?.addEventListener('click',openEditor);
  }

  function openEditor(){
    const stage=V30.snapshot?.stage;
    if(!stage || !adminReady()) return toast('Apenas administradores podem editar os dados financeiros.');
    const entries=stageEntries();
    const calc=financial(stage,entries,V30.snapshot?.finalized_jackpot);
    const sheet=document.querySelector('#v30FinanceOverlay .v30-sheet');
    if(!sheet) return;
    sheet.innerHTML=`
      <div class="v30-sheet-head"><div><small>Edição administrativa</small><h2>${esc(String(stage.championship).toUpperCase())} • ETAPA ${Number(stage.stage_number)||0}</h2><p>Altere os valores desta etapa. O Jackpot da Libertadores será recalculado automaticamente a partir do Jackpot da rodada.</p></div><button type="button" class="v30-close" id="v30CloseFinance">✕</button></div>
      <div class="v30-edit-grid">
        <div class="v30-field"><label>Buy-in</label><input id="v30BuyIn" type="number" min="0" step="0.01" value="${num(stage.buy_in)}"></div>
        <div class="v30-field"><label>Modo financeiro</label><select id="v30FinancialMode"><option value="manual" ${stage.financial_mode==='manual'?'selected':''}>Manual</option><option value="auto" ${stage.financial_mode!=='manual'?'selected':''}>Automático</option></select></div>
        <div class="v30-field"><label>Arrecadação</label><input id="v30Collected" type="number" min="0" step="0.01" value="${calc.current.collected}"></div>
        <div class="v30-field"><label>Premiação da etapa</label><input id="v30PrizePool" type="number" min="0" step="0.01" value="${calc.current.prizePool}"></div>
        <div class="v30-field"><label>Jackpot da rodada</label><input id="v30Jackpot" type="number" min="0" step="0.01" value="${calc.current.jackpot}"></div>
        <div class="v30-field"><label>Data da etapa</label><input id="v30StageDate" type="date" value="${esc(String(stage.stage_date||'').slice(0,10))}"></div>
        <div class="v30-field full"><label>Anfitrião</label><input id="v30Host" maxlength="80" value="${esc(stage.host_name||entries.find(e=>e.is_host)?.name||'')}"></div>
        <div class="v30-field full"><label>Local</label><input id="v30Location" maxlength="120" value="${esc(stage.location||'')}"></div>
        <div class="v30-edit-help">A edição financeira não altera a classificação final nem reabre o torneio. Ao salvar, os valores ficam gravados na etapa e o total da Libertadores é atualizado pelo sistema.</div>
        <div class="v30-edit-actions"><button type="button" class="v30-cancel" id="v30CancelEdit">Cancelar</button><button type="button" class="v30-save" id="v30SaveFinance">Salvar alterações</button></div>
      </div>`;
    document.getElementById('v30CloseFinance')?.addEventListener('click',closeOverlay);
    document.getElementById('v30CancelEdit')?.addEventListener('click',openDetails);
    document.getElementById('v30SaveFinance')?.addEventListener('click',saveEditor);
  }

  function readMoneyInput(id){
    const value=Number(document.getElementById(id)?.value);
    return Number.isFinite(value) && value>=0 ? Math.round(value*100)/100 : null;
  }

  async function saveEditor(){
    const stage=V30.snapshot?.stage;
    if(!stage || !adminReady()) return toast('Sessão de administrador necessária.');
    const buyIn=readMoneyInput('v30BuyIn');
    const collected=readMoneyInput('v30Collected');
    const prizePool=readMoneyInput('v30PrizePool');
    const jackpot=readMoneyInput('v30Jackpot');
    if([buyIn,collected,prizePool,jackpot].some(value=>value===null)) return toast('Revise os valores financeiros informados.');
    const stageDate=String(document.getElementById('v30StageDate')?.value||'').trim();
    if(!stageDate) return toast('Informe a data da etapa.');
    const mode=document.getElementById('v30FinancialMode')?.value==='auto'?'auto':'manual';
    const host=String(document.getElementById('v30Host')?.value||'').trim();
    const location=String(document.getElementById('v30Location')?.value||'').trim();
    const btn=document.getElementById('v30SaveFinance');
    if(btn){btn.disabled=true;btn.textContent='Salvando…';}
    try{
      const {error}=await supa.from('stages').update({
        buy_in:buyIn,
        collected_amount:collected,
        prize_pool:prizePool,
        jackpot_amount:jackpot,
        financial_mode:mode,
        stage_date:stageDate,
        host_name:host||null,
        location:location||null,
        updated_at:new Date().toISOString()
      }).eq('id',stage.id);
      if(error) throw error;
      toast('Financeiro da etapa atualizado.');
      await loadData(true);
      openDetails();
    }catch(error){
      console.error('[PLP V30] save finance',error);
      toast('Não foi possível salvar a edição financeira.');
      if(btn){btn.disabled=false;btn.textContent='Salvar alterações';}
    }
  }

  async function loadData(force=false){
    if(!backendReady() || V30.loading) return;
    const now=Date.now();
    if(!force && now-V30.lastLoad<2500) return renderFinance();
    V30.loading=true;
    V30.lastLoad=now;
    try{
      const {data:snapshot,error:snapshotError}=await supa.rpc('plp_public_stage_snapshot');
      if(snapshotError) throw snapshotError;
      const season=Number(snapshot?.stage?.season)||2026;
      const {data:stages,error:stagesError}=await supa.from('stages')
        .select('id,season,championship,stage_number,stage_date,status,buy_in,collected_amount,jackpot_amount,prize_pool,payout_mode,host_name,location,financial_mode,registration_closed,game_started,finalized_at')
        .eq('season',season)
        .order('stage_date',{ascending:true});
      if(stagesError) throw stagesError;
      V30.snapshot=snapshot||{stage:null,entries:[],finalized_jackpot:0};
      V30.stages=stages||[];
      if(window.PLP_V19) window.PLP_V19.snapshot=V30.snapshot;
      renderFinance();
    }catch(error){
      console.error('[PLP V30] load finance',error);
      const root=ensureRoot();
      if(root && !root.innerHTML) root.innerHTML='<div class="card"><div class="empty-state">Não foi possível carregar o financeiro agora.</div></div>';
    }finally{
      V30.loading=false;
    }
  }

  function upgradeVersionLabel(){
    document.querySelectorAll('.muted.small').forEach(el=>{
      if(/Versão\s+\d+.*Temporada\s+2026/i.test(el.textContent||'')) el.textContent='Versão 30 Operacional • Temporada 2026';
    });
  }

  async function init(){
    ensureStyles();
    upgradeVersionLabel();
    for(let i=0;i<100 && !backendReady();i++) await sleep(100);
    if(!backendReady()) return;
    V30.ready=true;
    await loadData(true);
    document.addEventListener('click',event=>{
      const go=event.target.closest?.('[data-go]')?.dataset.go;
      if(go==='finance') setTimeout(()=>loadData(true),80);
    });
    V30.refreshTimer=setInterval(()=>{
      if(document.getElementById('finance')?.classList.contains('active')) loadData(true);
    },15000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
