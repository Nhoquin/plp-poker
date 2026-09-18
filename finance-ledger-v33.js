/* PLP V33 • extrato explicativo do pote */
(() => {
  'use strict';

  const PAID = [
    {date:'13/jan', description:'Reforma da mesa verde', category:'Infraestrutura', value:361.00},
    {date:'21/jan', description:'Coelhos (Geio)', category:'Material de jogo', value:55.00},
    {date:'27/jan', description:'Caderno', category:'Administrativo', value:29.30},
    {date:'02/fev', description:'Posições e Coelhos (Juninho)', category:'Material de jogo', value:134.25},
    {date:'19/fev', description:'Caixa de baralho', category:'Material de jogo', value:599.90},
    {date:'31/mar', description:'Campeão BR1', category:'Premiação', value:60.00},
    {date:'23/jun', description:'Campeão BR2', category:'Premiação', value:60.00},
    {date:'08/set', description:'Campeão BR3', category:'Premiação', value:60.00},
    {date:'15/set', description:'Troféus 1/2', category:'Troféus', value:212.00}
  ];

  const FUTURE = [
    {date:'A definir', description:'Campeão BR4', category:'Premiação', value:60.00},
    {date:'A definir', description:'Campeão do Ranking', category:'Premiação Ranking', value:300.00},
    {date:'A definir', description:'Vice Campeão do Ranking', category:'Premiação Ranking', value:200.00},
    {date:'A definir', description:'3º lugar do Ranking', category:'Premiação Ranking', value:100.00},
    {date:'20/set', description:'Troféus 2/2', category:'Troféus', value:212.00}
  ];

  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const sum = list => list.reduce((acc,item)=>acc+(Number(item.value)||0),0);

  function ensureStyles(){
    if(document.getElementById('plpV33LedgerStyles')) return;
    const style=document.createElement('style');
    style.id='plpV33LedgerStyles';
    style.textContent=`
      .v33-ledger{margin:14px 0 18px;border:1px solid rgba(244,201,20,.20);border-radius:24px;background:linear-gradient(145deg,rgba(15,13,9,.86),rgba(6,6,5,.95));overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,.22)}
      .v33-ledger-head{padding:16px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(90deg,rgba(244,201,20,.08),transparent)}
      .v33-ledger-head h3{margin:0;font-size:17px}.v33-ledger-head p{margin:5px 0 0;color:#bfb6a4;font-size:10px;line-height:1.45}
      .v33-ledger-reconcile{display:grid;grid-template-columns:1fr auto;gap:9px 14px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.18)}
      .v33-ledger-reconcile span{font-size:10px;color:#c9bfac}.v33-ledger-reconcile b{font-size:11px;text-align:right}.v33-ledger-reconcile .minus{color:#f1c96b}.v33-ledger-reconcile .subtotal{padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-weight:800}.v33-ledger-reconcile .final{color:#ffe36a;font-size:13px}
      .v33-ledger-filters{display:flex;gap:7px;overflow:auto;padding:12px 12px 4px;scrollbar-width:none}.v33-ledger-filter{white-space:nowrap;border:1px solid rgba(244,201,20,.18);background:rgba(255,255,255,.035);color:#c7bdab;border-radius:999px;padding:8px 11px;font-size:9px;font-weight:800}.v33-ledger-filter.active{background:#f4c914;color:#161107;border-color:#f4c914}
      .v33-ledger-summary{display:flex;justify-content:space-between;gap:10px;padding:8px 14px 10px;color:#a9a08f;font-size:9px}.v33-ledger-summary b{color:#ffe36a}
      .v33-ledger-list{padding:0 12px 12px}
      .v33-ledger-item{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;padding:12px 4px;border-bottom:1px solid rgba(255,255,255,.065)}.v33-ledger-item:last-child{border-bottom:0}
      .v33-ledger-date{font-size:9px;color:#a99f8e;text-transform:uppercase}
      .v33-ledger-main b{display:block;font-size:11px}.v33-ledger-main small{display:flex;gap:6px;align-items:center;margin-top:4px;color:#a99f8e;font-size:8px}
      .v33-ledger-pill{display:inline-flex;align-items:center;padding:3px 6px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.35px}.v33-ledger-pill.paid{background:rgba(123,230,179,.10);color:#8fe9bc;border:1px solid rgba(123,230,179,.22)}.v33-ledger-pill.future{background:rgba(255,201,71,.10);color:#ffd966;border:1px solid rgba(255,201,71,.25)}
      .v33-ledger-value{text-align:right;font-size:11px;font-weight:900}.v33-ledger-value.paid{color:#f1e6c5}.v33-ledger-value.future{color:#ffe36a}
      .v33-ledger-help{margin:0 12px 13px;padding:11px 12px;border-radius:14px;border:1px dashed rgba(244,201,20,.20);background:rgba(244,201,20,.035);color:#bfb6a4;font-size:9px;line-height:1.5}
      @media(max-width:430px){.v33-ledger-item{grid-template-columns:48px 1fr auto;gap:8px}.v33-ledger-value{font-size:10px}.v33-ledger-reconcile{padding:13px 14px}}
    `;
    document.head.appendChild(style);
  }

  function itemHtml(item,status){
    const future=status==='future';
    return `<div class="v33-ledger-item" data-ledger-status="${status}">
      <div class="v33-ledger-date">${item.date}</div>
      <div class="v33-ledger-main">
        <b>${item.description}</b>
        <small><span class="v33-ledger-pill ${status}">${future?'RESERVADO':'PAGO'}</span><span>${item.category}</span></small>
      </div>
      <div class="v33-ledger-value ${status}">− ${money(item.value)}</div>
    </div>`;
  }

  function build(){
    ensureStyles();
    const overview=document.getElementById('financeV32Overview');
    if(!overview) return false;
    if(document.getElementById('financeLedgerV33')) return true;

    const summary=window.PLP_FINANCE_SUMMARY || {pot:3970,paid:1571.45,cash:2398.55,future:872,projected:1526.55};
    const paidTotal=sum(PAID);
    const futureTotal=sum(FUTURE);

    const section=document.createElement('section');
    section.id='financeLedgerV33';
    section.className='v33-ledger';
    section.innerHTML=`
      <div class="v33-ledger-head">
        <h3>Extrato do Pote</h3>
        <p>Detalhamento das despesas da Liga, separando o que já saiu do caixa do que está apenas reservado para pagamento futuro.</p>
      </div>

      <div class="v33-ledger-reconcile">
        <span>Pot total acumulado</span><b>${money(summary.pot)}</b>
        <span>(−) Despesas já pagas</span><b class="minus">− ${money(summary.paid)}</b>
        <span class="subtotal">(=) Saldo em caixa</span><b class="subtotal">${money(summary.cash)}</b>
        <span>(−) Compromissos futuros</span><b class="minus">− ${money(summary.future)}</b>
        <span class="subtotal">(=) Saldo livre projetado</span><b class="subtotal final">${money(summary.projected)}</b>
      </div>

      <div class="v33-ledger-filters" role="tablist" aria-label="Filtros do extrato">
        <button type="button" class="v33-ledger-filter active" data-ledger-filter="all">Tudo</button>
        <button type="button" class="v33-ledger-filter" data-ledger-filter="paid">Já pago</button>
        <button type="button" class="v33-ledger-filter" data-ledger-filter="future">Futuro / reservado</button>
      </div>

      <div class="v33-ledger-summary"><span id="v33LedgerCount">${PAID.length+FUTURE.length} lançamentos</span><span>Total exibido: <b id="v33LedgerTotal">${money(paidTotal+futureTotal)}</b></span></div>
      <div class="v33-ledger-list" id="v33LedgerList">
        ${PAID.map(item=>itemHtml(item,'paid')).join('')}
        ${FUTURE.map(item=>itemHtml(item,'future')).join('')}
      </div>

      <div class="v33-ledger-help">
        <b style="color:#ffe36a">Como ler:</b> itens marcados como <b>PAGO</b> já reduziram o caixa. Itens <b>RESERVADOS</b> ainda não saíram, mas já estão comprometidos. Por isso o saldo em caixa é ${money(summary.cash)}, enquanto o valor realmente livre após todos os compromissos é ${money(summary.projected)}.
      </div>
    `;

    const detail=overview.querySelector('.v32-fin-detail-title');
    if(detail) overview.insertBefore(section,detail);
    else overview.appendChild(section);

    function applyFilter(filter){
      const rows=[...section.querySelectorAll('[data-ledger-status]')];
      rows.forEach(row=>row.style.display=(filter==='all'||row.dataset.ledgerStatus===filter)?'grid':'none');
      const visible=filter==='paid'?PAID:filter==='future'?FUTURE:[...PAID,...FUTURE];
      section.querySelector('#v33LedgerCount').textContent=`${visible.length} lançamento${visible.length===1?'':'s'}`;
      section.querySelector('#v33LedgerTotal').textContent=money(sum(visible));
      section.querySelectorAll('.v33-ledger-filter').forEach(btn=>btn.classList.toggle('active',btn.dataset.ledgerFilter===filter));
    }

    section.querySelectorAll('.v33-ledger-filter').forEach(btn=>btn.addEventListener('click',()=>applyFilter(btn.dataset.ledgerFilter)));
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(build() || tries>150) clearInterval(timer);
  },100);

  if(document.readyState!=='loading') build();
  else document.addEventListener('DOMContentLoaded',build,{once:true});
})();