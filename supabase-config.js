// PLP Poker • configuração pública do Supabase e carregador da aplicação
// A chave abaixo é publishable/anon. Nunca inclua service_role no frontend.
window.PLP_SUPABASE_CONFIG = {
  url: "https://rhgpecujwbsjhtawcoac.supabase.co",
  anonKey: "sb_publishable_elNr5qi_sEYm2ddiZZ9dLg_s_T4oCZM"
};

window.PLP_BUILD = '57';

(() => {
  'use strict';

  const BUILD = window.PLP_BUILD;
  const styles = [
    ['theme-v32.css', 'plpThemeV32'],
    ['home-stable-v35.css', 'plpHomeStableV35'],
    ['global-background-v36.css', 'plpGlobalBgV36'],
    ['home-logo-v37.css', 'plpHomeLogoV37']
  ];
  const scripts = [
    ['app-v18.js', 'plpV18'],
    ['app-v19.js', 'plpV19'],
    ['app-v22-fix.js', 'plpV22Fix'],
    ['clock-v24.js', 'plpClockV24'],
    ['clock-admin-v24.js', 'plpClockAdminV24'],
    ['elimination-v25.js', 'plpEliminationV25'],
    ['admin-access-v26.js', 'plpAdminAccessV26'],
    ['quick-admin-v27.js', 'plpQuickAdminV27'],
    ['finale-v28.js', 'plpFinaleV28'],
    ['stability-v29.js', 'plpStabilityV29'],
    ['finance-v30.js', 'plpFinanceV30'],
    ['finance-overview-v32.js', 'plpFinanceOverviewV32'],
    ['finance-ledger-v33.js', 'plpFinanceLedgerV33'],
    ['game-flow-v52.js', 'plpGameFlowV52'],
    ['game-flow-v52-compat.js', 'plpGameFlowV52Compat'],
    ['game-list-template-v53.js', 'plpGameListTemplateV53'],
    ['game-flow-v54.js', 'plpGameFlowV54'],
    ['live-game-v55.js', 'plpLiveGameV55'],
    ['stage-correction-v57.js', 'plpStageCorrectionV57']
  ];

  function versioned(path) {
    return `${path}?v=${encodeURIComponent(BUILD)}`;
  }

  function ensureStyle(path, key) {
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find(link => new URL(link.href, location.href).pathname.endsWith(`/${path}`));
    if (existing) {
      existing.dataset[key] = '1';
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = versioned(path);
    link.dataset[key] = '1';
    document.head.appendChild(link);
  }

  function loadScript(path, key) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts]
        .find(script => new URL(script.src || '', location.href).pathname.endsWith(`/${path}`));
      if (existing) {
        existing.dataset[key] = '1';
        if (existing.dataset.plpLoaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${path}`)), { once:true });
        window.setTimeout(resolve, 3000);
        return;
      }
      const script = document.createElement('script');
      script.src = versioned(path);
      script.dataset[key] = '1';
      script.onload = () => { script.dataset.plpLoaded = '1'; resolve(); };
      script.onerror = () => reject(new Error(`Falha ao carregar ${path}`));
      document.body.appendChild(script);
    });
  }

  function bindAuthReload() {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      try {
        if (typeof supa !== 'undefined' && supa) {
          window.clearInterval(timer);
          supa.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_IN' && !sessionStorage.getItem('plpV54SignedReload')) {
              sessionStorage.setItem('plpV54SignedReload', '1');
              window.setTimeout(() => location.reload(), 250);
            }
            if (event === 'SIGNED_OUT') sessionStorage.removeItem('plpV54SignedReload');
          });
        }
      } catch (_) {}
      if (tries > 100) window.clearInterval(timer);
    }, 100);
  }

  async function loadApplication() {
    styles.forEach(([path,key]) => ensureStyle(path,key));
    for (const [path,key] of scripts) {
      try {
        await loadScript(path,key);
        if (path === 'app-v18.js') bindAuthReload();
      } catch (error) {
        console.error('[PLP] módulo não carregado:', path, error);
      }
    }
  }

  styles.forEach(([path,key]) => ensureStyle(path,key));
  if (document.readyState === 'complete') window.setTimeout(loadApplication, 0);
  else window.addEventListener('load', loadApplication, { once:true });
})();
