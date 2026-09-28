(() => {
  'use strict';

  const BUILD = '51';
  const BANNER_ID = 'plpUpdateReady';
  const APPLY_KEY = 'plpApplyingBuild';
  let registration = null;
  let reloading = false;

  const uiStability = {
    installed: false,
    lastInteractionAt: 0,
    lastInputAt: 0,
    lastEditedHost: null,
    heldAdminPanel: null,
    observer: null,
    nativeScrollTo: window.scrollTo.bind(window),
    nativeRemove: Element.prototype.remove,
    nativePrepend: Element.prototype.prepend
  };

  const PROTECTED_HOST_IDS = [
    'stageLiveV19Body',
    'gdContent',
    'signupOutput',
    'resultOutput',
    'playerDetailV18'
  ];

  function isEditable(element) {
    return element instanceof Element && (
      element.matches('input, textarea, select, [contenteditable="true"]') ||
      element.isContentEditable
    );
  }

  function protectedHostFor(element) {
    if (!(element instanceof Element)) return null;
    return element.closest(PROTECTED_HOST_IDS.map(id => `#${id}`).join(','));
  }

  function markInteraction(event) {
    uiStability.lastInteractionAt = Date.now();
    if (!isEditable(event.target)) return;
    uiStability.lastInputAt = Date.now();
    uiStability.lastEditedHost = protectedHostFor(event.target);
  }

  function hostIsBeingEdited(host) {
    if (!host) return false;
    const active = document.activeElement;
    if (isEditable(active) && host.contains(active)) return true;
    return uiStability.lastEditedHost === host && Date.now() - uiStability.lastInputAt < 1800;
  }

  function protectHost(host) {
    if (!host || host.dataset.plpStableHost === '1') return;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.get || !descriptor?.set) return;

    let lastRequestedMarkup = String(descriptor.get.call(host) || '').replace(/\s+/g, ' ').trim();

    try {
      Object.defineProperty(host, 'innerHTML', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(host);
        },
        set(value) {
          const next = String(value ?? '');
          const nextSignature = next.replace(/\s+/g, ' ').trim();

          // Polling/realtime may try to rebuild the form every few seconds.
          // While the user is typing, keep the existing DOM and input focus intact.
          if (hostIsBeingEdited(host)) {
            host.dataset.plpRefreshDeferred = '1';
            return;
          }

          // Do not rebuild an unchanged screen. Replacing identical markup was
          // dropping focus and making the page jump even with no data changes.
          if (nextSignature === lastRequestedMarkup) return;

          const scrollY = window.scrollY;
          const preserveScroll = Boolean(host.closest?.('.screen.active'));
          descriptor.set.call(host, next);
          lastRequestedMarkup = nextSignature;
          host.removeAttribute('data-plp-refresh-deferred');

          if (preserveScroll) {
            requestAnimationFrame(() => {
              if (isEditable(document.activeElement)) return;
              if (Math.abs(window.scrollY - scrollY) > 4) {
                uiStability.nativeScrollTo(0, scrollY);
              }
            });
          }
        }
      });
      host.dataset.plpStableHost = '1';
    } catch (error) {
      console.warn('PLP: não foi possível proteger uma área dinâmica.', error);
    }
  }

  function scanProtectedHosts() {
    PROTECTED_HOST_IDS.forEach(id => protectHost(document.getElementById(id)));
  }

  function installInteractionStability() {
    if (uiStability.installed) return;
    uiStability.installed = true;

    ['focusin', 'input', 'change', 'keydown', 'pointerdown'].forEach(type => {
      document.addEventListener(type, markInteraction, true);
    });
    document.addEventListener('touchstart', markInteraction, { capture: true, passive: true });

    document.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!isEditable(document.activeElement) && Date.now() - uiStability.lastInputAt > 1800) {
          uiStability.lastEditedHost = null;
        }
      }, 220);
    }, true);

    // Some periodic admin refreshes write calculated values back into the
    // same inputs every six seconds. Never overwrite a field being edited.
    if (!window.__plpStableValueGuard && typeof HTMLInputElement !== 'undefined') {
      const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      const guardedValueIds = new Set([
        'gdCollected', 'gdJackpot', 'gdPrizePool',
        'v19AdminName', 'v19SignupName'
      ]);
      if (valueDescriptor?.get && valueDescriptor?.set) {
        Object.defineProperty(HTMLInputElement.prototype, 'value', {
          configurable: true,
          enumerable: valueDescriptor.enumerable,
          get() {
            return valueDescriptor.get.call(this);
          },
          set(value) {
            const isCurrentField = document.activeElement === this;
            const isRecentEdit = Date.now() - uiStability.lastInputAt < 1800;
            if (guardedValueIds.has(this.id) && isCurrentField && isRecentEdit) return;
            valueDescriptor.set.call(this, value);
          }
        });
      }
      window.__plpStableValueGuard = true;
    }

    // The legacy stability layer calls scrollTo(0, y) after DOM mutations.
    // Ignore those automatic numeric scrolls while a field is being edited.
    if (!window.__plpStableScrollGuard) {
      window.__plpStableScrollGuard = true;
      window.scrollTo = function (...args) {
        const numericCall = args.length >= 2 && typeof args[0] === 'number';
        const activeInput = isEditable(document.activeElement);
        const recentInput = Date.now() - uiStability.lastInputAt < 1200;
        if (numericCall && (activeInput || recentInput)) return;
        return uiStability.nativeScrollTo(...args);
      };
    }

    // The admin panel is removed and recreated by the six-second refresh.
    // Hold the existing panel while the user is editing and discard that cycle.
    if (!Element.prototype.__plpStableRemovePatched) {
      const nativeRemove = uiStability.nativeRemove;
      const nativePrepend = uiStability.nativePrepend;

      Element.prototype.remove = function () {
        if (this.id === 'v19AdminRegistrations') {
          const gameDay = document.getElementById('gdContent');
          if (hostIsBeingEdited(this) || hostIsBeingEdited(gameDay)) {
            uiStability.heldAdminPanel = this;
            return;
          }
        }
        return nativeRemove.call(this);
      };

      Element.prototype.prepend = function (...nodes) {
        if (this.id === 'gdContent') {
          const incomingPanel = nodes.find(node => node instanceof Element && node.id === 'v19AdminRegistrations');
          if (incomingPanel) {
            const existing = document.getElementById('v19AdminRegistrations');
            if (existing?.isConnected && uiStability.heldAdminPanel === existing) {
              uiStability.heldAdminPanel = null;
              return;
            }

            const scrollY = window.scrollY;
            const result = nativePrepend.apply(this, nodes);
            requestAnimationFrame(() => {
              if (!isEditable(document.activeElement) && Math.abs(window.scrollY - scrollY) > 4) {
                uiStability.nativeScrollTo(0, scrollY);
              }
            });
            return result;
          }
        }
        return nativePrepend.apply(this, nodes);
      };

      Object.defineProperty(Element.prototype, '__plpStableRemovePatched', {
        value: true,
        configurable: true
      });
    }

    scanProtectedHosts();
    uiStability.observer = new MutationObserver(scanProtectedHosts);
    uiStability.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

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
    installInteractionStability();
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

  window.PLP_UI_STABILITY = uiStability;
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
