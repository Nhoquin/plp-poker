// PLP Poker • Supabase public configuration
// Esta chave é pública/publishable e pode ser usada no frontend.
// Nunca coloque service_role ou qualquer chave secreta neste arquivo.
window.PLP_SUPABASE_CONFIG = {
  url: "https://rhgpecujwbsjhtawcoac.supabase.co",
  anonKey: "sb_publishable_elNr5qi_sEYm2ddiZZ9dLg_s_T4oCZM"
};

window.PLP_BUILD = '24';

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

    var applying=false;
    function removeBanner(){
      var old=document.getElementById('plpUpdateReadyV24');
      if(old) old.remove();
    }
    function showBanner(reg){
      if(!reg || !reg.waiting || document.getElementById('plpUpdateReadyV24')) return;
      var btn=document.createElement('button');
      btn.id='plpUpdateReadyV24';
      btn.type='button';
      btn.textContent='Nova versão disponível • Atualizar quando puder';
      btn.style.cssText='position:fixed;left:12px;right:12px;bottom:82px;z-index:9999;padding:11px 14px;border-radius:14px;border:1px solid rgba(244,201,20,.5);background:#17130b;color:#ffe36a;font:700 11px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35)';
      btn.addEventListener('click',function(){
        if(!reg.waiting || applying) return;
        applying=true;
        btn.disabled=true;
        btn.textContent='Aplicando atualização…';
        sessionStorage.setItem('plpApplyUpdateV24','1');
        try{ reg.waiting.postMessage('PLP_APPLY_UPDATE'); }catch(e){ applying=false; btn.disabled=false; }
      });
      document.body.appendChild(btn);
    }

    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(sessionStorage.getItem('plpApplyUpdateV24')==='1'){
        sessionStorage.removeItem('plpApplyUpdateV24');
        location.reload();
      }
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
          if(worker.state==='installed' && reg.waiting) showBanner(reg);
        });
      });

      if(reg.waiting) showBanner(reg);
      navigator.serviceWorker.addEventListener('controllerchange',removeBanner);
    }).catch(function(){});
  }

  function loadTheme(){
    if(document.querySelector('link[data-plp-bg-v21]')) return;
    var l=document.createElement('link');
    l.rel='stylesheet';
    l.href='background-v21.css?v=24';
    l.dataset.plpBgV21='1';
    document.head.appendChild(l);
  }

  function loadClockV24(){
    if(document.querySelector('script[data-plp-clock-v24]')) return;
    var c=document.createElement('script');
    c.src='clock-v24.js?v=24';
    c.dataset.plpClockV24='1';
    document.body.appendChild(c);
  }

  function loadV22Fix(){
    if(document.querySelector('script[data-plp-v22-fix]')){
      loadClockV24();
      return;
    }
    var f=document.createElement('script');
    f.src='app-v22-fix.js?v=23';
    f.dataset.plpV22Fix='1';
    f.onload=loadClockV24;
    document.body.appendChild(f);
  }

  function loadV19(){
    if(document.querySelector('script[data-plp-v19]')){
      loadV22Fix();
      return;
    }
    var s=document.createElement('script');
    s.src='app-v19.js?v=23';
    s.dataset.plpV19='1';
    s.onload=loadV22Fix;
    document.body.appendChild(s);
  }

  function loadV18(){
    if(document.querySelector('script[data-plp-v18]')){
      bindAuthReload();
      loadV19();
      return;
    }
    var s=document.createElement('script');
    s.src='app-v18.js?v=23';
    s.dataset.plpV18='1';
    s.onload=function(){bindAuthReload();loadV19();};
    document.body.appendChild(s);
  }

  loadTheme();
  installAutoUpdater();
  if(document.readyState==='complete') setTimeout(loadV18,0);
  else window.addEventListener('load',loadV18,{once:true});
})();
