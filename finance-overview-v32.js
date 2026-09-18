/* PLP V32 • resumo financeiro geral da Liga */
(() => {
  'use strict';

  const SUMMARY = {
    pot: 3970.00,
    paid: 1571.45,
    future: 872.00,
    cash: 2398.55,
    projected: 1526.55,
    updatedAt: '18/09/2026'
  };
  window.PLP_FINANCE_SUMMARY = SUMMARY;

  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);

  function build(){
    const screen=document.getElementById('finance');
    if(!screen) return false;
    if(document.getElementById('financeV32Overview')) return true;

    const anchor=document.getElementById('financeV30Root');
    if(!anchor) return false;

    const box=document.createElement('div');
    box.id='financeV32Overview';
    box.className='v32-fin-overview';
    box.innerHTML=`
      <section class="v32-fin-panel" aria-label="Resumo financeiro da liga">
        <div class="v32-fin-head">
          <h3>Resumo Financeiro</h3>
          <p>Visão geral do pot, despesas e valores comprometidos.</p>
        </div>
        <div class="v32-fin-grid">
          <div class="v32-fin-metric"><span>Pot total</span><b>${money(SUMMARY.pot)}</b><small>dinheiro acumulado da Liga</small></div>
          <div class="v32-fin-metric"><span>Despesas já pagas</span><b>${money(SUMMARY.paid)}</b><small>saídas já realizadas</small></div>
          <div class="v32-fin-metric"><span>Saldo em caixa</span><b>${money(SUMMARY.cash)}</b><small>pot menos despesas pagas</small></div>
          <div class="v32-fin-metric"><span>Compromissos futuros</span><b>${money(SUMMARY.future)}</b><small>valores ainda reservados</small></div>
          <div class="v32-fin-metric"><span>Saldo livre projetado</span><b>${money(SUMMARY.projected)}</b><small>saldo após quitar tudo</small></div>
        </div>
      </section>

      <section class="v32-fin-explain" aria-label="Entendimento financeiro">
        <div class="v32-fin-explain-head"><b>Entendimento financeiro</b><span>O que significa cada informação</span></div>
        <div class="v32-fin-explain-body">
          <div class="v32-fin-row"><strong>Pot atual</strong><span>Dinheiro acumulado da Liga.</span></div>
          <div class="v32-fin-row"><strong>Despesas já pagas</strong><span>Saídas que já foram efetivamente pagas.</span></div>
          <div class="v32-fin-row"><strong>Saldo em caixa</strong><span>Pot total menos as despesas que já saíram do caixa.</span></div>
          <div class="v32-fin-row"><strong>Compromissos futuros</strong><span>Despesas já previstas e reservadas, mas que ainda serão pagas.</span></div>
          <div class="v32-fin-row"><strong>Saldo livre projetado</strong><span>Valor que sobra depois de pagar também todos os compromissos futuros.</span></div>
        </div>
        <div class="v32-fin-foot">Atualizado em ${SUMMARY.updatedAt}. O detalhamento das etapas, Jackpot da Libertadores e edição administrativa continuam logo abaixo.</div>
      </section>
      <div class="v32-fin-detail-title"><b>Detalhamento por etapas</b><span>Jackpot, arrecadação, premiações e etapa atual</span></div>
    `;

    anchor.parentNode.insertBefore(box, anchor);
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(build() || tries>120) clearInterval(timer);
  },100);

  if(document.readyState!=='loading') build();
  else document.addEventListener('DOMContentLoaded',build,{once:true});
})();
