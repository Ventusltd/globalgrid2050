<h2>33 kV Aluminium XLPE Cable Price Estimator (Fixed Reference)</h2>

<p>
Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.
</p>
<p>
Large scale price estimator for global 33 kV cable supply delivered to site with typical manufacturing lead times of 10 to 30 weeks.
</p>

<h3>Market Inputs</h3>

<div style="overflow-x:auto;">
<table class="refTbl">
<tr><th>Parameter</th><th>Value</th></tr>
<tr><td>LME Copper (USD)</td><td>$12,850 / tonne</td></tr>
<tr><td>LME Aluminium (USD)</td><td>$3,520 / tonne</td></tr>
<tr><td>GBP/USD Rate</td><td>1 GBP = 1.3265 USD</td></tr>
<tr><td>Copper (GBP)</td><td>£9,687 / tonne</td></tr>
<tr><td>Aluminium (GBP)</td><td>£2,654 / tonne</td></tr>
<tr><td>Last Update</td><td>Friday 20 March 2026 19:05 UTC</td></tr>
</table>
</div>

<h3>Weight Formulas</h3>
<ul>
<li><strong>Copper kg per km</strong> = mm² × 9.6</li>
<li><strong>Aluminium kg per km</strong> = mm² × 2.92</li>
</ul>

<h3>Net Price Rule</h3>
<p><strong>Net cable price ≈ Metal value ÷ 0.3</strong></p>
<p>Typical cost structure:</p>
<ul>
<li><strong>Metal content:</strong> ≈ 30%</li>
<li><strong>Manufacturing, logistics, and margin:</strong> ≈ 70%</li>
</ul>

<h3>Cable Metal and Net Price Estimator</h3>

<div style="overflow-x:auto; margin-bottom: 40px;">
<table class="refTbl">
<thead>
<tr>
<th>Conductor mm²</th>
<th>CWS mm²</th>
<th>Aluminium kg/km</th>
<th>Copper kg/km</th>
<th>Aluminium £/km</th>
<th>Copper £/km</th>
<th>Total metal £/km</th>
</tr>
</thead>
<tbody>
<tr><td>120</td><td>35</td><td>350.4</td><td>336.0</td><td>930</td><td>3,255</td><td>4,185</td></tr>
<tr><td>150</td><td>35</td><td>438.0</td><td>336.0</td><td>1,162</td><td>3,255</td><td>4,417</td></tr>
<tr><td>185</td><td>35</td><td>540.2</td><td>336.0</td><td>1,433</td><td>3,255</td><td>4,688</td></tr>
<tr><td>240</td><td>35</td><td>700.8</td><td>336.0</td><td>1,860</td><td>3,255</td><td>5,115</td></tr>
<tr><td>300</td><td>35</td><td>876.0</td><td>336.0</td><td>2,325</td><td>3,255</td><td>5,579</td></tr>
<tr><td>400</td><td>35</td><td>1,168.0</td><td>336.0</td><td>3,099</td><td>3,255</td><td>6,354</td></tr>
<tr><td>500</td><td>35</td><td>1,460.0</td><td>336.0</td><td>3,874</td><td>3,255</td><td>7,129</td></tr>
<tr><td>630</td><td>35</td><td>1,839.6</td><td>336.0</td><td>4,882</td><td>3,255</td><td>8,136</td></tr>
<tr><td>800</td><td>50</td><td>2,336.0</td><td>480.0</td><td>6,199</td><td>4,650</td><td>10,849</td></tr>
<tr><td>1000</td><td>50</td><td>2,920.0</td><td>480.0</td><td>7,749</td><td>4,650</td><td>12,398</td></tr>
<tr><td>1200</td><td>50</td><td>3,504.0</td><td>480.0</td><td>9,298</td><td>4,650</td><td>13,948</td></tr>
<tr><td>1400</td><td>50</td><td>4,088.0</td><td>480.0</td><td>10,848</td><td>4,650</td><td>15,498</td></tr>
<tr><td>1600</td><td>50</td><td>4,672.0</td><td>480.0</td><td>12,398</td><td>4,650</td><td>17,047</td></tr>
<tr><td>1800</td><td>50</td><td>5,256.0</td><td>480.0</td><td>13,947</td><td>4,650</td><td>18,597</td></tr>
<tr><td>2000</td><td>50</td><td>5,840.0</td><td>480.0</td><td>15,497</td><td>4,650</td><td>20,147</td></tr>
<tr><td>2500</td><td>50</td><td>7,300.0</td><td>480.0</td><td>19,371</td><td>4,650</td><td>24,021</td></tr>
</tbody>
</table>
</div>

<hr style="border: 2px solid #333; margin-bottom: 40px;">

<h2>Live Pricing Engine: 33 kV & LV Single Core Models</h2>

