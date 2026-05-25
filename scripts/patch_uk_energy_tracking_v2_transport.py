from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / 'uk_energy_tracking'
V2 = ROOT / 'uk_energy_tracking_v2'
PAGE = V2 / 'index.md'
REPORT = ROOT / 'gridbot_reports' / 'patch_uk_energy_tracking_v2_transport.md'

changes = []
V2.mkdir(parents=True, exist_ok=True)

# Seed isolated V2 data files from V1 where possible.
for name in ['live_uk_fuel_prices.json', 'ev_charging_prices.json']:
    src = V1 / name
    dst = V2 / name
    if src.exists() and not dst.exists():
        shutil.copy2(src, dst)
        changes.append(f'seeded {dst.relative_to(ROOT)} from V1')

# Create an EV tariff placeholder if no curated file exists yet.
ev_file = V2 / 'ev_charging_prices.json'
if not ev_file.exists():
    ev_file.write_text(json.dumps({
        'updated': None,
        'unit': 'pence per kilowatt hour',
        'note': 'Curated EV charging tariff table for V2 transport energy comparison.',
        'operators': [
            {'operator': 'Gridserve', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://www.gridserve.com/electric-highway/', 'lastChecked': None},
            {'operator': 'Instavolt', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://instavolt.co.uk/', 'lastChecked': None},
            {'operator': 'BP Pulse', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://www.bppulse.co.uk/', 'lastChecked': None},
            {'operator': 'Shell Recharge', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://shellrecharge.com/', 'lastChecked': None},
            {'operator': 'Tesla Supercharger', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://www.tesla.com/en_gb/supercharger', 'lastChecked': None},
            {'operator': 'IONITY', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://ionity.eu/', 'lastChecked': None},
            {'operator': 'Osprey', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://ospreycharging.co.uk/', 'lastChecked': None},
            {'operator': 'Fastned', 'rapidPencePerKWh': None, 'ultraRapidPencePerKWh': None, 'membershipPencePerKWh': None, 'sourceUrl': 'https://fastnedcharging.com/', 'lastChecked': None}
        ]
    }, indent=2), encoding='utf-8')
    changes.append('created V2 EV charging tariff placeholder')

text = PAGE.read_text(encoding='utf-8')

css_marker = '@media (max-width: 850px) { .oil-stats-grid'
css_add = '''.fuel-logic-panel, .ev-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:14px; margin-top:14px; color:var(--gg-muted); font-size:13px; line-height:1.55; }
.fuel-logic-panel strong, .ev-panel strong { color:var(--gg-text); }
.fuel-source-links { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
.fuel-source-links a { border:1px solid var(--gg-line); border-radius:4px; padding:7px 9px; color:#7fdfff; }
.ev-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:10px; }
.ev-card { border:1px solid var(--gg-line); background:var(--gg-panel); border-radius:6px; padding:12px; }
.ev-card-value { color:var(--gg-green); font-size:22px; font-weight:800; margin-top:6px; }
.ev-map-frame { width:100%; height:360px; border:1px solid var(--gg-line); border-radius:6px; margin-top:12px; background:#050505; }
@media (max-width: 850px) { .ev-card-grid { grid-template-columns:1fr; } .ev-map-frame { height:300px; } }
'''
if css_add.strip() not in text and css_marker in text:
    text = text.replace(css_marker, css_add + css_marker, 1)
    changes.append('inserted V2 transport CSS')

text = text.replace('This page uses V1 live feeds until V2 data pipelines are approved.', 'This page uses isolated V2 feeds for development and transport energy testing.')

var_old = 'var ENERGY="/uk_energy_tracking/live_grid_energy.json", PRICE="/uk_energy_tracking/live_grid_price.json", OIL="/uk_energy_tracking/live_oil_prices.json", OIL_HISTORY="/uk_energy_tracking/oil_price_history.geojson", POLL=5*60*1000;'
var_new = 'var ENERGY="/uk_energy_tracking_v2/live_grid_energy.json", PRICE="/uk_energy_tracking_v2/live_grid_price.json", OIL="/uk_energy_tracking_v2/live_oil_prices.json", OIL_HISTORY="/uk_energy_tracking_v2/oil_price_history.geojson", FUEL="/uk_energy_tracking_v2/live_uk_fuel_prices.json", EV_PRICES="/uk_energy_tracking_v2/ev_charging_prices.json", POLL=5*60*1000;'
if var_old in text:
    text = text.replace(var_old, var_new, 1)
    changes.append('repointed V2 dashboard to isolated V2 feeds')

old_section = '''  <section>
    <h2 class="section-title" style="font-size:18px;color:#a6adbb;">UK Pump Prices</h2>
    <div class="pump-grid">
      <div class="pump-card"><div class="pump-label">Petrol</div><div class="pump-value" id="petrol-price">—</div><div class="commodity-unit">Pence per litre</div></div>
      <div class="pump-card"><div class="pump-label">Diesel</div><div class="pump-value" id="diesel-price">—</div><div class="commodity-unit">Pence per litre</div></div>
    </div>
  </section>'''
new_section = '''  <section>
    <h2 class="section-title" style="font-size:18px;color:#a6adbb;">Road Fuel & EV Charging</h2>
    <div class="pump-grid">
      <div class="pump-card"><div class="pump-label">Petrol</div><div class="pump-value" id="petrol-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
      <div class="pump-card"><div class="pump-label">Diesel</div><div class="pump-value" id="diesel-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
    </div>
    <div class="fuel-logic-panel">
      <strong>Road fuel price logic:</strong> Brent crude is quoted in US dollars per barrel. A rough product cost proxy converts USD per barrel into GBP per litre by applying an FX assumption and dividing by about 159 litres per barrel. UK pump prices then add refining spread, wholesale margin, logistics, retail margin, fuel duty and VAT.
      <div id="fuel-breakdown" style="margin-top:10px;">Awaiting DESNZ fuel price feed.</div>
      <div class="fuel-source-links">
        <a href="https://www.gov.uk/government/statistics/weekly-road-fuel-prices" target="_blank" rel="noopener noreferrer">DESNZ weekly road fuel prices</a>
        <a href="https://www.gov.uk/tax-on-shopping/fuel-duty" target="_blank" rel="noopener noreferrer">GOV.UK fuel duty</a>
        <a href="https://www.gov.uk/vat-rates" target="_blank" rel="noopener noreferrer">GOV.UK VAT rates</a>
      </div>
    </div>
    <div class="ev-panel">
      <strong>EV charging comparison placeholder:</strong> Public EV tariffs will be compared with petrol, diesel, wholesale electricity and operator tariff data. The Atlas V8 reference is embedded below while the exact EV charging layer path is verified.
      <div class="ev-card-grid">
        <div class="ev-card"><div class="pump-label">Rapid EV</div><div class="ev-card-value" id="ev-rapid-price">Tariff table pending</div><div class="commodity-unit">Pence per kilowatt hour</div></div>
        <div class="ev-card"><div class="pump-label">Ultra rapid EV</div><div class="ev-card-value" id="ev-ultra-price">Tariff table pending</div><div class="commodity-unit">Pence per kilowatt hour</div></div>
        <div class="ev-card"><div class="pump-label">Atlas EV layer</div><div class="ev-card-value">Reference</div><div class="commodity-unit">Copy after exact Atlas V8 path is verified</div></div>
      </div>
      <iframe class="ev-map-frame" src="/repd_grid_atlasv8/" loading="lazy" title="Atlas V8 reference map"></iframe>
    </div>
  </section>'''
if old_section in text:
    text = text.replace(old_section, new_section, 1)
    changes.append('replaced pump section with V2 road fuel and EV section')

old_render = '''  function renderCommodities(oil){
    oil=oil||{};
    setText("brent-price", oil.brentUSDperBarrel==null?"—":"$"+fmt(oil.brentUSDperBarrel,2));
    setText("wti-price", oil.wtiUSDperBarrel==null?"—":"$"+fmt(oil.wtiUSDperBarrel,2));
    var pump=oil.ukPumpPrices||{};
    setText("petrol-price", pump.petrolPencePerLitre==null?"—":fmt(pump.petrolPencePerLitre,2)+"p");
    setText("diesel-price", pump.dieselPencePerLitre==null?"—":fmt(pump.dieselPencePerLitre,2)+"p");
  }'''
new_render = '''  function renderCommodities(oil,fuel){
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
  }'''
if old_render in text:
    text = text.replace(old_render, new_render, 1)
    changes.append('wired DESNZ fuel feed into V2 pump cards')

old_refresh = 'Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY)]).then(function(res){\n      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3];\n      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));\n      if(e.mix) renderMix(e.mix); renderCommodities(oil); if(hist) drawOilTrend(hist);'
new_refresh = 'Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY),getJSON(FUEL),getJSON(EV_PRICES)]).then(function(res){\n      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3], fuel=res[4]||{}, ev=res[5]||{};\n      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));\n      if(e.mix) renderMix(e.mix); renderCommodities(oil,fuel); renderEvPrices(ev); if(hist) drawOilTrend(hist);'
if old_refresh in text:
    text = text.replace(old_refresh, new_refresh, 1)
    changes.append('added V2 fuel and EV JSON to refresh loop')

insert_marker = '  function refresh(){'
insert_code = '''  function renderEvPrices(ev){
    var ops=(ev&&ev.operators)||[];
    var rapid=[], ultra=[];
    ops.forEach(function(o){ if(o.rapidPencePerKWh!=null) rapid.push(Number(o.rapidPencePerKWh)); if(o.ultraRapidPencePerKWh!=null) ultra.push(Number(o.ultraRapidPencePerKWh)); });
    if(rapid.length){ setText("ev-rapid-price", fmt(rapid.reduce(function(a,b){return a+b;},0)/rapid.length,1)+"p"); }
    if(ultra.length){ setText("ev-ultra-price", fmt(ultra.reduce(function(a,b){return a+b;},0)/ultra.length,1)+"p"); }
  }
'''
if 'function renderEvPrices' not in text and insert_marker in text:
    text = text.replace(insert_marker, insert_code + insert_marker, 1)
    changes.append('added V2 EV tariff renderer')

PAGE.write_text(text, encoding='utf-8')
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('# UK energy tracking V2 transport patch\n\n' + '\n'.join('- ' + c for c in changes) + '\n', encoding='utf-8')
print('V2 transport patch complete')
