/* PLP V52 • remove atalhos antigos que quebravam a sequência do Dia de Jogo */
(() => {
  'use strict';

  function alignLegacyControls() {
    const gameDay = document.getElementById('gameDay');
    const flow = document.getElementById('v52GameFlow');
    if (!gameDay || !flow) return;

    // A linha antiga permitia abrir a etapa, ir à lista ou iniciar o relógio
    // antes de informar data, local e anfitrião. O fluxo V52 já oferece esses
    // atalhos no momento correto, então a linha antiga fica oculta.
    const legacyTopActions = document.querySelector('#gameDay > .v18-card .v18-actions');
    if (legacyTopActions) legacyTopActions.style.display = 'none';

    // O botão antigo iniciava apenas o status do jogo, sem iniciar o Blind
    // Clock. A V52 usa um único botão transacional para fechar a lista e
    // iniciar o relógio; por isso, os controles antigos são ocultados.
    const legacyStart = document.getElementById('v19StartGame');
    const legacyToggle = document.getElementById('v19ToggleRegistrations');
    const legacyRow = legacyStart?.closest('.v19-actions-row') || legacyToggle?.closest('.v19-actions-row');
    if (legacyRow) legacyRow.style.display = 'none';

    // Caso uma etapa antiga já tenha sido aberta sem dados básicos, conduz o
    // administrador diretamente à configuração em vez de deixar o fluxo solto.
    const summary = [...flow.querySelectorAll('.v52-summary b')].map(el => el.textContent.trim());
    const missingSetup = summary.slice(0,2).some(value => !value || /a definir/i.test(value));
    if (missingSetup && !document.getElementById('v52StageDate')) {
      document.getElementById('v52EditSetup')?.click();
    }
  }

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(alignLegacyControls, 60);
  });

  function init() {
    observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-go="gameDay"]')) setTimeout(alignLegacyControls, 260);
    }, true);
    alignLegacyControls();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
