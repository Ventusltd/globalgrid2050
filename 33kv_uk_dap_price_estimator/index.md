<h2>Live Pricing Engine: 33 kV & LV Single Core Models</h2>

<p>
Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.<br>
The LV section models single-core copper and aluminium conductors. Both allow user-defined non-metal cost percentages or flat hollow prices to calculate final net prices.
</p>

<h3>Weight Formulas & Rules</h3>
<ul style="margin-bottom: 25px;">
<li><strong>Copper kg per km</strong> = mm² × 9.6</li>
<li><strong>Aluminium kg per km</strong> = mm² × 2.92</li>
<li><strong>Net Price Rule</strong> = Total Metal Value + Non-Metal Costs (Polymers, Labour, Margin, Logistics)</li>
</ul>

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border:1px solid #ddd; border-radius:8px;">

  <label><strong>Copper USD/Tonne</strong></label><br>
  <input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>Aluminium USD/Tonne</strong></label><br>
  <input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>GBP/USD (Live Auto Fetch)</strong></label><br>
  <input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>EUR/USD (Live Auto Fetch)</strong></label><br>
  <input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <div style="font-size:0.9em; color:#555; margin-bottom:20px;">
    <strong id="fx_time">Fetching live FX...</strong><br>
    <em>Live Cross Rates: 1 GBP = <span id="gbp_eur">...</span> EUR | 1 EUR = <span id="eur_gbp">...</span> GBP</em>
  </div>

  <h4 style="margin-bottom:5px;">Manufacturing & Supplier Quotation Inputs</h4>
  <p style="font-size:0.85em; color:#555; margin-top:0; margin-bottom:15px; line-height:1.4;">
    <strong>Disclaimer:</strong> The default Non-Metal % is set to <strong>70%</strong> (which mathematically equals <em>Metals ÷ 0.3</em>). This is intended for high-level estimates only. When you have confirmed official quotes or hollow prices from a supplier, update the percentage or input the exact numerical currency value below.
  </p>

  <label><strong>Supplier Quote Currency (Applies to Flat Values Below)</strong></label><br>
  <select id="flat_currency" onchange="calc()" style="width:100%;padding:10px;margin-bottom:15px;box-sizing:border-box;background:#eef8e5;">
    <option value="EUR" selected>EUR (€)</option>
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
  </select>

  <div style="display:flex; gap:15px; margin-bottom:10px;">
    <div style="flex:1;">
      <label><strong>33 kV Non-Metal Cost (%)</strong></label><br>
      <input id="mv_non_metal_pct" type="number" value="70" step="1" min="0" max="99" oninput="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
    <div style="flex:1;">
      <label><strong>33 kV Flat Hollow Price (Value)</strong></label><br>
      <input id="mv_flat_val" type="number" value="0" step="1" oninput="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
  </div>

  <div style="display:flex; gap:15px; margin-bottom:15px;">
    <div style="flex:1;">
      <label><strong>LV Non-Metal Cost (%)</strong></label><br>
      <input id="lv_non_metal_pct" type="number" value="70" step="1" min="0" max="99" oninput="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
    <div style="flex:1;">
      <label><strong>LV Flat Hollow Price (Value)</strong></label><br>
      <input id="lv_flat_val" type="number" value="0" step="1" oninput="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
  </div>

  <label><strong>33 kV Copper Wire Screen Size</strong></label><br>
  <select id="cws_input" onchange="calc()" style="width:100%;padding:10px;margin-bottom:15px;box-sizing:border-box;">
    <option value="50" selected>50 mm²</option>
    <option value="35">35 mm²</option>
    <option value="25">25 mm²</option>
    <option value="16">16 mm²</option>
  </select>

  <label><strong>Intermediate Display Currency (For Metal & Non-Metal Columns)</strong></label><br>
  <select id="currency" onchange="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
  </select>

</div>

<h3>33 kV Aluminium Cable with Copper Wire Screen</h3>

<div style="overflow-x:auto; margin-bottom:30px;">
<table id="liveTbl33" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.90em;">
<thead>
<tr>
<th>Cond. mm²</th>
<th>CWS mm²</th>
<th>Al kg/km</th>
<th>Cu kg/km</th>
<th>Al R90 Ω/km</th>
<th>Total Metal</th>
<th>Non-Metal Cost</th>
<th style="background:#003366;">Net Price (£)</th>
<th style="background:#004d00;">Net Price ($)</th>
<th style="background:#800000;">Net Price (€)</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<h3>LV AC and DC Single Core Sales Model</h3>

<div style="overflow-x:auto; margin-bottom:30px;">
<table id="lvTbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.90em;">
<thead>
<tr>
<th>mm²</th>
<th>Material</th>
<th>kg/km</th>
<th>Metal Value</th>
<th>Non-Metal Cost</th>
<th style="background:#003366;">Net Price (£)</th>
<th style="background:#004d00;">Net Price ($)</th>
<th style="background:#800000;">Net Price (€)</th>
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

