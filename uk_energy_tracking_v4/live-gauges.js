// V4 live tracker gauges and generation mix rendering.
function renderGauge(name,value){
    var cfg=GAUGES[name], svg=document.querySelector('[data-gauge="'+name+'"]'); if(!svg) return;
    var p=pct(value,cfg.min,cfg.max), end=-90+(180*p);
    var display=value===null||value===undefined||isNaN(value)?"—":(name==="carbon"?Math.round(value):fmt(value, name==="price"?0:2));
    svg.innerHTML='<path class="scada-gauge-bg" d="'+arcPath(30,115,80,-90,90)+'"></path>'+
      '<path class="scada-gauge-fill" style="color:'+cfg.colour+';stroke:'+cfg.colour+'" d="'+arcPath(30,115,80,-90,end)+'"></path>'+
      '<text class="scada-gauge-value" x="110" y="94">'+display+'</text>'+
      '<text class="scada-gauge-unit" x="110" y="120">'+cfg.unit+'</text>';
  }
  function renderMix(mix){
    var w=document.getElementById("scada-mix"); if(!Array.isArray(mix)){return;}
    w.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Math.abs(r.pct)));
      return '<div class="scada-mini"><div class="scada-mini-top"><div class="scada-mini-name">'+r.label+'</div><div class="scada-mini-value">'+fmt(r.gw)+' Gigawatts (GW) · '+fmt(r.pct)+'%</div></div>'+
        '<div class="scada-mini-track"><div class="scada-mini-fill" style="width:'+width+'%;background:'+r.color+';box-shadow:0 0 10px '+r.color+'"></div></div></div>';
    }).join("");
  }
  function ageMin(iso){return iso?(Date.now()-new Date(iso).getTime())/60000:Infinity;}
  function timeLabel(iso){return iso?new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Awaiting feed";}
  function dateLabel(iso){return iso?new Date(iso).toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}):"";}
  function latestIso(a,b,c){ var arr=[a,b,c].filter(Boolean).sort(function(x,y){return new Date(y)-new Date(x)}); return arr[0]||null; }
  function carbonValue(p){ return p.carbonGperKWh==null ? p.carbonForecast : p.carbonGperKWh; }
  function getJSON(u){return fetch(u+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return null;});}
  function setText(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
