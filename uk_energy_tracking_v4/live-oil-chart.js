// V4 live tracker oil history chart.
var oilChartState = { rows: [], x: null, y: null, canvas: null, activeIndex: null, min: 0, max: 0, pad: 54 };
  function rangeCutoff(range){
    if(range === "all") return null;
    var d = new Date();
    if(range === "7d") d.setDate(d.getDate()-7);
    else if(range === "1m") d.setMonth(d.getMonth()-1);
    else if(range === "3m") d.setMonth(d.getMonth()-3);
    else if(range === "6m") d.setMonth(d.getMonth()-6);
    else if(range === "9m") d.setMonth(d.getMonth()-9);
    else if(range === "1y") d.setFullYear(d.getFullYear()-1);
    else if(range === "5y") d.setFullYear(d.getFullYear()-5);
    else if(range === "10y") d.setFullYear(d.getFullYear()-10);
    else if(range === "25y") d.setFullYear(d.getFullYear()-25);
    return d;
  }
  function oilStats(rows){
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var el=document.getElementById("oil-stats"); if(!el) return;
    if(!vals.length){ el.innerHTML=""; return; }
    var high=Math.max.apply(null,vals), low=Math.min.apply(null,vals), avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
    var variance=vals.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/vals.length;
    var vol=avg?Math.sqrt(variance)/avg*100:0;
    el.innerHTML = [
      ["High", "$"+fmt(high,2)], ["Low", "$"+fmt(low,2)], ["Average", "$"+fmt(avg,2)], ["Volatility", fmt(vol,1)+"%"]
    ].map(function(x){return '<div class="oil-stat"><div class="oil-stat-label">'+x[0]+'</div><div class="oil-stat-value">'+x[1]+'</div></div>';}).join("");
  }
  function drawOilTrend(geo, activeIndex){
    var canvas=document.getElementById("oil-trend-canvas"); if(!canvas||!geo||!Array.isArray(geo.features)) return;
    var ctx=canvas.getContext("2d"), range=document.getElementById("oil-range").value;
    var rows=geo.features.map(function(f){return f.properties||{};}).filter(function(p){return p.date&&(p.brentUSDperBarrel||p.wtiUSDperBarrel);});
    var cutoff=rangeCutoff(range); if(cutoff) rows=rows.filter(function(p){return new Date(p.date)>=cutoff;});
    var w=canvas.width,h=canvas.height,pad=54,rightPad=28;
    ctx.clearRect(0,0,w,h); ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    if(rows.length<2) { ctx.fillStyle="#a6adbb"; ctx.font="14px Courier New"; ctx.fillText("Waiting for oil history data", pad, 42); oilStats([]); return; }
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals); if(max===min){max=min+1;}
    function x(i){return pad+(i/(rows.length-1))*(w-pad-rightPad);} function y(v){return h-pad-((v-min)/(max-min))*(h-pad*1.85);}
    ctx.strokeStyle="#252b36"; ctx.lineWidth=1;
    ctx.fillStyle="#a6adbb"; ctx.font="16px Courier New";
    for(var g=0;g<5;g++){
      var value=max-(g*(max-min)/4), yy=y(value);
      ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-rightPad,yy);ctx.stroke();
      ctx.fillText("$"+fmt(value,0), 8, yy+4);
    }
    ctx.save();
    ctx.translate(14, h/2 + 70);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle="#a6adbb";
    ctx.font="11px Courier New";
    ctx.fillText("US dollars per barrel (USD/bbl)", 0, 0);
    ctx.restore();

    function line(field,colour){
      ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.beginPath();var started=false;
      rows.forEach(function(p,i){var v=p[field];if(!v)return; if(!started){ctx.moveTo(x(i),y(v));started=true;}else{ctx.lineTo(x(i),y(v));}});
      ctx.stroke();
    }
    line("brentUSDperBarrel","#ff9900"); line("wtiUSDperBarrel","#00ffff");
    ctx.fillStyle="#a6adbb"; ctx.font="12px Courier New";
    ctx.fillText("Brent",pad,18); ctx.fillStyle="#ff9900"; ctx.fillRect(pad+46,10,18,4);
    ctx.fillStyle="#a6adbb"; ctx.fillText("WTI",pad+78,18); ctx.fillStyle="#00ffff"; ctx.fillRect(pad+112,10,18,4);

    var idx = Number.isFinite(activeIndex) ? Math.max(0, Math.min(rows.length-1, activeIndex)) : null;
    if(idx !== null){
      var xx=x(idx);
      ctx.strokeStyle="rgba(255,255,255,.85)";
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(xx, pad*0.72); ctx.lineTo(xx, h-pad); ctx.stroke();
      var p=rows[idx];
      ["brentUSDperBarrel","wtiUSDperBarrel"].forEach(function(field){
        var v=p[field]; if(!v) return;
        ctx.fillStyle = field==="brentUSDperBarrel" ? "#ff9900" : "#00ffff";
        ctx.beginPath(); ctx.arc(xx, y(v), 4, 0, Math.PI*2); ctx.fill();
      });
    }

    oilChartState={rows:rows,x:x,y:y,canvas:canvas,activeIndex:idx,min:min,max:max,pad:pad}; oilStats(rows); bindOilTooltip();
  }
  function bindOilTooltip(){
    var canvas=document.getElementById("oil-trend-canvas"), tip=document.getElementById("oil-tooltip"); if(!canvas||!tip||canvas.__oilTipBound) return;
    canvas.__oilTipBound=true;
    function show(e){
      var rect=canvas.getBoundingClientRect();
      var clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX);
      var px=(clientX-rect.left)*(canvas.width/rect.width);
      var rows=oilChartState.rows||[]; if(!rows.length) return;
      var pad=oilChartState.pad||54, rightPad=28;
      var idx=Math.max(0,Math.min(rows.length-1,Math.round((px-pad)/(canvas.width-pad-rightPad)*(rows.length-1))));
      drawOilTrend(window.__oilGeojsonCache, idx);
      var p=rows[idx];
      tip.innerHTML='<strong>'+p.date+'</strong><br>Brent: '+(p.brentUSDperBarrel?'$'+fmt(p.brentUSDperBarrel,2):'—')+' USD/bbl<br>WTI: '+(p.wtiUSDperBarrel?'$'+fmt(p.wtiUSDperBarrel,2):'—')+' USD/bbl';
      tip.style.display='block'; tip.style.left=Math.min(rect.width-190,Math.max(8,clientX-rect.left+12))+'px'; tip.style.top='42px';
    }
    function hide(){ tip.style.display='none'; drawOilTrend(window.__oilGeojsonCache, null); }
    canvas.addEventListener('mousemove',show); canvas.addEventListener('touchmove',show,{passive:true}); canvas.addEventListener('mouseleave',hide); canvas.addEventListener('touchend',hide);
  }
