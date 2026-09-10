// PLP Poker • Supabase public configuration
// Esta chave é pública/publishable e pode ser usada no frontend.
// Nunca coloque service_role ou qualquer chave secreta neste arquivo.
window.PLP_SUPABASE_CONFIG = {
  url: "https://rhgpecujwbsjhtawcoac.supabase.co",
  anonKey: "sb_publishable_elNr5qi_sEYm2ddiZZ9dLg_s_T4oCZM"
};

// Carrega o modo operacional V18 depois que a aplicação principal terminar de iniciar.
(function(){
  function loadV18(){
    if(document.querySelector('script[data-plp-v18]')) return;
    var s=document.createElement('script');
    s.src='app-v18.js?v=18';
    s.dataset.plpV18='1';
    document.body.appendChild(s);
  }
  if(document.readyState==='complete') setTimeout(loadV18,0);
  else window.addEventListener('load',loadV18,{once:true});
})();