const mvCables = [
  [120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
  [800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

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

function getBaseCurrencyMult(curr, fx_gbp, fx_eur) {
  if (curr === "GBP") return 1 / fx_gbp;
  if (curr === "EUR") return 1 / fx_eur;
  return 1; // USD
}

function calc() {
  let cu_usd = parseFloat(document.getElementById("cu").value) || 0;
  let al_usd = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  
  let mv_pct = parseFloat(document.getElementById("mv_non_metal_pct").value) || 0;
  let lv_pct = parseFloat(document.getElementById("lv_non_metal_pct").value) || 0;
  let mv_flat = parseFloat(document.getElementById("mv_flat_val").value) || 0;
  let lv_flat = parseFloat(document.getElementById("lv_flat_val").value) || 0;
  
  let flat_curr = document.getElementById("flat_currency").value;
  let disp_curr = document.getElementById("currency").value;

  if (!fx_gbp || !fx_eur) return;

  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;
  document.getElementById("gbp_eur").innerHTML = gbp_eur.toFixed(4);
  document.getElementById("eur_gbp").innerHTML = eur_gbp.toFixed(4);

  let flat_mult_to_usd = 1;
  if (flat_curr === "EUR") flat_mult_to_usd = fx_eur;
  if (flat_curr === "GBP") flat_mult_to_usd = fx_gbp;
  
  let mv_flat_usd = mv_flat * flat_mult_to_usd;
  let lv_flat_usd = lv_flat * flat_mult_to_usd;

  let disp_mult = getBaseCurrencyMult(disp_curr, fx_gbp, fx_eur);
  let disp_symbol = disp_curr === "GBP" ? "£" : disp_curr === "EUR" ? "€" : "$";

  render33kV(cu_usd, al_usd, mv_pct, mv_flat_usd, disp_mult, disp_symbol, fx_gbp, fx_eur);
  renderLV(cu_usd, al_usd, lv_pct, lv_flat_usd, disp_mult, disp_symbol, fx_gbp, fx_eur);
}

function render33kV(cu_usd, al_usd, mv_pct, mv_flat_usd, disp_mult, disp_sym, fx_gbp, fx_eur) {
  let tbody = document.querySelector("#liveTbl33 tbody");
  tbody.innerHTML = "";

  let metal_ratio = (100 - mv_pct) / 100;
  if (metal_ratio <= 0) metal_ratio = 1; 

  mvCables.forEach(c => {
    let cond = c[0];
    let cws = c[1];
    
    let al_kg = cond * 2.92;
    let cu_kg = cws * 9.6;
    let res_20 = al_res_20c[cond];
    let res_90 = res_20 * (1 + 0.00403 * (90 - 20));

    let al_cost_usd = al_kg * (al_usd / 1000);
    let cu_cost_usd = cu_kg * (cu_usd / 1000);
    let total_metal_usd = al_cost_usd + cu_cost_usd;
    
    let net_usd = (total_metal_usd / metal_ratio) + mv_flat_usd;
    let non_metal_usd = net_usd - total_metal_usd;

    let disp_total_metal = total_metal_usd * disp_mult;
    let disp_non_metal = non_metal_usd * disp_mult;

    let net_gbp = net_usd / fx_gbp;
    let net_eur = net_usd / fx_eur;

    let row = `<tr>
      <td><strong>${cond}</strong></td>
      <td>${cws}</td>
      <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${res_90.toFixed(4)}</td>
      <td>${disp_sym}${disp_total_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${disp_sym}${disp_non_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td style="background:#e6f0ff; color:#000;"><strong>£${net_gbp.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
      <td style="background:#e6ffe6; color:#000;"><strong>$${net_usd.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
      <td style="background:#ffe6e6; color:#000;"><strong>€${net_eur.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function renderLV(cu_usd, al_usd, lv_pct, lv_flat_usd, disp_mult, disp_sym, fx_gbp, fx_eur) {
  let tbody = document.querySelector("#lvTbl tbody");
  tbody.innerHTML = "";

  let metal_ratio = (100 - lv_pct) / 100;
  if (metal_ratio <= 0) metal_ratio = 1;

  lvSizes.forEach(size => {
    let cu_kg = size * 9.6;
    let cu_metal_usd = cu_kg * (cu_usd / 1000);
    let cu_net_usd = (cu_metal_usd / metal_ratio) + lv_flat_usd;
    let cu_non_metal_usd = cu_net_usd - cu_metal_usd;

    let disp_cu_metal = cu_metal_usd * disp_mult;
    let disp_cu_nm = cu_non_metal_usd * disp_mult;

    let rowCu = `<tr>
      <td><strong>${size}</strong></td>
      <td>Copper</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${disp_sym}${disp_cu_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${disp_sym}${disp_cu_nm.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td style="background:#e6f0ff; color:#000;"><strong>£${(cu_net_usd / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
      <td style="background:#e6ffe6; color:#000;"><strong>$${cu_net_usd.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
      <td style="background:#ffe6e6; color:#000;"><strong>€${(cu_net_usd / fx_eur).toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;

    let rowAl = "";
    if (size >= 10) {
      let al_kg = size * 2.92;
      let al_metal_usd = al_kg * (al_usd / 1000);
      let al_net_usd = (al_metal_usd / metal_ratio) + lv_flat_usd;
      let al_non_metal_usd = al_net_usd - al_metal_usd;

      let disp_al_metal = al_metal_usd * disp_mult;
      let disp_al_nm = al_non_metal_usd * disp_mult;

      rowAl = `<tr>
        <td><strong>${size}</strong></td>
        <td>Aluminium</td>
        <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
        <td>${disp_sym}${disp_al_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
        <td>${disp_sym}${disp_al_nm.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
        <td style="background:#e6f0ff; color:#000;"><strong>£${(al_net_usd / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
        <td style="background:#e6ffe6; color:#000;"><strong>$${al_net_usd.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
        <td style="background:#ffe6e6; color:#000;"><strong>€${(al_net_usd / fx_eur).toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
      </tr>`;
    }

    tbody.innerHTML += rowCu + rowAl;
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  await fetchFX();
  calc();
});
</script>
