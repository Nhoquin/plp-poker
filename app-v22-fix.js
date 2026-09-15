/* PLP V23 • preserva o formulário sem prender o foco */
(() => {
  'use strict';

  let editingSignup = false;
  let draftName = '';
  let draftPaid = '0';

  const isSignupField = el => el && (el.id === 'v19SignupName' || el.id === 'v19SignupPaid');

  function sameName(a,b){
    return String(a||'').trim().toLocaleLowerCase('pt-BR') === String(b||'').trim().toLocaleLowerCase('pt-BR');
  }

  function draftAlreadyRegistered(){
    if(!draftName) return false;
    const entries = window.PLP_V19?.snapshot?.entries || [];
    return entries.some(e => sameName(e.name, draftName));
  }

  function captureDraft(){
    const name = document.getElementById('v19SignupName');
    const paid = document.getElementById('v19SignupPaid');
    if(name) draftName = name.value || '';
    if(paid) draftPaid = paid.value || '0';
  }

  function restoreDraft(){
    if(draftAlreadyRegistered()){
      draftName = '';
      draftPaid = '0';
      return;
    }

    const name = document.getElementById('v19SignupName');
    const paid = document.getElementById('v19SignupPaid');

    if(name && draftName && name.value !== draftName) name.value = draftName;
    if(paid && paid.value !== draftPaid) paid.value = draftPaid;

    // Importante: não chamamos focus() aqui.
    // O usuário precisa poder sair do campo Nome, abrir o seletor e tocar em Confirmar normalmente.
  }

  // O V19 refaz o conteúdo da tela a cada 6 segundos. Enquanto o usuário estiver
  // mexendo no formulário, bloqueamos apenas a troca do HTML dessa tela. O snapshot
  // continua atualizando em segundo plano.
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if(desc?.get && desc?.set && !Element.prototype.__plpV23SignupGuard){
    Object.defineProperty(Element.prototype, '__plpV23SignupGuard', {value:true, configurable:false});
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: desc.configurable,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value){
        if(this.id === 'stageLiveV19Body' && editingSignup){
          captureDraft();
          return;
        }
        return desc.set.call(this, value);
      }
    });
  }

  document.addEventListener('focusin', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('input', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('change', e => {
    if(!isSignupField(e.target)) return;
    editingSignup = true;
    captureDraft();
  }, true);

  document.addEventListener('focusout', e => {
    if(!isSignupField(e.target)) return;
    captureDraft();
    setTimeout(() => {
      if(!isSignupField(document.activeElement)) editingSignup = false;
    }, 250);
  }, true);

  // Se tocar no seletor logo após digitar o nome, mantém a proteção ativa sem
  // roubar o foco de volta para o campo Nome.
  document.addEventListener('pointerdown', e => {
    if(e.target?.closest?.('#v19SignupPaid')){
      captureDraft();
      editingSignup = true;
    }
    if(e.target?.closest?.('#v19SignupButton')){
      captureDraft();
      editingSignup = false;
    }
  }, true);

  const observer = new MutationObserver(() => restoreDraft());
  observer.observe(document.documentElement, {childList:true, subtree:true});
  restoreDraft();
})();
