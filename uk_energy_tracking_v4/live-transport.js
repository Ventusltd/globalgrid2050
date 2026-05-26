// V4 live tracker commodity, road fuel and EV rendering.
function renderCommodities(oil,fuel){
    oil=oil||{}; fuel=fuel||{};
    setText("brent-price", oil.brentUSDperBarrel==null?"—":"$"+fmt(oil.brentUSDperBarrel,2));
    setText("wti-price", oil.wtiUSDperBarrel==null?"—":"$"+fmt(oil.wtiUSDperBarrel,2));
    var latest=fuel.latest||{};
    setText("petrol-price", latest.petrolPencePerLitre==null?"—":fmt(latest.petrolPencePerLitre,2)+"p");
    setText("diesel-price", latest.dieselPencePerLitre==null?"—":fmt(latest.dieselPencePerLitre,2)+"p");
    renderFuelBreakdown(oil, latest);
  }
  function renderFuelBreakdown(oil, latest){
    var el=document.getElementById("fuel-breakdown"); if(!el) return;
    var brent=oil&&oil.brentUSDperBarrel, petrol=latest&&latest.petrolPencePerLitre;
    if(brent==null || petrol==null){ el.textContent="Awaiting Brent crude and DESNZ fuel price feed."; return; }
    var gbpUsd=1.27, litresPerBarrel=158.987, duty=52.95, vatRate=0.20;
    var crudePpl=(Number(brent)/gbpUsd/litresPerBarrel)*100;
    var preVat=Number(petrol)/(1+vatRate);
    var vat=Number(petrol)-preVat;
    var spread=preVat-duty-crudePpl;
    el.innerHTML="Brent proxy: $"+fmt(brent,2)+"/bbl divided by FX "+gbpUsd+" and 159 litres equals about "+fmt(crudePpl,1)+"p/l crude input. Petrol pump: "+fmt(petrol,2)+"p/l. VAT at 20%: "+fmt(vat,1)+"p/l. Fuel duty assumption: "+fmt(duty,2)+"p/l. Implied refining, logistics, wholesale and retail spread: "+fmt(spread,1)+"p/l. Week: "+(latest.week||"not stated")+".";
  }
  function parseMarketInputs(){
    fetch("/33kv_uk_dap_price_estimator/").then(function(r){return r.text();}).then(function(html){
      var c=html.match(/LME Copper \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      var a=html.match(/LME Aluminium \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      setText("copper-price", c?"$"+c[1]:"—");
      setText("aluminium-price", a?"$"+a[1]:"—");
    }).catch(function(){ setText("copper-price","—"); setText("aluminium-price","—"); });
  }

  function renderEvPrices(ev){
    var ops=(ev&&ev.operators)||[];
    var rapid=[], ultra=[];
    ops.forEach(function(o){ if(o.rapidPencePerKWh!=null) rapid.push(Number(o.rapidPencePerKWh)); if(o.ultraRapidPencePerKWh!=null) ultra.push(Number(o.ultraRapidPencePerKWh)); });
    if(rapid.length){ setText("ev-rapid-price", fmt(rapid.reduce(function(a,b){return a+b;},0)/rapid.length,1)+"p"); }
    if(ultra.length){ setText("ev-ultra-price", fmt(ultra.reduce(function(a,b){return a+b;},0)/ultra.length,1)+"p"); }
  }
