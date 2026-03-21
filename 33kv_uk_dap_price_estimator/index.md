# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

Large scale price estimator for global 33 kV cable supply delivered to site with typical manufacturing lead times of 10 to 30 weeks.

---

## Market Inputs

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
  <label><strong>LME Copper (USD/Tonne)</strong></label><br>
  <input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>LME Aluminium (USD/Tonne)</strong></label><br>
  <input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>GBP/USD Rate (Live Auto-Fetch)</strong></label><br>
  <input id="fx_gbp" value="0.7539" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>EUR/USD Rate (Live Auto-Fetch)</strong></label><br>
  <input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <div style="font-size: 0.9em; color: #555; margin-bottom: 15px;">
    <strong id="fx_time">Fetching live FX...</strong>
  </div>

  <label><strong>Display Currency</strong></label><br>
  <select id="currency" onchange="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
  </select>
</div>

---

## Weight Formulas

- **Copper kg per km** = mm² × 9.6  
- **Aluminium kg per km** = mm² × 2.92  

---

## Net Price Rule

**Net cable price ≈ Metal value ÷ 0.3**

Typical cost structure:

- **Metal content:** ≈ 30%  
- **Manufacturing, logistics, and margin:** ≈ 70%  

---

## Cable Metal and Net Price Estimator

<div style="overflow-x:auto; margin-bottom:25px;">
<table id="liveTbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.95em;">
<thead>
<tr>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Cond. mm²</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">CWS mm²</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Al kg/km</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Cu kg/km</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Al Cost/<span class="sym"></span></th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Cu Cost/<span class="sym"></span></th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Total Metal</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff; position:sticky; top:0;">Net Price</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<style>
#liveTbl td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
#liveTbl tr:nth-child(even) {
  background-color: #fafafa;
}
@media print {
  select, input {
    display: none;
  }
}
</style>

<script>
const mvCables = [
  [120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
  [800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
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
  if (fxTimeEl) fxTimeEl.innerHTML = "Last Update: " + now.toUTCString();
}

function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;

  if (!fx_gbp || !fx_eur) return;

  let cu_price, al_price, symbol;

  if (currency === "GBP") {
    cu_price = cu / fx_gbp; al_price = al / fx_gbp; symbol = "£";
  } else if (currency === "EUR") {
    cu_price = cu / fx_eur; al_price = al / fx_eur; symbol = "€";
  } else {
    cu_price = cu; al_price = al; symbol = "$";
  }

  document.querySelectorAll('.sym').forEach(el => el.innerHTML = symbol);

  let tbody = document.querySelector("#liveTbl tbody");
  tbody.innerHTML = "";

  mvCables.forEach(c => {
    let cond = c[0];
    let cws = c[1];
    
    let al_kg = cond * 2.92;
    let cu_kg = cws * 9.6;

    let al_cost = al_kg * (al_price / 1000);
    let cu_cost = cu_kg * (cu_price / 1000);
    
    let total_metal = al_cost + cu_cost;
    let net_price = total_metal / 0.3;

    let fmtAlKg = al_kg.toLocaleString('en-GB', {maximumFractionDigits: 1});
    let fmtCuKg = cu_kg.toLocaleString('en-GB', {maximumFractionDigits: 1});
    let fmtAlCost = al_cost.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtCuCost = cu_cost.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtTotal = total_metal.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtNet = net_price.toLocaleString('en-GB', {maximumFractionDigits: 0});

    let row = `<tr>
      <td><strong>${cond}</strong></td>
      <td>${cws}</td>
      <td>${fmtAlKg}</td>
      <td>${fmtCuKg}</td>
      <td>${symbol}${fmtAlCost}</td>
      <td>${symbol}${fmtCuCost}</td>
      <td>${symbol}${fmtTotal}</td>
      <td style="background:#eef8e5;"><strong>${symbol}${fmtNet}</strong></td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  await fetchFX();
  calc();
});
</script>

---

## Notes

This estimator supports rapid early-stage cost analysis for:

- Solar farms  
- Battery energy storage systems (BESS)  
- Wind farms  
- Utility substations  
- Transmission and distribution connections  

---

## Disclaimer

These values are derived from live market data feeds. Actual cable pricing varies based on project volume, factory loading, and specific utility requirements. No warranty is given for data accuracy.
