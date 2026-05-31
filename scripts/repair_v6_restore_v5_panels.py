from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"

READ_FIRST = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/operating_manual.md",
    "uk_energy_tracking_v5/index.md",
    "uk_energy_tracking_v5/live-config.js",
    "uk_energy_tracking_v5/live-app.js",
    "uk_energy_tracking_v5/live-transport.js",
    "uk_energy_tracking_v5/live-oil-chart.js",
    "uk_energy_tracking_v5/frequency-history-ui.js",
]

for rel in READ_FIRST:
    path = ROOT / rel
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    path.read_text(encoding="utf-8")

protocol = (V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md").read_text(encoding="utf-8")
comparison = (V6 / "V5_V6_COMPARISON_REPORT.md").read_text(encoding="utf-8")

if "All V6 changes" not in protocol or "workflow" not in protocol:
    raise RuntimeError("V6 protocol not recognised")
if "V5 ids missing from V6" not in comparison:
    raise RuntimeError("V5 V6 comparison report not recognised")

for token in ["oil-trend-canvas", "oil-range", "petrol-price", "diesel-price", "ev-rapid-price", "ev-ultra-price", "fuel-breakdown"]:
    if token not in comparison:
        raise RuntimeError(f"Expected missing V5 token absent from comparison report: {token}")

index_path = V6 / "index.md"
css_path = V6 / "styles/app.css"
config_path = V6 / "live_data_pipeline/live-config.js"
commodities_path = V6 / "commodity_price_signals/render_commodities/render_commodities.js"
start_path = V6 / "app_bootstrap/start_v6_app/start_v6_app.js"
frequency_path = V6 / "frequency_history/frequency-history-ui.js"
report_path = V6 / "V6_REPAIR_RESTORE_V5_PANELS_REPORT.md"

index = index_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
config = config_path.read_text(encoding="utf-8")
commodities = commodities_path.read_text(encoding="utf-8")
start_app = start_path.read_text(encoding="utf-8")

for token in ["oil-trend-canvas", "petrol-price", "ev-rapid-price", "frequency-history-ui.js"]:
    if token in index:
        raise RuntimeError(f"Refusing duplicate V6 panel restore. Already found: {token}")

insert_marker = "  <section class=\"scada-credit\">"
if insert_marker not in index:
    raise RuntimeError("Cannot find V6 attribution section marker")

panel_html = """  <section id=\"oil-price-trend-panel\">
    <h2 class=\"section-title\">Oil Price Trend</h2>
    <div class=\"trend-panel\">
      <div class=\"trend-controls\">
        <strong style=\"color:#00ffff;letter-spacing:.12em;text-transform:uppercase;\">Oil Price Trend</strong>
        <select id=\"oil-range\">
          <option value=\"7d\">1 week</option>
          <option value=\"1m\">1 month</option>
          <option value=\"3m\">3 months</option>
          <option value=\"6m\">6 months</option>
          <option value=\"9m\">9 months</option>
          <option value=\"1y\">1 year</option>
          <option value=\"5y\">5 years</option>
          <option value=\"10y\">10 years</option>
          <option value=\"25y\" selected>25 years</option>
        </select>
      </div>
      <div class=\"unit-panel\"><strong>Unit:</strong> USD per barrel. Touch or move across the graph to inspect date, Brent and WTI values.</div>
      <div class=\"oil-chart-wrap\"><canvas id=\"oil-trend-canvas\" width=\"900\" height=\"300\"></canvas><div id=\"oil-tooltip\" class=\"oil-tooltip\"></div></div>
      <div id=\"oil-stats\" class=\"oil-stats-grid\"></div>
    </div>
  </section>

  <section id=\"road-fuel-ev-panel\">
    <h2 class=\"section-title\" style=\"font-size:18px;color:#a6adbb;\">Road Fuel & EV Charging</h2>
    <div class=\"pump-grid\">
      <div class=\"pump-card\"><div class=\"pump-label\">Petrol</div><div class=\"pump-value\" id=\"petrol-price\">—</div><div class=\"commodity-unit\">DESNZ weekly average, pence per litre</div></div>
      <div class=\"pump-card\"><div class=\"pump-label\">Diesel</div><div class=\"pump-value\" id=\"diesel-price\">—</div><div class=\"commodity-unit\">DESNZ weekly average, pence per litre</div></div>
    </div>
    <div class=\"fuel-logic-panel\">
      <strong>Road fuel price logic:</strong> Brent crude is quoted in US dollars per barrel. A rough product cost proxy converts USD per barrel into GBP per litre by applying an FX assumption and dividing by about 159 litres per barrel. UK pump prices then add refining spread, wholesale margin, logistics, retail margin, fuel duty and VAT.
      <div id=\"fuel-breakdown\" style=\"margin-top:10px;\">Awaiting DESNZ fuel price feed.</div>
      <div class=\"fuel-source-links\">
        <a href=\"https://www.gov.uk/government/statistics/weekly-road-fuel-prices\" target=\"_blank\" rel=\"noopener noreferrer\">DESNZ weekly road fuel prices</a>
        <a href=\"https://www.gov.uk/tax-on-shopping/fuel-duty\" target=\"_blank\" rel=\"noopener noreferrer\">GOV.UK fuel duty</a>
        <a href=\"https://www.gov.uk/vat-rates\" target=\"_blank\" rel=\"noopener noreferrer\">GOV.UK VAT rates</a>
      </div>
    </div>
    <div class=\"ev-panel\">
      <strong>EV charging comparison placeholder:</strong> Public EV tariffs are compared with petrol, diesel, wholesale electricity and operator tariff data when the V6 EV feed is present.
      <div class=\"ev-card-grid\">
        <div class=\"ev-card\"><div class=\"ev-label\">Rapid charging average</div><div class=\"ev-value\" id=\"ev-rapid-price\">—</div><div class=\"commodity-unit\">pence per kilowatt hour</div></div>
        <div class=\"ev-card\"><div class=\"ev-label\">Ultra rapid average</div><div class=\"ev-value\" id=\"ev-ultra-price\">—</div><div class=\"commodity-unit\">pence per kilowatt hour</div></div>
      </div>
    </div>
  </section>

"""
index = index.replace(insert_marker, panel_html + insert_marker, 1)

start_script = '<script src="/uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260530o"></script>'
if start_script not in index:
    raise RuntimeError("Cannot find V6 start app script marker")
frequency_script = '<script src="/uk_energy_tracking_v6/frequency_history/frequency-history-ui.js?v=20260531a"></script>'
index = index.replace(start_script, start_script + "\n" + frequency_script, 1)

css_add = """

/* V6 repair: restore V5 oil, road fuel, EV and frequency panel styling. */
.trend-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
.trend-controls select{background:#050505;color:var(--gg-cyan);border:1px solid var(--gg-line);padding:8px;font-family:\"Courier New\",monospace;border-radius:4px;}
#oil-trend-canvas{width:100%;height:300px;display:block;border:1px solid rgba(255,255,255,.05);background:#070a10;touch-action:auto;}
.oil-chart-wrap{position:relative;}
.oil-tooltip{position:absolute;display:none;pointer-events:none;background:rgba(5,5,5,.94);border:1px solid var(--gg-cyan);color:var(--gg-text);padding:8px 10px;border-radius:4px;font-size:12px;line-height:1.45;box-shadow:0 0 18px rgba(0,255,255,.12);z-index:5;}
.oil-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px;}
.oil-stat{border:1px solid var(--gg-line);background:rgba(255,255,255,.03);border-radius:4px;padding:9px;}
.oil-stat-label{color:var(--gg-muted);text-transform:uppercase;letter-spacing:.12em;font-size:10px;}
.oil-stat-value{color:var(--gg-cyan);font-size:16px;font-weight:800;margin-top:4px;}
.pump-grid{grid-template-columns:repeat(2,minmax(0,1fr));opacity:.86;}
.pump-card{background:rgba(255,255,255,.03);border:1px solid var(--gg-line);border-radius:6px;padding:12px;}
.pump-label{color:var(--gg-muted);text-transform:uppercase;letter-spacing:.14em;font-size:11px;}
.pump-value{color:var(--gg-yellow);font-size:24px;font-weight:800;margin-top:6px;}
.fuel-logic-panel,.ev-panel{border:1px solid var(--gg-line);background:rgba(255,255,255,.03);border-radius:6px;padding:14px;margin-top:14px;color:var(--gg-muted);font-size:13px;line-height:1.55;}
.fuel-logic-panel strong,.ev-panel strong{color:var(--gg-text);}
.fuel-source-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
.fuel-source-links a{border:1px solid var(--gg-line);border-radius:4px;padding:7px 9px;color:#7fdfff;}
.ev-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;}
.ev-card{border:1px solid var(--gg-line);background:var(--gg-panel);border-radius:6px;padding:12px;}
.ev-label{color:var(--gg-muted);text-transform:uppercase;letter-spacing:.14em;font-size:11px;}
.ev-value{color:var(--gg-green);font-size:22px;font-weight:800;margin-top:6px;}
@media(max-width:850px){.pump-grid,.ev-card-grid,.oil-stats-grid{grid-template-columns:1fr;}#oil-trend-canvas{height:320px;}}
"""
if "V6 repair: restore V5 oil" not in css:
    css = css.rstrip() + css_add

expected_config = """window.V6LiveConfig={
  energy:'/uk_energy_tracking_v6/live_grid_energy.json',
  price:'/uk_energy_tracking_v6/live_grid_price.json',
  commodities:'/uk_energy_tracking_v6/live_oil_prices.json',
  priceHistory:'/uk_energy_tracking_v6/electricity_price_history.json',
  dailyPriceHistory:'/uk_energy_tracking_v6/electricity_price_history_daily_decade.json',
  annualBase:'/data/electricity/elexon_system_prices_'
};
"""
if config != expected_config:
    raise RuntimeError("V6 live config has changed. Regenerate this repair script against current file.")
config = """window.V6LiveConfig={
  energy:'/uk_energy_tracking_v6/live_grid_energy.json',
  price:'/uk_energy_tracking_v6/live_grid_price.json',
  commodities:'/uk_energy_tracking_v6/live_oil_prices.json',
  oilHistory:'/uk_energy_tracking_v6/oil_price_history.geojson',
  fuel:'/uk_energy_tracking_v6/live_uk_fuel_prices.json',
  evPrices:'/uk_energy_tracking_v6/ev_charging_prices.json',
  frequencyCsv:'/uk_energy_tracking_v6/grid_frequency_history.csv',
  frequencyLive:'/uk_energy_tracking_v6/live_grid_frequency.json',
  frequencyWeekly:'/uk_energy_tracking_v6/live_grid_frequency_weekly_health.json',
  priceHistory:'/uk_energy_tracking_v6/electricity_price_history.json',
  dailyPriceHistory:'/uk_energy_tracking_v6/electricity_price_history_daily_decade.json',
  annualBase:'/data/electricity/elexon_system_prices_'
};
"""

commodities = r'''window.V6RenderCommodities=(function(){
  var oilChartState={rows:[],pad:54,dpr:1};
  function h(){return window.V6DomText}
  function fmt(v,d){return h().fmt(v,d)}
  function set(id,v){h().setText(id,v)}
  function sym(c){return c==='GBP'?'£':c==='EUR'?'€':'$'}
  function fmtMoney(v,c){return v==null||isNaN(Number(v))?'—':sym(c)+Number(v).toLocaleString('en-GB',{maximumFractionDigits:0})}
  function renderMetalCard(id,metal,data){var el=document.getElementById(id);if(!el)return;var usd=data[metal+'USDperTonne'],eur=data[metal+'EURperTonne'],gbp=data[metal+'GBPperTonne'];if(usd==null&&eur==null&&gbp==null){el.textContent='—';return}el.innerHTML='<span style="display:block">'+fmtMoney(usd,'USD')+' <span style="font-size:12px;color:#9aa3b6">USD/t</span></span>'+'<span style="display:block;font-size:16px;margin-top:4px;color:#00ffff">'+fmtMoney(eur,'EUR')+' <span style="font-size:11px;color:#9aa3b6">EUR/t</span></span>'+'<span style="display:block;font-size:16px;margin-top:2px;color:#f5f7fb">'+fmtMoney(gbp,'GBP')+' <span style="font-size:11px;color:#9aa3b6">GBP/t</span></span>'}
  function renderFuelBreakdown(oil,latest){var el=document.getElementById('fuel-breakdown');if(!el)return;var brent=oil&&oil.brentUSDperBarrel,petrol=latest&&latest.petrolPencePerLitre;var stamp=oil&&oil.updatedDisplayUTC?' Commodity sync: '+oil.updatedDisplayUTC+'.':'';if(brent==null||petrol==null){el.textContent='Awaiting Brent crude and DESNZ fuel price feed.'+stamp;return}var gbpUsd=(oil.fx&&oil.fx.gbpUSD)||1.27,litres=158.987,duty=52.95,vatRate=0.20;var crudePpl=(Number(brent)/gbpUsd/litres)*100,preVat=Number(petrol)/(1+vatRate),vat=Number(petrol)-preVat,spread=preVat-duty-crudePpl;el.innerHTML='Brent proxy: $'+fmt(brent,2)+'/bbl divided by FX '+fmt(gbpUsd,4)+' and 159 litres equals about '+fmt(crudePpl,1)+'p/l crude input. Petrol pump: '+fmt(petrol,2)+'p/l. VAT at 20%: '+fmt(vat,1)+'p/l. Fuel duty assumption: '+fmt(duty,2)+'p/l. Implied refining, logistics, wholesale and retail spread: '+fmt(spread,1)+'p/l. Week: '+(latest.week||'not stated')+'.'+stamp}
  function renderEvPrices(ev){var ops=(ev&&ev.operators)||[],rapid=[],ultra=[];ops.forEach(function(o){if(o.rapidPencePerKWh!=null)rapid.push(Number(o.rapidPencePerKWh));if(o.ultraRapidPencePerKWh!=null)ultra.push(Number(o.ultraRapidPencePerKWh))});set('ev-rapid-price',rapid.length?fmt(rapid.reduce(function(a,b){return a+b},0)/rapid.length,1)+'p':'—');set('ev-ultra-price',ultra.length?fmt(ultra.reduce(function(a,b){return a+b},0)/ultra.length,1)+'p':'—')}
  function rangeCutoff(range){var d=new Date();if(range==='7d')d.setDate(d.getDate()-7);else if(range==='1m')d.setMonth(d.getMonth()-1);else if(range==='3m')d.setMonth(d.getMonth()-3);else if(range==='6m')d.setMonth(d.getMonth()-6);else if(range==='9m')d.setMonth(d.getMonth()-9);else if(range==='1y')d.setFullYear(d.getFullYear()-1);else if(range==='5y')d.setFullYear(d.getFullYear()-5);else if(range==='10y')d.setFullYear(d.getFullYear()-10);else if(range==='25y')d.setFullYear(d.getFullYear()-25);else return null;return d}
  function oilStats(rows){var vals=[];rows.forEach(function(p){if(p.brentUSDperBarrel)vals.push(p.brentUSDperBarrel);if(p.wtiUSDperBarrel)vals.push(p.wtiUSDperBarrel)});var el=document.getElementById('oil-stats');if(!el)return;if(!vals.length){el.innerHTML='';return}var high=Math.max.apply(null,vals),low=Math.min.apply(null,vals),avg=vals.reduce(function(a,b){return a+b},0)/vals.length;var vol=avg?Math.sqrt(vals.reduce(function(a,b){return a+Math.pow(b-avg,2)},0)/vals.length)/avg*100:0;el.innerHTML=[['High','$'+fmt(high,2)],['Low','$'+fmt(low,2)],['Average','$'+fmt(avg,2)],['Volatility',fmt(vol,1)+'%']].map(function(x){return '<div class="oil-stat"><div class="oil-stat-label">'+x[0]+'</div><div class="oil-stat-value">'+x[1]+'</div></div>'}).join('')}
  function drawOilTrend(geo){var canvas=document.getElementById('oil-trend-canvas');if(!canvas||!geo||!Array.isArray(geo.features))return;var ctx=canvas.getContext('2d'),range=document.getElementById('oil-range').value;var rows=geo.features.map(function(f){return f.properties||{}}).filter(function(p){return p.date&&(p.brentUSDperBarrel||p.wtiUSDperBarrel)});var cutoff=rangeCutoff(range);if(cutoff)rows=rows.filter(function(p){return new Date(p.date)>=cutoff});var rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(340,Math.floor((rect.width||900)*dpr));canvas.height=Math.max(260,Math.floor((rect.height||300)*dpr));var w=canvas.width,hgt=canvas.height,pad=54*dpr,right=28*dpr;ctx.clearRect(0,0,w,hgt);ctx.fillStyle='#070a10';ctx.fillRect(0,0,w,hgt);if(rows.length<2){ctx.fillStyle='#a6adbb';ctx.font=(14*dpr)+'px Courier New';ctx.fillText('Waiting for oil history data',pad,42*dpr);oilStats([]);return}var vals=[];rows.forEach(function(p){if(p.brentUSDperBarrel)vals.push(p.brentUSDperBarrel);if(p.wtiUSDperBarrel)vals.push(p.wtiUSDperBarrel)});var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);if(max===min)max=min+1;function x(i){return pad+(i/(rows.length-1))*(w-pad-right)}function y(v){return hgt-pad-((v-min)/(max-min))*(hgt-pad*1.85)}ctx.strokeStyle='#252b36';ctx.lineWidth=1*dpr;ctx.fillStyle='#a6adbb';ctx.font=(16*dpr)+'px Courier New';for(var g=0;g<5;g++){var value=max-(g*(max-min)/4),yy=y(value);ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText('$'+fmt(value,0),8*dpr,yy+4*dpr)}function line(field,colour){ctx.strokeStyle=colour;ctx.lineWidth=2*dpr;ctx.beginPath();var started=false;rows.forEach(function(p,i){var v=p[field];if(!v)return;if(!started){ctx.moveTo(x(i),y(v));started=true}else ctx.lineTo(x(i),y(v))});ctx.stroke()}line('brentUSDperBarrel','#ff9900');line('wtiUSDperBarrel','#00ffff');ctx.fillStyle='#a6adbb';ctx.font=(12*dpr)+'px Courier New';ctx.fillText('Brent',pad,18*dpr);ctx.fillStyle='#ff9900';ctx.fillRect(pad+46*dpr,10*dpr,18*dpr,4*dpr);ctx.fillStyle='#a6adbb';ctx.fillText('WTI',pad+78*dpr,18*dpr);ctx.fillStyle='#00ffff';ctx.fillRect(pad+112*dpr,10*dpr,18*dpr,4*dpr);oilChartState={rows:rows,pad:pad,dpr:dpr};oilStats(rows);bindOilTooltip()}
  function bindOilTooltip(){var canvas=document.getElementById('oil-trend-canvas'),tip=document.getElementById('oil-tooltip');if(!canvas||!tip||canvas.dataset.tipBound)return;canvas.dataset.tipBound='1';function show(e){var rect=canvas.getBoundingClientRect(),clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX),rows=oilChartState.rows||[];if(!rows.length)return;var pad=(oilChartState.pad||54)/(oilChartState.dpr||1),idx=Math.max(0,Math.min(rows.length-1,Math.round((clientX-rect.left-pad)/(rect.width-pad-28)*(rows.length-1))));var p=rows[idx];tip.innerHTML='<strong>'+p.date+'</strong><br>Brent: '+(p.brentUSDperBarrel?'$'+fmt(p.brentUSDperBarrel,2):'—')+' USD/bbl<br>WTI: '+(p.wtiUSDperBarrel?'$'+fmt(p.wtiUSDperBarrel,2):'—')+' USD/bbl';tip.style.display='block';tip.style.left=Math.min(rect.width-190,Math.max(8,clientX-rect.left+12))+'px';tip.style.top='42px'}function hide(){tip.style.display='none'}canvas.addEventListener('mousemove',show);canvas.addEventListener('touchmove',show,{passive:true});canvas.addEventListener('mouseleave',hide);canvas.addEventListener('touchend',hide)}
  function render(data,fuel,ev,oilHistory){data=data||{};fuel=fuel||{};set('brent-price',data.brentUSDperBarrel==null?'—':'USD '+fmt(data.brentUSDperBarrel,2));set('wti-price',data.wtiUSDperBarrel==null?'—':'USD '+fmt(data.wtiUSDperBarrel,2));renderMetalCard('copper-price','copper',data);renderMetalCard('aluminium-price','aluminium',data);var latest=fuel.latest||{};set('petrol-price',latest.petrolPencePerLitre==null?'—':fmt(latest.petrolPencePerLitre,2)+'p');set('diesel-price',latest.dieselPencePerLitre==null?'—':fmt(latest.dieselPencePerLitre,2)+'p');renderFuelBreakdown(data,latest);renderEvPrices(ev||{});if(oilHistory){window.__v6OilHistoryCache=oilHistory;drawOilTrend(oilHistory)}var oilRange=document.getElementById('oil-range');if(oilRange&&!oilRange.dataset.bound){oilRange.dataset.bound='1';oilRange.addEventListener('change',function(){if(window.__v6OilHistoryCache)drawOilTrend(window.__v6OilHistoryCache)})}}
  return{render:render,drawOilTrend:drawOilTrend};
})();
'''

expected_start = """window.V6StartApp=(function(){
  function refreshLive(){var cfg=window.V6LiveConfig,load=window.V6LoadJson.loadJson;Promise.all([load(cfg.energy),load(cfg.price),load(cfg.commodities)]).then(function(r){var energy=r[0]||{},price=r[1]||{},commodities=r[2]||{};window.V6RenderLiveSnapshot.render(energy,price);window.V6RenderGenerationMix.render(energy);window.V6RenderCommodities.render(commodities)})}
  function start(){refreshLive();setInterval(refreshLive,5*60*1000);if(window.V6ControlPriceHistory)window.V6ControlPriceHistory.start()}
  document.addEventListener('DOMContentLoaded',start);
  return{start:start,refreshLive:refreshLive};
})();
"""
if start_app != expected_start:
    raise RuntimeError("V6 start app has changed. Regenerate this repair script against current file.")
start_app = """window.V6StartApp=(function(){
  function refreshLive(){
    var cfg=window.V6LiveConfig,load=window.V6LoadJson.loadJson;
    Promise.all([load(cfg.energy),load(cfg.price),load(cfg.commodities),load(cfg.fuel),load(cfg.evPrices),load(cfg.oilHistory)]).then(function(r){
      var energy=r[0]||{},price=r[1]||{},commodities=r[2]||{},fuel=r[3]||{},ev=r[4]||{},oilHistory=r[5]||null;
      window.V6RenderLiveSnapshot.render(energy,price);
      window.V6RenderGenerationMix.render(energy);
      window.V6RenderCommodities.render(commodities,fuel,ev,oilHistory);
    })
  }
  function start(){refreshLive();setInterval(refreshLive,5*60*1000);if(window.V6ControlPriceHistory)window.V6ControlPriceHistory.start()}
  document.addEventListener('DOMContentLoaded',start);
  return{start:start,refreshLive:refreshLive};
})();
"""

frequency_path.parent.mkdir(parents=True, exist_ok=True)
frequency = (ROOT / "uk_energy_tracking_v5/frequency-history-ui.js").read_text(encoding="utf-8")
frequency = frequency.replace("GlobalGrid2050 V5 frequency chart", "GlobalGrid2050 V6 frequency chart")
frequency = frequency.replace("/uk_energy_tracking_v5/", "/uk_energy_tracking_v6/")

index_path.write_text(index, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
config_path.write_text(config, encoding="utf-8")
commodities_path.write_text(commodities, encoding="utf-8")
start_path.write_text(start_app, encoding="utf-8")
frequency_path.write_text(frequency, encoding="utf-8")

for path, tokens in {
    index_path: ["oil-trend-canvas", "petrol-price", "ev-rapid-price", "frequency-history-ui.js"],
    config_path: ["oilHistory", "fuel", "evPrices", "frequencyCsv"],
    commodities_path: ["renderFuelBreakdown", "renderEvPrices", "drawOilTrend"],
    start_path: ["cfg.fuel", "cfg.evPrices", "cfg.oilHistory"],
    frequency_path: ["grid-frequency-panel", "/uk_energy_tracking_v6/grid_frequency_history.csv"],
}.items():
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"Post repair assertion failed: {path} lacks {token}")

report_path.write_text("""# V6 Repair Report: Restore V5 Panels

Status: prepared by deterministic repair script.

## Scope

This repair restores the V5 oil trend, road fuel, EV placeholder and grid frequency panel wiring into the modular V6 page.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/index.md`
2. `uk_energy_tracking_v6/styles/app.css`
3. `uk_energy_tracking_v6/live_data_pipeline/live-config.js`
4. `uk_energy_tracking_v6/commodity_price_signals/render_commodities/render_commodities.js`
5. `uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js`
6. `uk_energy_tracking_v6/frequency_history/frequency-history-ui.js`
7. `uk_energy_tracking_v6/V6_REPAIR_RESTORE_V5_PANELS_REPORT.md`

## Explicit non scope

No fullscreen swipe was added.
No forecast logic was changed.
No V5 file was modified.

## Required maintainer test

Open `/uk_energy_tracking_v6/` and verify price chart, fullscreen, period arrows, generation mix, commodity cards, oil trend, road fuel, EV placeholders and frequency panel.
""", encoding="utf-8")

print("V6 restore V5 panels repair completed locally by script.")
