(() => {
  'use strict';

  const BUILD = '47';
  const BANNER_ID = 'plpUpdateReady';
  const APPLY_KEY = 'plpApplyingBuild';
  let registration = null;
  let reloading = false;

  function removeLegacyBanners() {
    document.querySelectorAll(
      '#plpUpdateReadyV24, #plpUpdateBanner, [data-plp-update], #' + BANNER_ID
    ).forEach(element => element.remove());

    document.querySelectorAll('button').forEach(button => {
      const text = (button.textContent || '').toLowerCase();
      if (text.includes('nova versão disponível') || text.includes('atualizar quando puder')) {
        button.remove();
      }
    });
  }

  function reloadOnNewController() {
    if (reloading || sessionStorage.getItem(APPLY_KEY) !== BUILD) return;
    reloading = true;
    sessionStorage.removeItem(APPLY_KEY);
    removeLegacyBanners();
    const url = new URL(window.location.href);
    url.searchParams.set('plp_build', BUILD);
    window.location.replace(url.toString());
  }

  async function applyUpdate() {
    if (!registration?.waiting) {
      await registration?.update().catch(() => {});
    }

    const worker = registration?.waiting;
    const button = document.getElementById(BANNER_ID);
    if (!worker) {
      removeLegacyBanners();
      return;
    }

    sessionStorage.setItem(APPLY_KEY, BUILD);
    if (button) {
      button.disabled = true;
      button.classList.add('is-applying');
      button.textContent = 'Aplicando atualização…';
    }

    worker.postMessage({ type: 'PLP_APPLY_UPDATE', build: BUILD });

    // Fallback for older WebViews that occasionally omit controllerchange.
    window.setTimeout(() => {
      if (sessionStorage.getItem(APPLY_KEY) === BUILD) reloadOnNewController();
    }, 8000);
  }

  function showUpdateBanner(reg) {
    registration = reg;
    if (!reg.waiting) return;
    removeLegacyBanners();

    const button = document.createElement('button');
    button.id = BANNER_ID;
    button.type = 'button';
    button.dataset.plpUpdate = BUILD;
    button.setAttribute('aria-live', 'polite');
    button.textContent = 'Atualização disponível • Atualizar agora';
    button.addEventListener('click', applyUpdate, { once: true });
    document.body.appendChild(button);
  }

  function watchRegistration(reg) {
    registration = reg;
    if (reg.waiting) showUpdateBanner(reg);

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller && reg.waiting) {
          showUpdateBanner(reg);
        }
      });
    });
  }

  async function checkForUpdate() {
    if (!registration) return;
    await registration.update().catch(() => {});
    if (registration.waiting) showUpdateBanner(registration);
  }

  async function init() {
    removeLegacyBanners();
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnNewController);
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'PLP_UPDATE_APPLIED') reloadOnNewController();
    });

    try {
      // Reuse an existing registration even if an older release used a query string.
      // Re-registering the same worker under alternating URLs caused the old loop.
      const existing = await navigator.serviceWorker.getRegistration('./');
      const reg = existing || await navigator.serviceWorker.register('./sw.js', {
          scope: './',
          updateViaCache: 'none'
        });
      watchRegistration(reg);
      await checkForUpdate();
    } catch (error) {
      console.warn('PLP: não foi possível verificar atualizações.', error);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    window.setInterval(checkForUpdate, 15 * 60 * 1000);
  }

  window.PLP_UPDATE = {
    build: BUILD,
    check: checkForUpdate,
    apply: applyUpdate,
    getRegistration: () => registration
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
