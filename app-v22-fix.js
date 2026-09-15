/* PLP V22 • preserva o formulário de inscrição durante atualizações ao vivo */
(() => {
  'use strict';

  let editingSignup = false;
  let draftName = '';
  let draftPaid = '0';
  let selectionStart = null;
  let selectionEnd = null;

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
    if(name){
      draftName = name.value || '';
      if(document.activeElement === name){
        try{
          selectionStart = name.selectionStart;
          selectionEnd = name.selectionEnd;
        }catch(_){ }
      }
    }
    if(paid) draftPaid = paid.value || '0';
  }

  function restoreDraft(){
    if(draftAlreadyRegistered()){
      draftName = '';
      draftPaid = '0';
      selectionStart = selectionEnd = null;
      return;
    }

    const name = document.getElementById('v19SignupName');
    const paid = document.getElementById('v19SignupPaid');
    if(name && draftName && name.value !== draftName) name.value = draftName;
    if(paid && paid.value !== draftPaid) paid.value = draftPaid;

    if(editingSignup && name && document.activeElement !== name && draftName){
      requestAnimationFrame(() => {
        try{
          name.focus({preventScroll:true});
          if(selectionStart != null) name.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
        }catch(_){ }
      });
    }
  }

  // O V19 refaz o conteúdo da tela a cada 6 segundos. Enquanto o usuário está
  // digitando, impedimos somente essa troca de HTML para não derrubar o teclado
  // nem apagar o nome. O snapshot continua sendo atualizado em segundo plano.
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if(desc?.get && desc?.set && !Element.prototype.__plpV22SignupGuard){
    Object.defineProperty(Element.prototype, '__plpV22SignupGuard', {value:true, configurable:false});
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
    captureDraft();
  }, true);

  document.addEventListener('focusout', e => {
    if(!isSignupField(e.target)) return;
    captureDraft();
    setTimeout(() => {
      if(!isSignupField(document.activeElement)) editingSignup = false;
    }, 180);
  }, true);

  // Ao tocar em Confirmar, liberamos a renderização para que a inscrição concluída
  // atualize imediatamente a lista e os valores financeiros.
  document.addEventListener('pointerdown', e => {
    if(e.target?.closest?.('#v19SignupButton')){
      captureDraft();
      editingSignup = false;
    }
  }, true);

  const observer = new MutationObserver(() => restoreDraft());
  observer.observe(document.documentElement, {childList:true, subtree:true});
  restoreDraft();
})();
