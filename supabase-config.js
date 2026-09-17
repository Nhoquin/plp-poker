// PLP Poker • Supabase public configuration
// Esta chave é pública/publishable e pode ser usada no frontend.
// Nunca coloque service_role ou qualquer chave secreta neste arquivo.
window.PLP_SUPABASE_CONFIG = {
  url: "https://rhgpecujwbsjhtawcoac.supabase.co",
  anonKey: "sb_publishable_elNr5qi_sEYm2ddiZZ9dLg_s_T4oCZM"
};

window.PLP_BUILD = '32';

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
    if(!document.querySelector('link[data-plp-bg-v21]')){
      var l=document.createElement('link');
      l.rel='stylesheet';
      l.href='background-v21.css?v=32';
      l.dataset.plpBgV21='1';
      document.head.appendChild(l);
    }

    if(!document.querySelector('link[data-plp-home-clean-v31]')){
      var h=document.createElement('link');
      h.rel='stylesheet';
      h.href='home-clean-v31.css?v=32';
      h.dataset.plpHomeCleanV31='1';
      document.head.appendChild(h);
    }

    if(!document.querySelector('link[data-plp-theme-v32]')){
      var t=document.createElement('link');
      t.rel='stylesheet';
      t.href='theme-v32.css?v=32';
      t.dataset.plpThemeV32='1';
      document.head.appendChild(t);
    }
  }

  function loadFinanceOverviewV32(){
    if(document.querySelector('script[data-plp-finance-overview-v32]')) return;
    var f32=document.createElement('script');
    f32.src='finance-overview-v32.js?v=32';
    f32.dataset.plpFinanceOverviewV32='1';
    document.body.appendChild(f32);
  }

  function loadFinanceV30(){
    if(document.querySelector('script[data-plp-finance-v30]')){
      loadFinanceOverviewV32();
      return;
    }
    var f30=document.createElement('script');
    f30.src='finance-v30.js?v=32';
    f30.dataset.plpFinanceV30='1';
    f30.onload=loadFinanceOverviewV32;
    document.body.appendChild(f30);
  }

  function loadStabilityV29(){
    if(document.querySelector('script[data-plp-stability-v29]')){
      loadFinanceV30();
      return;
    }
    var y=document.createElement('script');
    y.src='stability-v29.js?v=32';
    y.dataset.plpStabilityV29='1';
    y.onload=loadFinanceV30;
    document.body.appendChild(y);
  }

  function loadFinaleV28(){
    if(document.querySelector('script[data-plp-finale-v28]')){
      loadStabilityV29();
      return;
    }
    var z=document.createElement('script');
    z.src='finale-v28.js?v=32';
    z.dataset.plpFinaleV28='1';
    z.onload=loadStabilityV29;
    document.body.appendChild(z);
  }

  function loadQuickAdminV27(){
    if(document.querySelector('script[data-plp-quick-admin-v27]')){
      loadFinaleV28();
      return;
    }
    var q=document.createElement('script');
    q.src='quick-admin-v27.js?v=32';
    q.dataset.plpQuickAdminV27='1';
    q.onload=loadFinaleV28;
    document.body.appendChild(q);
  }

  function loadAdminAccessV26(){
    if(document.querySelector('script[data-plp-admin-access-v26]')){
      loadQuickAdminV27();
      return;
    }
    var x=document.createElement('script');
    x.src='admin-access-v26.js?v=32';
    x.dataset.plpAdminAccessV26='1';
    x.onload=loadQuickAdminV27;
    document.body.appendChild(x);
  }

  function loadEliminationsV25(){
    if(document.querySelector('script[data-plp-elimination-v25]')){
      loadAdminAccessV26();
      return;
    }
    var e=document.createElement('script');
    e.src='elimination-v25.js?v=32';
    e.dataset.plpEliminationV25='1';
    e.onload=loadAdminAccessV26;
    document.body.appendChild(e);
  }

  function loadClockAdminV24(){
    if(document.querySelector('script[data-plp-clock-admin-v24]')){
      loadEliminationsV25();
      return;
    }
    var a=document.createElement('script');
    a.src='clock-admin-v24.js?v=32';
    a.dataset.plpClockAdminV24='1';
    a.onload=loadEliminationsV25;
    document.body.appendChild(a);
  }

  function loadClockV24(){
    if(document.querySelector('script[data-plp-clock-v24]')){
      loadClockAdminV24();
      return;
    }
    var c=document.createElement('script');
    c.src='clock-v24.js?v=32';
    c.dataset.plpClockV24='1';
    c.onload=loadClockAdminV24;
    document.body.appendChild(c);
  }

  function loadV22Fix(){
    if(document.querySelector('script[data-plp-v22-fix]')){
      loadClockV24();
      return;
    }
    var f=document.createElement('script');
    f.src='app-v22-fix.js?v=32';
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
    s.src='app-v19.js?v=32';
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
    s.src='app-v18.js?v=32';
    s.dataset.plpV18='1';
    s.onload=function(){bindAuthReload();loadV19();};
    document.body.appendChild(s);
  }

  loadTheme();
  installAutoUpdater();
  if(document.readyState==='complete') setTimeout(loadV18,0);
  else window.addEventListener('load',loadV18,{once:true});
})();
