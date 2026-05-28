// V5 live tracker commodity, road fuel and EV rendering.
function moneySymbol(currency){
  return currency==='GBP'?'£':(currency==='EUR'?'€':'$');
}
function fmtMoney(value,currency){
  if(value==null || isNaN(value)) return '—';
  return moneySymbol(currency)+Number(value).toLocaleString('en-GB',{maximumFractionDigits:0});
}
function renderCommodities(oil,fuel){
    oil=oil||{}; fuel=fuel||{};
    setText("brent-price", oil.brentUSDperBarrel==null?"—":"$"+fmt(oil.brentUSDperBarrel,2));
    setText("wti-price", oil.wtiUSDperBarrel==null?"—":"$"+fmt(oil.wtiUSDperBarrel,2));
    renderMetalCard("copper-price", "copper", oil);
    renderMetalCard("aluminium-price", "aluminium", oil);
    var latest=fuel.latest||{};
    setText("petrol-price", latest.petrolPencePerLitre==null?"—":fmt(latest.petrolPencePerLitre,2)+"p");
    setText("diesel-price", latest.dieselPencePerLitre==null?"—":fmt(latest.dieselPencePerLitre,2)+"p");
    renderFuelBreakdown(oil, latest);
  }
  function renderMetalCard(id, metal, data){
    var el=document.getElementById(id); if(!el) return;
    var usd=data[metal+"USDperTonne"], eur=data[metal+"EURperTonne"], gbp=data[metal+"GBPperTonne"];
    if(usd==null && eur==null && gbp==null){ el.textContent="—"; return; }
    el.innerHTML='<span style="display:block">'+fmtMoney(usd,'USD')+' <span style="font-size:12px;color:#9aa3b6">USD/t</span></span>'+
      '<span style="display:block;font-size:16px;margin-top:4px;color:#00ffff">'+fmtMoney(eur,'EUR')+' <span style="font-size:11px;color:#9aa3b6">EUR/t</span></span>'+
      '<span style="display:block;font-size:16px;margin-top:2px;color:#f5f7fb">'+fmtMoney(gbp,'GBP')+' <span style="font-size:11px;color:#9aa3b6">GBP/t</span></span>';
  }
  function renderFuelBreakdown(oil, latest){
    var el=document.getElementById("fuel-breakdown"); if(!el) return;
    var brent=oil&&oil.brentUSDperBarrel, petrol=latest&&latest.petrolPencePerLitre;
    var stamp=oil&&oil.updatedDisplayUTC ? " Commodity sync: "+oil.updatedDisplayUTC+"." : "";
    if(brent==null || petrol==null){ el.textContent="Awaiting Brent crude and DESNZ fuel price feed."+stamp; return; }
    var gbpUsd=(oil.fx&&oil.fx.gbpUSD)||1.27, litresPerBarrel=158.987, duty=52.95, vatRate=0.20;
    var crudePpl=(Number(brent)/gbpUsd/litresPerBarrel)*100;
    var preVat=Number(petrol)/(1+vatRate);
    var vat=Number(petrol)-preVat;
    var spread=preVat-duty-crudePpl;
    el.innerHTML="Brent proxy: $"+fmt(brent,2)+"/bbl divided by FX "+fmt(gbpUsd,4)+" and 159 litres equals about "+fmt(crudePpl,1)+"p/l crude input. Petrol pump: "+fmt(petrol,2)+"p/l. VAT at 20%: "+fmt(vat,1)+"p/l. Fuel duty assumption: "+fmt(duty,2)+"p/l. Implied refining, logistics, wholesale and retail spread: "+fmt(spread,1)+"p/l. Week: "+(latest.week||"not stated")+"."+stamp;
  }
  function parseMarketInputs(){
    getJSON(OIL).then(function(data){
      data=data||{};
      renderMetalCard("copper-price", "copper", data);
      renderMetalCard("aluminium-price", "aluminium", data);
    }).catch(function(){ setText("copper-price","—"); setText("aluminium-price","—"); });
  }

  function renderEvPrices(ev){
    var ops=(ev&&ev.operators)||[];
    var rapid=[], ultra=[];
    ops.forEach(function(o){ if(o.rapidPencePerKWh!=null) rapid.push(Number(o.rapidPencePerKWh)); if(o.ultraRapidPencePerKWh!=null) ultra.push(Number(o.ultraRapidPencePerKWh)); });
    if(rapid.length){ setText("ev-rapid-price", fmt(rapid.reduce(function(a,b){return a+b;},0)/rapid.length,1)+"p"); }
    if(ultra.length){ setText("ev-ultra-price", fmt(ultra.reduce(function(a,b){return a+b;},0)/ultra.length,1)+"p"); }
  }
