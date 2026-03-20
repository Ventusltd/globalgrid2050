<h2>33 kV Cable Price Estimator & LV Single Core Sales Model</h2>

<p>
33 kV section uses aluminium conductor with copper wire screen and BS 7870 screen resistance references.<br>
LV section below uses single core copper and aluminium conductors with no screen and a user entered Hollow Price / Attached Target plus Surge Price Noise.
</p>

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border:1px solid #ddd; border-radius:8px;">

  <label><strong>Copper USD/Tonne</strong></label><br>
  <input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>Aluminium USD/Tonne</strong></label><br>
  <input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>GBP/USD (Live Auto Fetch)</strong></label><br>
  <input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>EUR/USD (Live Auto Fetch)</strong></label><br>
  <input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <div style="font-size:0.9em; color:#555; margin-bottom:15px;">
    <strong id="fx_time">Fetching live FX...</strong><br>
    <em>Live Cross Rates: 1 GBP = <span id="gbp_eur">...</span> EUR | 1 EUR = <span id="eur_gbp">...</span> GBP</em>
  </div>

  <label><strong>33 kV Target Metal Content (%)</strong></label><br>
  <input id="metal_pct_target" type="number" value="30" step="1" min="15" max="60" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>33 kV Copper Wire Screen Size</strong></label><br>
  <select id="cws_input" onchange="calc()" style="width:100%;padding:10px;margin-bottom:6px;box-sizing:border-box;">
    <option value="50" selected>50 mm²</option>
    <option value="35">35 mm²</option>
    <option value="25">25 mm²</option>
    <option value="16">16 mm²</option>
  </select>
  <p style="font-size:0.85em; color:#666; margin-top:0; margin-bottom:15px;">
    Screen size must be selected to meet earth fault requirements. BS 7870 Table 6 provides validated screen resistance values.
  </p>

  <label><strong>LV Hollow Price / Attached Target</strong></label><br>
  <input id="hollow_price" type="number" value="0" step="1" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>LV Surge Price Noise</strong></label><br>
  <input id="surge_price" type="number" value="0" step="1" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>Display Currency</strong></label><br>
  <select id="currency" onchange="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
  </select>

</div>

<h3>33 kV Aluminium Cable with Copper Wire Screen</h3>

<div style="overflow-x:auto; margin-bottom:25px;">
<table id="liveTbl33" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.95em;">
<thead>
<tr>
<th>Cond. mm²</th>
<th>CWS mm²</th>
<th>CWS R20 Ω/km</th>
<th>Al kg/km</th>
<th>Cu kg/km</th>
<th>Al R90 Ω/km</th>
<th>Total Metal</th>
<th>Target Metal %</th>
<th>Net Price</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<h3>LV AC and DC Single Core Sales Model</h3>

<div style="overflow-x:auto; margin-bottom:25px;">
<table id="lvTbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.95em;">
<thead>
<tr>
<th>mm²</th>
<th>Material</th>
<th>kg/km</th>
<th>Metal Value</th>
<th>Sales Factor</th>
<th>Net Price</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<h3>Disclaimer</h3>
<p style="font-size:0.9em; color:#444; line-height:1.5;">
This model provides general engineering guidance for estimation and comparison only and does not constitute project specific design.<br>
Outputs are indicative and must be validated through full system studies including fault levels, protection coordination, circuit breaker sizing, installation conditions and system behaviour.<br>
Solar and storage infrastructure operate within wider economic frameworks where assets can trade above £1.35 per watt peak, energy above £0.30 per kWh and EV charging up to £0.89 per kWh, requiring alignment between engineering integrity and commercial value.<br>
Final pricing, performance and supply depend on manufacturer design, factory capacity, material availability and network conditions, including behaviour under DC leakage, insulation stress and high current operation.<br>
Price must never drive decisions ahead of energy efficiency, system stability or long term network integrity across LV, MV, solar and BESS systems.
</p>

<style>
table th {
  position: sticky;
  top: 0;
  background: #111;
  color: #fff;
  z-index: 2;
  white-space: nowrap;
}
table th, table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
table tr:nth-child(even) {
  background: #fafafa;
}
@media print {
  select, input {
    display: none;
  }
}
</style>