<p>
The 33 kV section models aluminium conductors with a copper wire screen, utilizing BS 7870 screen resistance limits.<br>
The LV section models single-core copper and aluminium conductors with a user-defined input for all non-metal costs.
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
    Screen size must be selected to meet earth fault requirements. BS 7870 Table 6 provides the validated screen resistance values.
  </p>

  <label><strong>LV Non-Metal Costs (Polymers, Labour, Margin)</strong></label><br>
  <input id="lv_non_metal" type="number" value="0" step="1" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

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
<th>Non-Metal Costs</th>
<th>Net Price</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<h3>Notes & Disclaimer</h3>
<p>
This estimator supports rapid early-stage cost analysis for Solar farms, Battery energy storage systems (BESS), Wind farms, Utility substations, and Transmission and distribution connections.
</p>
<p>
<strong>Disclaimer:</strong> These values are derived from live market data feeds. Actual cable pricing varies based on project volume, factory loading, and specific utility requirements. No warranty is given for data accuracy.
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
.refTbl {
  border-collapse: collapse;
  width: 100%;
  font-family: Courier, monospace;
  font-size: 0.95em;
}
.refTbl th {
  background: #333;
  color: #fff;
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

    if (!data.rates || !data.rates.GBP || !data.rates.EUR) throw new Error("Primary FX failed");

    document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
    document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
    updateFXTime();

  } catch (e) {
    try {
      let res = await fetch("https://open.er-api.com/v6/latest/USD");
      let data = await res.json();

      document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
      document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
      updateFXTime();

    } catch (err) {
      let fxTimeEl = document.getElementById("fx_time");
      if (fxTimeEl) fxTimeEl.innerHTML = "Live FX unavailable. Using manual inputs";
    }
  }
}

function updateFXTime() {
  let now = new Date();
  let fxTimeEl = document.getElementById("fx_time");
  if (fxTimeEl) fxTimeEl.innerHTML = "Live FX Timestamp: " + now.toUTCString();
}

function getPricesInCurrency(cu, al, fx_gbp, fx_eur, currency) {
  let cu_price, al_price, symbol;

  if (currency === "GBP") {
    cu_price = cu / fx_gbp;
    al_price = al / fx_gbp;
    symbol = "£";
  } else if (currency === "EUR") {
    cu_price = cu / fx_eur;
    al_price = al / fx_eur;
    symbol = "€";
  } else {
    cu_price = cu;
    al_price = al;
    symbol = "$";
  }

  return { cu_price, al_price, symbol };
}

function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;
  let target_pct = parseFloat(document.getElementById("metal_pct_target").value) || 30;
  let selected_cws = parseFloat(document.getElementById("cws_input").value) || 50;
  
  // Single variable for LV non-metal costs
  let lv_non_metal = parseFloat(document.getElementById("lv_non_metal").value) || 0;

  if (!fx_gbp || !fx_eur || !target_pct) return;

  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;
  document.getElementById("gbp_eur").innerHTML = gbp_eur.toFixed(4);
  document.getElementById("eur_gbp").innerHTML = eur_gbp.toFixed(4);

  let { cu_price, al_price, symbol } = getPricesInCurrency(cu, al, fx_gbp, fx_eur, currency);

  render33kV(cu_price, al_price, symbol, target_pct, selected_cws);
  renderLV(cu_price, al_price, symbol, lv_non_metal);
}

function render33kV(cu_price, al_price, symbol, target_pct, selected_cws) {
  let tbody = document.querySelector("#liveTbl33 tbody");
  tbody.innerHTML = "";

  mvConductors.forEach(cond => {
    let al_kg = cond * 2.92;
    let cu_kg = selected_cws * 9.6;
    let res_20 = al_res_20c[cond];
    let res_90 = res_20 * (1 + 0.00403 * (90 - 20));
    let cws_r20 = cws_res_20c_bs7870[selected_cws];

    let al_cost = al_kg * (al_price / 1000);
    let cu_cost = cu_kg * (cu_price / 1000);
    let total_metal = al_cost + cu_cost;
    let net_price = total_metal / (target_pct / 100);

    let row = `<tr>
      <td><strong>${cond}</strong></td>
      <td>${selected_cws}</td>
      <td>${cws_r20.toFixed(3)}</td>
      <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${res_90.toFixed(4)}</td>
      <td>${symbol}${total_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${target_pct.toFixed(1)}%</td>
      <td><strong>${symbol}${net_price.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function renderLV(cu_price, al_price, symbol, lv_non_metal) {
  let tbody = document.querySelector("#lvTbl tbody");
  tbody.innerHTML = "";

  lvSizes.forEach(size => {
    let cu_kg = size * 9.6;
    let al_kg = size * 2.92;

    let cu_metal = cu_kg * (cu_price / 1000);
    let al_metal = al_kg * (al_price / 1000);

    let cu_net = cu_metal + lv_non_metal;
    let al_net = al_metal + lv_non_metal;

    let rowCu = `<tr>
      <td><strong>${size}</strong></td>
      <td>Copper</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${cu_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${lv_non_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td><strong>${symbol}${cu_net.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;

    let rowAl = `<tr>
      <td><strong>${size}</strong></td>
      <td>Aluminium</td>
      <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${al_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${lv_non_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td><strong>${symbol}${al_net.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;

    tbody.innerHTML += rowCu + rowAl;
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  await fetchFX();
  calc();
});
</script>
