# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

Large scale price estimator for global 33 kV cable supply delivered to site with typical manufacturing lead times of 10 to 30 weeks.

---

## Market Inputs

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
  <label><strong>LME Copper (USD/Tonne)</strong></label><br>
  <input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#eef8e5;border:1px solid #999;font-weight:bold;">

  <label><strong>LME Aluminium (USD/Tonne)</strong></label><br>
  <input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#eef8e5;border:1px solid #999;font-weight:bold;">

  <label><strong>Copper (GBP/Tonne)</strong></label><br>
  <input id="cu_gbp_val" readonly style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#fff;border:1px solid #ccc;">

  <label><strong>Aluminium (GBP/Tonne)</strong></label><br>
  <input id="al_gbp_val" readonly style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#fff;border:1px solid #ccc;">

  <label><strong>Copper (EUR/Tonne)</strong></label><br>
  <input id="cu_eur_val" readonly style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#fff;border:1px solid #ccc;">

  <label><strong>Aluminium (EUR/Tonne)</strong></label><br>
  <input id="al_eur_val" readonly style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;background:#fff;border:1px solid #ccc;">

  <label><strong>GBP/USD Rate (Live Auto-Fetch)</strong></label><br>
  <input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label><strong>EUR/USD Rate (Live Auto-Fetch)</strong></label><br>
  <input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <div style="font-size: 0.9em; color: #555; margin-bottom: 15px;">
    <strong id="fx_time">Fetching live FX...</strong>
  </div>

  <label><strong>Display Currency for Tables</strong></label><br>
  <select id="currency" onchange="calc()" style="width:100%;padding:10px;box-sizing:border-box;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
  </select>
</div>

---

## Weight Formulas

- **[span_2](start_span)Copper kg per km** = mm² × 9.6[span_2](end_span)
- **[span_3](start_span)Aluminium kg per km** = mm² × 2.92[span_3](end_span)

---

## Net Price Rule

**[span_4](start_span)Net cable price ≈ Metal value ÷ 0.3**[span_4](end_span)

Typical cost structure:
- **[span_5](start_span)Metal content:** ≈ 30%[span_5](end_span)
- **[span_6](start_span)Manufacturing, logistics, and margin:** ≈ 70%[span_6](end_span)

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
#liveTbl td { border: 1px solid #ddd; padding: 8px; text-align: left; }
#liveTbl tr:nth-child(even) { background-color: #fafafa; }
@media print { select, input { display: none; } }
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
      document.getElementById("fx_time").innerHTML = "Live FX unavailable. Using manual inputs";
    }
  }
}

function updateFXTime() {
  let now = new Date();
  document.getElementById("fx_time").innerHTML = "Last Update: " + now.toUTCString();
}

function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;

  document.getElementById("cu_gbp_val").value = "£" + (cu / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits: 0});
  document.getElementById("al_gbp_val").value = "£" + (al / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits: 0});
  document.getElementById("cu_eur_val").value = "€" + (cu / fx_eur).toLocaleString('en-GB', {maximumFractionDigits: 0});
  document.getElementById("al_eur_val").value = "€" + (al / fx_eur).toLocaleString('en-GB', {maximumFractionDigits: 0});

  let cu_price, al_price, symbol;
  if (currency === "GBP") { cu_price = cu / fx_gbp; al_price = al / fx_gbp; symbol = "£"; }
  else if (currency === "EUR") { cu_price = cu / fx_eur; al_price = al / fx_eur; symbol = "€"; }
  else { cu_price = cu; al_price = al; symbol = "$"; }

  document.querySelectorAll('.sym').forEach(el => el.innerHTML = symbol);
  let tbody = document.querySelector("#liveTbl tbody");
  tbody.innerHTML = "";

  mvCables.forEach(c => {
    let cond = c[0], cws = c[1];
    let al_kg = cond * 2.92, cu_kg = cws * 9.6;
    let al_cost = al_kg * (al_price / 1000), cu_cost = cu_kg * (cu_price / 1000);
    let total_metal = al_cost + cu_cost, net_price = total_metal / 0.3;

    tbody.innerHTML += `<tr>
      <td><strong>${cond}</strong></td><td>${cws}</td>
      <td>${al_kg.toLocaleString('en-GB', {maximumFractionDigits: 1})}</td>
      <td>${cu_kg.toLocaleString('en-GB', {maximumFractionDigits: 1})}</td>
      <td>${symbol}${al_cost.toLocaleString('en-GB', {maximumFractionDigits: 0})}</td>
      <td>${symbol}${cu_cost.toLocaleString('en-GB', {maximumFractionDigits: 0})}</td>
      <td>${symbol}${total_metal.toLocaleString('en-GB', {maximumFractionDigits: 0})}</td>
      <td style="background:#eef8e5;"><strong>${symbol}${net_price.toLocaleString('en-GB', {maximumFractionDigits: 0})}</strong></td>
    </tr>`;
  });
}

document.addEventListener("DOMContentLoaded", async function () { await fetchFX(); calc(); });
</script>

---

## Disclaimer
[span_7](start_span)These values are derived from live market data feeds[span_7](end_span). [span_8](start_span)Actual cable pricing varies based on project volume, factory loading, and specific utility requirements[span_8](end_span). [span_9](start_span)No warranty is given for data accuracy[span_9](end_span).
