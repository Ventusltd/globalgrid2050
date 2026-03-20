<h2>33 kV Cable Price Estimator</h2>

<p>
Quick engineering tool for aluminium 33 kV cables with copper wire screen.<br>
Use live inputs below, then compare against the fixed reference table.
</p>

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
  
  <label>Copper USD/Tonne</label><br>
  <input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label>Aluminium USD/Tonne</label><br>
  <input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label>GBP/USD (Live Auto-Fetch)</label><br>
  <input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <label>EUR/USD (Live Auto-Fetch)</label><br>
  <input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">

  <div style="font-size: 0.9em; color: #555; margin-bottom: 15px;">
    <strong id="fx_time">Fetching live FX...</strong><br>
    <em>Live Cross Rates: 1 GBP = <span id="gbp_eur">...</span> EUR | 1 EUR = <span id="eur_gbp">...</span> GBP</em>
  </div>

  <label>Display Currency</label><br>
  <select id="currency" onchange="calc()" style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
  </select>

</div>

<div style="overflow-x:auto; margin-bottom:25px;">
<table id="liveTbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;">
<thead>
<tr>
<th>Cond. mm²</th>
<th>CWS mm²</th>
<th>Al kg/km</th>
<th>Cu kg/km</th>
<th>Total Metal</th>
<th>Net Price</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<style>
#liveTbl th {
  position: sticky;
  top: 0;
  background: #000;
  color: #fff;
  z-index: 2;
}
#liveTbl th, #liveTbl td {
  border: 1px solid #555;
  padding: 8px;
  text-align: left;
}
@media print {
  button, select, input {
    display: none;
  }
}
</style>

<script>
async function fetchFX() {
  try {
    // PRIMARY API
    let res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=GBP,EUR");
    let data = await res.json();

    // Validate response
    if (!data.rates || !data.rates.GBP || !data.rates.EUR) {
      throw new Error("Primary FX failed");
    }

    let gbp_usd = 1 / data.rates.GBP;
    let eur_usd = 1 / data.rates.EUR;

    document.getElementById("fx_gbp").value = gbp_usd.toFixed(4);
    document.getElementById("fx_eur").value = eur_usd.toFixed(4);

    updateFXTime();

  } catch (e) {
    console.warn("Primary FX failed, trying fallback");

    try {
      // FALLBACK API
      let res = await fetch("https://open.er-api.com/v6/latest/USD");
      let data = await res.json();

      let gbp_usd = 1 / data.rates.GBP;
      let eur_usd = 1 / data.rates.EUR;

      document.getElementById("fx_gbp").value = gbp_usd.toFixed(4);
      document.getElementById("fx_eur").value = eur_usd.toFixed(4);

      updateFXTime();

    } catch (err) {
      console.warn("All FX sources failed — using manual values");
      document.getElementById("fx_time").innerHTML = "Live FX unavailable - Using manual inputs";
    }
  }
}

function updateFXTime() {
  let now = new Date();
  let fxTimeEl = document.getElementById("fx_time");
  if (fxTimeEl) {
      fxTimeEl.innerHTML = "Live FX Timestamp: " + now.toUTCString();
  }
}

function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;

  // SAFETY CHECK
  if (!fx_gbp || !fx_eur) return;

  // Cross rates
  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;

  // Update Cross Rates in UI safely
  let gbpEurEl = document.getElementById("gbp_eur");
  let eurGbpEl = document.getElementById("eur_gbp");
  if (gbpEurEl) gbpEurEl.innerHTML = gbp_eur.toFixed(4);
  if (eurGbpEl) eurGbpEl.innerHTML = eur_gbp.toFixed(4);

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

  let cables = [
    [120,35],[150,35],[185,35],[240,35],[300,35],
    [400,35],[500,35],[630,35],[800,50],[1000,50],
    [1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
  ];

  let tbody = document.querySelector("#liveTbl tbody");
  tbody.innerHTML = "";

  cables.forEach(c => {
    let cond = c[0];
    let cws = c[1];

    let al_kg = cond * 2.92;
    let cu_kg = cws * 9.6;

    let al_cost = al_kg * (al_price / 1000);
    let cu_cost = cu_kg * (cu_price / 1000);

    let total = al_cost + cu_cost;
    let net = total / 0.3;

    // Restored premium comma formatting
    let fmtAlKg = al_kg.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtCuKg = cu_kg.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtTotal = total.toLocaleString('en-GB', {maximumFractionDigits: 0});
    let fmtNet = net.toLocaleString('en-GB', {maximumFractionDigits: 0});

    let row = `<tr>
      <td>${cond}</td>
      <td>${cws}</td>
      <td>${fmtAlKg}</td>
      <td>${fmtCuKg}</td>
      <td>${symbol}${fmtTotal}</td>
      <td><strong>${symbol}${fmtNet}</strong></td>
    </tr>`;

    tbody.innerHTML += row;
  });
}

// AUTO FLOW (SAFE)
document.addEventListener("DOMContentLoaded", async function () {
  await fetchFX();  // pull live FX
  calc();           // run pricing immediately after
});
</script>
