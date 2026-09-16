/* PLP V26 • contas administrativas autorizadas */
(() => {
  'use strict';

  const AUTHORIZED_ADMIN_EMAILS = new Set([
    'franmfilho@gmail.com',
    'fabiocastelari@hotmail.com'
  ]);

  function toast(message){
    try{
      if(typeof showToast === 'function') return showToast(message);
    }catch(_){ }
    console.log('[PLP V26]', message);
  }

  async function handleCreateAdmin(){
    try{
      if(typeof backendReady === 'undefined' || !backendReady){
        toast('Backend ainda não configurado.');
        return;
      }
      if(typeof supa === 'undefined' || !supa){
        toast('Conexão com o servidor indisponível.');
        return;
      }

      const email=String(document.getElementById('adminEmail')?.value||'').trim().toLowerCase();
      const password=String(document.getElementById('adminPassword')?.value||'');

      if(!email || !password){
        toast('Informe e-mail e senha.');
        return;
      }
      if(!AUTHORIZED_ADMIN_EMAILS.has(email)){
        toast('Este e-mail não está autorizado como administrador.');
        return;
      }
      if(password.length<6){
        toast('Crie uma senha com pelo menos 6 caracteres.');
        return;
      }

      const button=document.getElementById('adminCreate');
      if(button){button.disabled=true;button.textContent='Criando acesso…';}

      const {data,error}=await supa.auth.signUp({
        email,
        password,
        options:{emailRedirectTo:'https://nhoquin.github.io/plp-poker/'}
      });

      if(error){
        const text=String(error.message||'').toLowerCase();
        if(text.includes('already') || text.includes('registered')){
          toast('Este acesso já existe. Use Entrar.');
        }else{
          toast('Não foi possível criar o acesso.');
        }
        return;
      }

      if(data?.session){
        if(typeof refreshAdminRole === 'function') await refreshAdminRole();
        toast(typeof isAdmin!=='undefined' && isAdmin ? 'Acesso administrativo criado e liberado.' : 'Acesso criado. Entre novamente para atualizar as permissões.');
      }else{
        const status=document.getElementById('adminAuthStatus');
        if(status){
          status.className='auth-status good';
          status.textContent='Cadastro criado. Confirme o e-mail recebido e depois entre no aplicativo.';
        }
        toast('Confira o e-mail para confirmar o cadastro.');
      }
    }catch(error){
      console.error(error);
      toast('Não foi possível criar o acesso administrativo.');
    }finally{
      const button=document.getElementById('adminCreate');
      if(button){button.disabled=false;button.textContent='Criar primeiro acesso';}
    }
  }

  function replaceCreateButton(){
    const original=document.getElementById('adminCreate');
    if(!original || original.dataset.plpV26==='1') return;
    const replacement=original.cloneNode(true);
    replacement.dataset.plpV26='1';
    original.replaceWith(replacement);
    replacement.addEventListener('click',handleCreateAdmin);
  }

  function updateHelpText(){
    const status=document.getElementById('adminAuthStatus');
    if(status && !status.dataset.plpV26){
      status.dataset.plpV26='1';
      status.title='Contas administrativas são liberadas somente para e-mails previamente autorizados.';
    }
  }

  function init(){
    replaceCreateButton();
    updateHelpText();
    const observer=new MutationObserver(()=>{
      replaceCreateButton();
      updateHelpText();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
