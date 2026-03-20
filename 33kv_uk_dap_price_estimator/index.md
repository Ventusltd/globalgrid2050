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
    Screen size must be selected to meet earth fault requirements. BS 7870 Table 6 provides the validated screen resistance values.  [oai_citation:1‡BS7870.4-10.pdf](sediment://file_000000004c94724699bee7ab29820e0b)
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

<h3>LV AC and DC Single Core Sales Model. Hollow Price / Attached Target plus Surge Price Noise</h3>

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
  let hollow_price = parseFloat(document.getElementById("hollow_price").value) || 0;
  let surge_price = parseFloat(document.getElementById("surge_price").value) || 0;

  if (!fx_gbp || !fx_eur || !target_pct) return;

  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;
  document.getElementById("gbp_eur").innerHTML = gbp_eur.toFixed(4);
  document.getElementById("eur_gbp").innerHTML = eur_gbp.toFixed(4);

  let { cu_price, al_price, symbol } = getPricesInCurrency(cu, al, fx_gbp, fx_eur, currency);

  render33kV(cu_price, al_price, symbol, target_pct, selected_cws);
  renderLV(cu_price, al_price, symbol, hollow_price, surge_price);
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

function renderLV(cu_price, al_price, symbol, hollow_price, surge_price) {
  let tbody = document.querySelector("#lvTbl tbody");
  tbody.innerHTML = "";

  let sales_factor = hollow_price + surge_price;

  lvSizes.forEach(size => {
    let cu_kg = size * 9.6;
    let al_kg = size * 2.92;

    let cu_metal = cu_kg * (cu_price / 1000);
    let al_metal = al_kg * (al_price / 1000);

    let cu_net = cu_metal + sales_factor;
    let al_net = al_metal + sales_factor;

    let rowCu = `<tr>
      <td><strong>${size}</strong></td>
      <td>Copper</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${cu_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${sales_factor.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td><strong>${symbol}${cu_net.toLocaleString('en-GB', {maximumFractionDigits:0})}</strong></td>
    </tr>`;

    let rowAl = `<tr>
      <td><strong>${size}</strong></td>
      <td>Aluminium</td>
      <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${al_metal.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
      <td>${symbol}${sales_factor.toLocaleString('en-GB', {maximumFractionDigits:0})}</td>
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
