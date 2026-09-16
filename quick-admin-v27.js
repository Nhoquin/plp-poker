/* PLP V27 • acesso rápido ao Admin por usuário + aprovação de aparelho */
(() => {
  'use strict';

  const cfg = window.PLP_SUPABASE_CONFIG || {};
  const ENDPOINT = cfg.url ? `${cfg.url}/functions/v1/plp-quick-admin` : '';
  let pollTimer = null;
  let adminRefreshTimer = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (m) => { try { if (typeof showToast === 'function') return showToast(m); } catch (_) {} console.log('[PLP V27]', m); };

  function getDeviceId(){
    let id = localStorage.getItem('plpQuickDeviceIdV27');
    if(!id){
      if(globalThis.crypto?.randomUUID) id = crypto.randomUUID() + '-' + crypto.randomUUID();
      else id = 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem('plpQuickDeviceIdV27', id);
    }
    return id;
  }

  async function callApi(action, payload = {}, auth = false){
    if(!ENDPOINT || !cfg.anonKey) throw new Error('Backend indisponível.');
    const headers = {'Content-Type':'application/json','apikey':cfg.anonKey};
    if(auth){
      if(typeof supa === 'undefined' || !supa) throw new Error('Sessão administrativa indisponível.');
      const {data} = await supa.auth.getSession();
      const token = data?.session?.access_token;
      if(!token) throw new Error('Entre como administrador para continuar.');
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(ENDPOINT, {method:'POST', headers, body:JSON.stringify({action, ...payload})});
    let data = {};
    try{ data = await res.json(); }catch(_){ }
    if(!res.ok) throw new Error(data?.message || 'Não foi possível concluir a operação.');
    return data;
  }

  function injectStyles(){
    if(document.getElementById('quickAdminV27Styles')) return;
    const s = document.createElement('style');
    s.id = 'quickAdminV27Styles';
    s.textContent = `
      .qa27-box{margin:14px 0;padding:14px;border:1px solid rgba(244,201,20,.24);border-radius:18px;background:linear-gradient(145deg,rgba(31,25,13,.78),rgba(9,9,8,.92))}
      .qa27-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.qa27-title b{color:var(--gold2,#ffe36a)}
      .qa27-sub{font-size:10px;color:var(--muted,#c5bcaa);line-height:1.45;margin-bottom:10px}
      .qa27-row{display:flex;gap:8px;align-items:center}.qa27-row input{flex:1;min-width:0}
      .qa27-status{margin-top:9px;font-size:10px;color:var(--muted,#c5bcaa);min-height:16px}.qa27-status.good{color:var(--good,#7be6b3)}.qa27-status.warn{color:var(--gold2,#ffe36a)}.qa27-status.bad{color:var(--bad,#ff9e9e)}
      .qa27-sep{display:flex;align-items:center;gap:8px;margin:12px 0 8px;color:var(--muted,#c5bcaa);font-size:9px;text-transform:uppercase;letter-spacing:.8px}.qa27-sep:before,.qa27-sep:after{content:'';height:1px;flex:1;background:rgba(255,255,255,.08)}
      .qa27-admin-list{margin-top:12px;display:grid;gap:8px}.qa27-item{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px;background:rgba(5,5,4,.34)}
      .qa27-item-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.qa27-item b{font-size:11px}.qa27-item small{display:block;color:var(--muted,#c5bcaa);font-size:9px;margin-top:3px;word-break:break-word}
      .qa27-badge{font-size:8px;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.12);white-space:nowrap}.qa27-badge.on{color:var(--good,#7be6b3)}.qa27-badge.pending{color:var(--gold2,#ffe36a)}
      .qa27-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.qa27-actions button{padding:7px 9px;font-size:9px}
      .qa27-section{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
    `;
    document.head.appendChild(s);
  }

  function injectLogin(){
    const card = document.getElementById('authCard');
    if(!card || document.getElementById('quickLoginV27')) return;
    const fields = card.querySelector('.auth-fields');
    if(!fields) return;
    const box = document.createElement('div');
    box.id = 'quickLoginV27';
    box.className = 'qa27-box';
    box.innerHTML = `
      <div class="qa27-title"><b>Acesso rápido</b><span class="qa27-badge on">SEM SENHA</span></div>
      <div class="qa27-sub">Digite apenas o usuário autorizado. No primeiro uso deste aparelho, o administrador precisa aprová-lo uma vez.</div>
      <div class="qa27-row">
        <input class="v18-input" id="quickAdminUsernameV27" autocomplete="username" autocapitalize="none" placeholder="Usuário">
        <button class="btn gold" type="button" id="quickAdminEnterV27">Entrar</button>
      </div>
      <div class="qa27-status" id="quickLoginStatusV27"></div>
    `;
    fields.parentNode.insertBefore(box, fields);
    const sep = document.createElement('div');
    sep.className = 'qa27-sep';
    sep.textContent = 'Acesso de contingência por e-mail';
    fields.parentNode.insertBefore(sep, fields);

    const saved = localStorage.getItem('plpQuickUsernameV27');
    if(saved) document.getElementById('quickAdminUsernameV27').value = saved;
    document.getElementById('quickAdminEnterV27').addEventListener('click', quickLogin);
    document.getElementById('quickAdminUsernameV27').addEventListener('keydown', e => { if(e.key === 'Enter') quickLogin(); });
  }

  function injectAdminManager(){
    const grid = document.querySelector('#leagueTools .v18-tools-grid');
    if(!grid || document.getElementById('quickAdminManagerV27')) return;
    const card = document.createElement('div');
    card.className = 'v18-card v18-tool';
    card.id = 'quickAdminManagerV27';
    card.innerHTML = `
      <h3>Usuários do Admin</h3>
      <p>Cadastre um usuário sem senha. Cada aparelho novo precisa da sua aprovação apenas na primeira vez.</p>
      <div class="v18-field"><input class="v18-input" id="quickNewUserV27" autocapitalize="none" placeholder="Usuário, ex.: fabio"></div>
      <div class="v18-actions"><button class="btn gold" id="quickAddUserV27" type="button">Adicionar usuário</button><button class="btn ghost" id="quickRefreshV27" type="button">Atualizar</button></div>
      <div id="quickAdminDataV27"><div class="empty-state">Abra esta área como administrador para carregar os acessos.</div></div>
    `;
    grid.insertBefore(card, grid.firstChild);
    document.getElementById('quickAddUserV27').addEventListener('click', createQuickUser);
    document.getElementById('quickRefreshV27').addEventListener('click', loadAdminData);
    document.getElementById('quickNewUserV27').addEventListener('keydown', e => { if(e.key === 'Enter') createQuickUser(); });
  }

  function setLoginStatus(text, cls=''){
    const el = document.getElementById('quickLoginStatusV27');
    if(!el) return;
    el.className = `qa27-status ${cls}`.trim();
    el.textContent = text || '';
  }

  async function finishQuickLogin(data){
    if(!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Sessão não recebida.');
    localStorage.setItem('plpQuickUsernameV27', data.username || '');
    sessionStorage.setItem('plpQuickGoAdminV27','1');
    setLoginStatus(`Acesso liberado para ${data.display_name || data.username}.`, 'good');
    const {error} = await supa.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
    if(error) throw error;
    try{ if(typeof refreshAdminRole === 'function') await refreshAdminRole(); }catch(_){ }
    try{ if(typeof setAdminUI === 'function') setAdminUI(); }catch(_){ }
    toast('Acesso administrativo liberado.');
    try{ if(typeof goTo === 'function') goTo('admin'); }catch(_){ }
  }

  async function doQuickLogin(username, silent=false){
    const data = await callApi('login',{username,device_id:getDeviceId()},false);
    if(data.status === 'approved'){
      stopPoll();
      await finishQuickLogin(data);
      return 'approved';
    }
    if(data.status === 'pending'){
      if(!silent) setLoginStatus('Solicitação enviada. Aguarde o administrador aprovar este aparelho.', 'warn');
      startPoll(username);
      return 'pending';
    }
    return data.status || 'unknown';
  }

  async function quickLogin(){
    const input = document.getElementById('quickAdminUsernameV27');
    const btn = document.getElementById('quickAdminEnterV27');
    const username = String(input?.value || '').trim();
    if(username.length < 3){ setLoginStatus('Digite o usuário cadastrado.', 'bad'); return; }
    if(btn){ btn.disabled = true; btn.textContent = 'Entrando…'; }
    setLoginStatus('Verificando acesso…');
    try{ await doQuickLogin(username, false); }
    catch(e){ setLoginStatus(e.message || 'Não foi possível entrar.', 'bad'); }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'Entrar'; } }
  }

  function startPoll(username){
    stopPoll();
    let tries = 0;
    pollTimer = setInterval(async()=>{
      tries++;
      if(tries > 45){ stopPoll(); setLoginStatus('A aprovação ainda está pendente. Toque em Entrar novamente depois que o administrador aprovar.', 'warn'); return; }
      try{ await doQuickLogin(username, true); }catch(_){ }
    },4000);
  }
  function stopPoll(){ if(pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

  async function createQuickUser(){
    const input = document.getElementById('quickNewUserV27');
    const btn = document.getElementById('quickAddUserV27');
    const name = String(input?.value || '').trim();
    if(name.length < 3){ toast('Digite um usuário com pelo menos 3 caracteres.'); return; }
    if(btn){ btn.disabled=true; btn.textContent='Criando…'; }
    try{
      const data = await callApi('create_user',{username:name,display_name:name},true);
      input.value='';
      toast(`Usuário ${data.username} liberado.`);
      await loadAdminData();
    }catch(e){ toast(e.message || 'Não foi possível criar o usuário.'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='Adicionar usuário'; } }
  }

  async function setUserActive(username, active){
    try{ await callApi('set_active',{username,active},true); toast(active?'Usuário ativado.':'Usuário desativado.'); await loadAdminData(); }
    catch(e){ toast(e.message || 'Não foi possível alterar o usuário.'); }
  }

  async function decideDevice(id, approve){
    try{ await callApi(approve?'approve_device':'deny_device',{id},true); toast(approve?'Aparelho aprovado.':'Solicitação negada.'); await loadAdminData(); }
    catch(e){ toast(e.message || 'Não foi possível alterar a solicitação.'); }
  }

  function fmtDate(value){
    if(!value) return '—';
    try{ return new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(_){ return '—'; }
  }

  async function loadAdminData(){
    const host = document.getElementById('quickAdminDataV27');
    if(!host) return;
    try{
      if(typeof isAdmin !== 'undefined' && !isAdmin){ host.innerHTML='<div class="empty-state">Entre como administrador para gerenciar usuários.</div>'; return; }
      host.innerHTML='<div class="empty-state">Carregando…</div>';
      const data = await callApi('list',{},true);
      const users = data.users || [];
      const pending = (data.requests || []).filter(x=>x.status==='pending');
      const approved = (data.requests || []).filter(x=>x.status==='approved');
      const usersHtml = users.length ? users.map(u=>`
        <div class="qa27-item">
          <div class="qa27-item-top"><div><b>${esc(u.display_name || u.username)}</b><small>@${esc(u.username)}</small></div><span class="qa27-badge ${u.active?'on':''}">${u.active?'ATIVO':'DESATIVADO'}</span></div>
          <div class="qa27-actions"><button class="btn ghost qa27-toggle" data-user="${esc(u.username)}" data-active="${u.active?'0':'1'}">${u.active?'Desativar':'Ativar'}</button></div>
        </div>`).join('') : '<div class="empty-state">Nenhum usuário rápido cadastrado.</div>';
      const pendingHtml = pending.length ? pending.map(r=>`
        <div class="qa27-item">
          <div class="qa27-item-top"><div><b>@${esc(r.username)}</b><small>Novo aparelho • solicitado ${fmtDate(r.requested_at)}</small></div><span class="qa27-badge pending">PENDENTE</span></div>
          <div class="qa27-actions"><button class="btn gold qa27-approve" data-id="${esc(r.id)}">Aprovar aparelho</button><button class="btn ghost qa27-deny" data-id="${esc(r.id)}">Negar</button></div>
        </div>`).join('') : '<div class="empty-state">Nenhum aparelho aguardando aprovação.</div>';
      const approvedHtml = approved.length ? approved.slice(0,8).map(r=>`<div class="qa27-item"><div class="qa27-item-top"><div><b>@${esc(r.username)}</b><small>Aprovado • último acesso ${fmtDate(r.last_login_at)}</small></div><span class="qa27-badge on">APROVADO</span></div></div>`).join('') : '<div class="empty-state">Nenhum aparelho aprovado ainda.</div>';
      host.innerHTML = `
        <div class="qa27-section"><b style="font-size:11px">Usuários liberados</b><div class="qa27-admin-list">${usersHtml}</div></div>
        <div class="qa27-section"><b style="font-size:11px">Aguardando sua aprovação</b><div class="qa27-admin-list">${pendingHtml}</div></div>
        <div class="qa27-section"><b style="font-size:11px">Aparelhos aprovados</b><div class="qa27-admin-list">${approvedHtml}</div></div>`;
      host.querySelectorAll('.qa27-toggle').forEach(b=>b.addEventListener('click',()=>setUserActive(b.dataset.user,b.dataset.active==='1')));
      host.querySelectorAll('.qa27-approve').forEach(b=>b.addEventListener('click',()=>decideDevice(b.dataset.id,true)));
      host.querySelectorAll('.qa27-deny').forEach(b=>b.addEventListener('click',()=>decideDevice(b.dataset.id,false)));
    }catch(e){ host.innerHTML=`<div class="empty-state">${esc(e.message || 'Não foi possível carregar.')}</div>`; }
  }

  async function resumeAdminAfterLogin(){
    if(sessionStorage.getItem('plpQuickGoAdminV27')!=='1') return;
    sessionStorage.removeItem('plpQuickGoAdminV27');
    try{
      if(typeof refreshAdminRole === 'function') await refreshAdminRole();
      if(typeof isAdmin === 'undefined' || isAdmin){
        if(typeof setAdminUI === 'function') setAdminUI();
        if(typeof goTo === 'function') goTo('admin');
      }
    }catch(_){ }
  }

  function ensureUi(){ injectStyles(); injectLogin(); injectAdminManager(); }

  function bindNavigationRefresh(){
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-go="leagueTools"]')) setTimeout(loadAdminData,450);
    });
    const obs = new MutationObserver(()=>ensureUi());
    obs.observe(document.documentElement,{childList:true,subtree:true});
    ensureUi();
    setTimeout(resumeAdminAfterLogin,700);
    adminRefreshTimer = setInterval(()=>{
      try{ if(document.getElementById('leagueTools')?.classList.contains('active')) loadAdminData(); }catch(_){ }
    },15000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindNavigationRefresh,{once:true});
  else bindNavigationRefresh();
})();
