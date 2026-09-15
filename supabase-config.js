// PLP Poker • Supabase public configuration
// Esta chave é pública/publishable e pode ser usada no frontend.
// Nunca coloque service_role ou qualquer chave secreta neste arquivo.
window.PLP_SUPABASE_CONFIG = {
  url: "https://rhgpecujwbsjhtawcoac.supabase.co",
  anonKey: "sb_publishable_elNr5qi_sEYm2ddiZZ9dLg_s_T4oCZM"
};

window.PLP_BUILD = '21';

(function(){
  function bindAuthReload(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      try{
        if(typeof supa!=='undefined' && supa){
          clearInterval(timer);
          supa.auth.onAuthStateChange(function(event){
            if(event==='SIGNED_IN' && !sessionStorage.getItem('plpV18SignedReload')){
              sessionStorage.setItem('plpV18SignedReload','1');
              setTimeout(function(){ location.reload(); },250);
            }
            if(event==='SIGNED_OUT') sessionStorage.removeItem('plpV18SignedReload');
          });
        }
      }catch(e){}
      if(tries>80) clearInterval(timer);
    },100);
  }

  function installAutoUpdater(){
    if(!('serviceWorker' in navigator)) return;
    var reloading=false;

    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(reloading) return;
      reloading=true;
      location.reload();
    });

    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(function(reg){
      function check(){ try{ reg.update(); }catch(e){} }
      check();
      setInterval(check,15*60*1000);
      document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') check(); });

      reg.addEventListener('updatefound',function(){
        var worker=reg.installing;
        if(!worker) return;
        worker.addEventListener('statechange',function(){
          if(worker.state==='installed' && reg.waiting){
            try{ reg.waiting.postMessage('SKIP_WAITING'); }catch(e){}
          }
        });
      });

      if(reg.waiting){
        try{ reg.waiting.postMessage('SKIP_WAITING'); }catch(e){}
      }
    }).catch(function(){});
  }

  function loadTheme(){
    if(document.querySelector('link[data-plp-bg-v21]')) return;
    var l=document.createElement('link');
    l.rel='stylesheet';
    l.href='background-v21.css?v=21';
    l.dataset.plpBgV21='1';
    document.head.appendChild(l);
  }

  function loadV19(){
    if(document.querySelector('script[data-plp-v19]')) return;
    var s=document.createElement('script');
    s.src='app-v19.js?v=21';
    s.dataset.plpV19='1';
    document.body.appendChild(s);
  }

  function loadV18(){
    if(document.querySelector('script[data-plp-v18]')){
      bindAuthReload();
      loadV19();
      return;
    }
    var s=document.createElement('script');
    s.src='app-v18.js?v=21';
    s.dataset.plpV18='1';
    s.onload=function(){bindAuthReload();loadV19();};
    document.body.appendChild(s);
  }

  loadTheme();
  installAutoUpdater();
  if(document.readyState==='complete') setTimeout(loadV18,0);
  else window.addEventListener('load',loadV18,{once:true});
})();
