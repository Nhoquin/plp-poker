/* PLP V53 • modelo padrão da lista do WhatsApp no passo 1 do Dia de Jogo */
(() => {
  'use strict';

  const BUILD = '53';
  const DRAFT_PREFIX = 'plpV53GameDayTemplate:';
  const ADDRESS_KEY = 'plpV53HostAddresses';
  const DEFAULT_PIX_NAME = 'Charles';
  const DEFAULT_PIX_PHONE = '19997262074';
  const PLACEHOLDER_ADDRESS = 'Endereço do local (opcional)';
  const seededAddresses = { juninho: 'Rua Jose Capetti 119' };
  const state = { observer:null, patchTimer:null, loadingStageId:null };

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const comparable = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;'
  })[char]);
  const normalizeName = value => {
    const raw = clean(value);
    try { return typeof normalizePlayerName === 'function' ? normalizePlayerName(raw) : raw; }
    catch (_) { return raw; }
  };
  const selectedStageId = () => document.getElementById('gdStageSelect')?.value
    || window.PLP_V18?.selectedStageId
    || sessionStorage.getItem('plpV52TargetStageId')
    || window.PLP_V19?.snapshot?.stage?.id
    || null;

  function toast(message) {
    try { if (typeof showToast === 'function') return showToast(message); } catch (_) {}
    console.log('[PLP V53]', message);
  }

  function loadAddresses() {
    try {
      const stored = JSON.parse(localStorage.getItem(ADDRESS_KEY) || '{}');
      return { ...seededAddresses, ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch (_) {
      return { ...seededAddresses };
    }
  }

  function saveAddress(host, address) {
    const key = comparable(host);
    const value = clean(address);
    if (!key || !value || isPlaceholderAddress(value)) return;
    const addresses = loadAddresses();
    addresses[key] = value;
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(addresses));
  }

  function rememberedAddress(host) {
    return loadAddresses()[comparable(host)] || '';
  }

  function isPlaceholderAddress(value) {
    const normalized = comparable(value);
    return !normalized
      || normalized === comparable(PLACEHOLDER_ADDRESS)
      || normalized.includes('endereco do local')
      || normalized.includes('endereço do local');
  }

  function ddmm(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}` : String(value);
  }

  function isoDate(dayMonth, season = 2026) {
    const match = clean(dayMonth).match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!match) return '';
    let year = Number(match[3] || season || 2026);
    if (year < 100) year += 2000;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function moneyPlain(value) {
    return Number(value || 60).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }

  function stageHost(stage) {
    const existing = normalizeName(stage?.host_name || '');
    return existing || 'NOME DO ANFITRIÃO';
  }

  function stageAddress(stage, host) {
    const existing = clean(stage?.location || '');
    if (existing && comparable(existing) !== comparable(host) && !/^casa de\s+/i.test(existing)) return existing;
    return rememberedAddress(host) || PLACEHOLDER_ADDRESS;
  }

  function buildTemplate(stage) {
    const host = stageHost(stage);
    const address = stageAddress(stage, host);
    const br = String(stage?.championship || 'br4').replace(/[^0-9]/g, '') || '4';
    const stageNo = Number(stage?.stage_number) || 1;
    const date = ddmm(stage?.stage_date) || 'DD/MM';
    const buyIn = moneyPlain(stage?.buy_in || 60);
    return `PRIMEIRA LIGA DE POKER 
     CAMPEONATO ${stage?.season || 2026}    ♠️♥️♣️♦️

        🇧🇷BR ${br}
        🗓️ ${date}
        📌 Etapa ${stageNo}

        💵 Buy in:    R$${buyIn}
        🟡 Stack: 40K
        🕔 Pix até 17hrs: +5K
        🕢 Time chip 19:20: +5K 

        🏡 Local ${host}
        ${address}
            
        🏦 Pix ${DEFAULT_PIX_NAME}
        📲 ${DEFAULT_PIX_PHONE}
                 🗒️ Lista 

1 - ${host}`;
  }

  function localLineData(lines) {
    const index = lines.findIndex(line => /\bLocal\b/i.test(line));
    if (index < 0) return { index:-1, host:'', address:'' };
    const host = normalizeName(lines[index].replace(/^.*?\bLocal\b\s*/i, '').replace(/[•|]+$/g,'').trim());
    let address = '';
    for (let i = index + 1; i < lines.length; i += 1) {
      const line = clean(lines[i]);
      if (!line) continue;
      if (/^(?:🏦\s*)?Pix\b|^📲|\bLista\b/i.test(line)) break;
      address = line;
      break;
    }
    return { index, host, address };
  }

  function parseTemplate(text, stage) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/);
    const brMatch = raw.match(/\bBR\s*[-:]?\s*(\d+)/i);
    const stageMatch = raw.match(/\bEtapa\s*(\d+)/i);
    const dateMatch = raw.match(/(?:🗓️?\s*)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    const buyInMatch = raw.match(/Buy\s*-?\s*in\s*:?\s*R\$?\s*([\d.,]+)/i);
    const local = localLineData(lines);
    const firstPlayerMatch = raw.match(/^\s*1\s*[-.)–—:]\s*(.+?)\s*$/m);
    const host = normalizeName(local.host || firstPlayerMatch?.[1] || '');
    const address = clean(local.address);
    const date = isoDate(dateMatch?.[1] || '', Number(stage?.season) || 2026);
    const expectedBr = String(stage?.championship || '').replace(/[^0-9]/g, '');
    const expectedStage = Number(stage?.stage_number) || 0;
    const parsedBr = brMatch?.[1] || expectedBr;
    const parsedStage = Number(stageMatch?.[1] || expectedStage);
    const mismatch = (expectedBr && parsedBr && String(parsedBr) !== String(expectedBr))
      || (expectedStage && parsedStage && parsedStage !== expectedStage);
    const location = !isPlaceholderAddress(address) ? address : (host ? `Casa de ${host}` : '');
    const buyIn = Number(String(buyInMatch?.[1] || stage?.buy_in || 60).replace(/\./g,'').replace(',','.')) || 60;
    return { br:parsedBr, stageNumber:parsedStage, date, host, address, location, buyIn, mismatch };
  }

  function replaceAddressLine(lines, localIndex, address) {
    if (localIndex < 0) return lines;
    let target = -1;
    for (let i = localIndex + 1; i < lines.length; i += 1) {
      const value = clean(lines[i]);
      if (!value) continue;
      if (/^(?:🏦\s*)?Pix\b|^📲|\bLista\b/i.test(value)) break;
      target = i;
      break;
    }
    const indent = '        ';
    if (target >= 0) lines[target] = `${indent}${address}`;
    else lines.splice(localIndex + 1, 0, `${indent}${address}`);
    return lines;
  }

  function synchronizeHost(text, previousHost = '') {
    const lines = String(text || '').split(/\r?\n/);
    const local = localLineData(lines);
    if (!local.host) return String(text || '');

    const playerIndex = lines.findIndex(line => /^\s*1\s*[-.)–—:]\s*/.test(line));
    if (playerIndex >= 0) {
      const indent = lines[playerIndex].match(/^\s*/)?.[0] || '';
      lines[playerIndex] = `${indent}1 - ${local.host}`;
    }

    if (previousHost && comparable(previousHost) !== comparable(local.host)) {
      const address = rememberedAddress(local.host) || PLACEHOLDER_ADDRESS;
      replaceAddressLine(lines, local.index, address);
    }
    return lines.join('\n');
  }

  async function fetchStage(stageId) {
    if (!stageId || typeof supa === 'undefined' || !supa) return null;
    const {data,error} = await supa.from('stages').select('*').eq('id', stageId).maybeSingle();
    return error ? null : data;
  }

  function setPreview(result, stage) {
    const preview = document.getElementById('v53TemplatePreview');
    if (!preview) return;
    if (!result.date || result.host.length < 2) {
      preview.className = 'v53-template-preview bad';
      preview.textContent = 'Informe uma data válida e o nome após “Local”.';
      return;
    }
    if (result.mismatch) {
      preview.className = 'v53-template-preview bad';
      preview.textContent = `A lista precisa continuar em ${String(stage.championship).toUpperCase()} • Etapa ${stage.stage_number}.`;
      return;
    }
    preview.className = 'v53-template-preview good';
    preview.innerHTML = `<b>Será interpretado:</b> ${escapeHtml(result.date.split('-').reverse().join('/'))} • anfitrião ${escapeHtml(result.host)} • local ${escapeHtml(result.location)}.`;
  }

  function applyParsedToLegacy(result) {
    const date = document.getElementById('v52StageDate');
    const location = document.getElementById('v52Location');
    const host = document.getElementById('v52Host');
    if (date) date.value = result.date;
    if (location) location.value = result.location;
    if (host) host.value = result.host;
  }

  function updateVersionLabel() {
    document.querySelectorAll('.muted.small').forEach(element => {
      if (/Versão\s+\d+.*Temporada\s+2026/i.test(element.textContent || '')) {
        element.textContent = `Versão ${BUILD} • Temporada 2026`;
      }
    });
  }

  async function patchSetup() {
    updateVersionLabel();
    const setup = document.querySelector('#v52GameFlow .v52-setup');
    const form = setup?.querySelector('.v52-form-grid');
    if (!setup || !form || setup.dataset.v53Template === '1') return;
    const stageId = selectedStageId();
    if (!stageId || state.loadingStageId === stageId) return;
    state.loadingStageId = stageId;
    const stage = await fetchStage(stageId);
    state.loadingStageId = null;
    if (!stage || !setup.isConnected || setup.dataset.v53Template === '1') return;

    const saved = sessionStorage.getItem(`${DRAFT_PREFIX}${stage.id}`);
    const template = saved || buildTemplate(stage);
    form.style.display = 'none';
    setup.dataset.v53Template = '1';
    setup.insertAdjacentHTML('afterbegin', `<div class="v53-template-block">
      <div class="v53-template-head"><div><h4>Modelo da lista do WhatsApp</h4><p>O aplicativo já preenche BR, etapa, valores e dados do Pix. Altere somente a <b>data</b> e o nome depois de <b>Local</b>. O jogador nº 1 será sincronizado automaticamente.</p></div><button type="button" class="v53-reset" id="v53ResetTemplate">Restaurar padrão</button></div>
      <textarea class="v53-template-text" id="v53GameDayTemplate" spellcheck="false" aria-label="Modelo da lista do WhatsApp">${escapeHtml(template)}</textarea>
      <div class="v53-template-preview" id="v53TemplatePreview" aria-live="polite"></div>
      <div class="v53-template-help">O endereço é opcional. O aplicativo memoriza o endereço de cada anfitrião; quando não houver endereço cadastrado, usa “Casa de + nome do anfitrião”.</div>
    </div>`);

    const textarea = document.getElementById('v53GameDayTemplate');
    let lastHost = parseTemplate(textarea.value, stage).host;
    const update = () => {
      const synchronized = synchronizeHost(textarea.value, lastHost);
      if (synchronized !== textarea.value) {
        const position = textarea.selectionStart;
        textarea.value = synchronized;
        textarea.setSelectionRange(Math.min(position, synchronized.length), Math.min(position, synchronized.length));
      }
      const result = parseTemplate(textarea.value, stage);
      if (result.host) lastHost = result.host;
      applyParsedToLegacy(result);
      setPreview(result, stage);
      sessionStorage.setItem(`${DRAFT_PREFIX}${stage.id}`, textarea.value);
    };
    textarea.addEventListener('input', update);
    textarea.addEventListener('change', update);
    document.getElementById('v53ResetTemplate')?.addEventListener('click', () => {
      textarea.value = buildTemplate(stage);
      lastHost = parseTemplate(textarea.value, stage).host;
      update();
      textarea.focus();
      toast('Modelo restaurado com os dados da etapa selecionada.');
    });
    const save = document.getElementById('v52SaveSetup');
    if (save) save.textContent = 'Interpretar modelo e abrir inscrições';
    update();
  }

  function interceptSave(event) {
    const button = event.target.closest?.('#v52SaveSetup');
    const textarea = document.getElementById('v53GameDayTemplate');
    if (!button || !textarea) return;
    const stageId = selectedStageId();
    const legacyHandler = button.onclick;
    event.preventDefault();
    event.stopImmediatePropagation();

    (async () => {
      const stage = await fetchStage(stageId);
      if (!stage) return toast('Não foi possível carregar a etapa selecionada.');
      const result = parseTemplate(textarea.value, stage);
      setPreview(result, stage);
      if (result.mismatch) return toast(`Use o modelo de ${String(stage.championship).toUpperCase()} • Etapa ${stage.stage_number}.`);
      if (!result.date || result.host.length < 2) return toast('Informe a data e o anfitrião no modelo da lista.');
      applyParsedToLegacy(result);
      saveAddress(result.host, result.address);
      sessionStorage.setItem(`${DRAFT_PREFIX}${stage.id}`, textarea.value);
      if (typeof legacyHandler === 'function') legacyHandler.call(button);
      else toast('Os dados foram interpretados, mas o botão ainda está carregando. Tente novamente.');
    })().catch(error => {
      console.error('[PLP V53] interpretar modelo', error);
      toast('Não foi possível interpretar o modelo da lista.');
    });
  }

  function installStyles() {
    if (document.getElementById('plpV53TemplateStyles')) return;
    const style = document.createElement('style');
    style.id = 'plpV53TemplateStyles';
    style.textContent = `
      .v53-template-block{display:grid;gap:9px}.v53-template-head{display:flex;align-items:flex-start;gap:10px}.v53-template-head>div{flex:1}.v53-template-head h4{margin:0;color:#ffe36a;font-size:14px}.v53-template-head p{margin:4px 0 0;color:#c9c0ad;font-size:9px;line-height:1.5}.v53-reset{flex:none;border:1px solid rgba(244,201,20,.24);background:rgba(244,201,20,.06);color:#ffe36a;border-radius:11px;padding:8px 9px;font-size:8px;font-weight:900}
      .v53-template-text{width:100%;min-height:430px;resize:vertical;border:1px solid rgba(244,201,20,.22);border-radius:15px;background:#090806;color:#fff;padding:13px;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;overflow:auto;outline:none}.v53-template-text:focus{border-color:#f4c914;box-shadow:0 0 0 2px rgba(244,201,20,.09)}
      .v53-template-preview{padding:9px 10px;border-radius:12px;font-size:9px;line-height:1.45}.v53-template-preview.good{border:1px solid rgba(123,230,179,.25);background:rgba(123,230,179,.07);color:#c9f8df}.v53-template-preview.bad{border:1px solid rgba(255,158,158,.24);background:rgba(255,158,158,.07);color:#ffd1d1}.v53-template-help{color:#aaa18f;font-size:8px;line-height:1.45}
      @media(max-width:520px){.v53-template-head{display:grid}.v53-reset{justify-self:start}.v53-template-text{min-height:470px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function schedulePatch() {
    clearTimeout(state.patchTimer);
    state.patchTimer = setTimeout(() => patchSetup().catch(error => console.warn('[PLP V53] patch', error)), 80);
  }

  function init() {
    installStyles();
    updateVersionLabel();
    document.addEventListener('click', interceptSave, true);
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-go="gameDay"]') || event.target.closest?.('#v52EditSetup')) {
        setTimeout(schedulePatch, 160);
      }
    }, true);
    state.observer = new MutationObserver(schedulePatch);
    state.observer.observe(document.body, { childList:true, subtree:true });
    schedulePatch();
    console.info('PLP Poker V53 • modelo da lista no Dia de Jogo');
  }

  window.PLP_V53_LIST_TEMPLATE = {
    build:BUILD,
    buildTemplate,
    parseTemplate,
    synchronizeHost,
    patch:patchSetup
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