<script>
const al_res_20c = {
  120: 0.253, 150: 0.206, 185: 0.164, 240: 0.125, 300: 0.100,
  400: 0.0778, 500: 0.0605, 630: 0.0469, 800: 0.0367, 1000: 0.0291,
  1200: 0.0247, 1400: 0.0212, 1600: 0.0186, 1800: 0.0165, 2000: 0.0149, 2500: 0.0127
};

const cws_res_20c_bs7870 = {
  16: 1.19,
  25: 0.759,
  35: 0.542,
  50: 0.379
};

const mvConductors = [120,150,185,240,300,400,500,630,800,1000,1200,1400,1600,1800,2000,2500];

const lvSizes = [
  4,6,10,16,25,35,50,70,95,120,150,185,240,300,400,500,630,800,1000,1200,1400,1600,1800,2000,2500
];

async function fetchFX() {
  try {
    let res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=GBP,EUR");
    let data = await res.json();

    document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
    document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
    updateFXTime();

  } catch (e) {}
}

function updateFXTime() {
  let now = new Date();
  document.getElementById("fx_time").innerHTML = "Live FX Timestamp: " + now.toUTCString();
}

function getPrices(cu, al, fx_gbp, fx_eur, currency) {
  if (currency === "GBP") return { cu: cu / fx_gbp, al: al / fx_gbp, sym: "£" };
  if (currency === "EUR") return { cu: cu / fx_eur, al: al / fx_eur, sym: "€" };
  return { cu: cu, al: al, sym: "$" };
}

function calc() {
  let cu = parseFloat(cu.value) || 0;
  let al = parseFloat(al.value) || 0;
  let fxg = parseFloat(fx_gbp.value) || 1;
  let fxe = parseFloat(fx_eur.value) || 1;
  let cur = currency.value;
  let pct = parseFloat(metal_pct_target.value) || 30;
  let cws = parseFloat(cws_input.value) || 50;
  let hollow = parseFloat(hollow_price.value) || 0;
  let surge = parseFloat(surge_price.value) || 0;

  let {cu: cuP, al: alP, sym} = getPrices(cu, al, fxg, fxe, cur);

  let tbody = document.querySelector("#liveTbl33 tbody");
  tbody.innerHTML = "";

  mvConductors.forEach(s => {
    let alkg = s * 2.92;
    let cukg = cws * 9.6;
    let total = (alkg * alP + cukg * cuP) / 1000;
    let net = total / (pct/100);

    tbody.innerHTML += `<tr>
      <td>${s}</td><td>${cws}</td><td>${cws_res_20c_bs7870[cws]}</td>
      <td>${alkg.toFixed(0)}</td><td>${cukg.toFixed(0)}</td>
      <td>${(al_res_20c[s]*(1+0.00403*70)).toFixed(4)}</td>
      <td>${sym}${total.toFixed(0)}</td><td>${pct}%</td>
      <td><b>${sym}${net.toFixed(0)}</b></td></tr>`;
  });

  let lv = document.querySelector("#lvTbl tbody");
  lv.innerHTML = "";

  let sales = hollow + surge;

  lvSizes.forEach(s => {
    let cuv = (s*9.6*cuP)/1000;
    let alv = (s*2.92*alP)/1000;

    lv.innerHTML += `<tr><td>${s}</td><td>Copper</td><td>${(s*9.6).toFixed(0)}</td><td>${sym}${cuv.toFixed(0)}</td><td>${sym}${sales.toFixed(0)}</td><td><b>${sym}${(cuv+sales).toFixed(0)}</b></td></tr>`;
    lv.innerHTML += `<tr><td>${s}</td><td>Aluminium</td><td>${(s*2.92).toFixed(0)}</td><td>${sym}${alv.toFixed(0)}</td><td>${sym}${sales.toFixed(0)}</td><td><b>${sym}${(alv+sales).toFixed(0)}</b></td></tr>`;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchFX();
  calc();
});
</script>
