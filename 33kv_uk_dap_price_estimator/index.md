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
    <em>Live Cross Rates: 1 GBP = <span id="gbp_eur">1.2282</span> EUR | 1 EUR = <span id="eur_gbp">0.8142</span> GBP</em>
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
    // Fixed API: open.er-api.com is free and does not require an API key
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();

    if (data && data.rates) {
        // The API returns rates based on 1 USD. To get GBP/USD (1 GBP = X USD), we invert it.
        let gbp_usd = 1 / data.rates.GBP;
        let eur_usd = 1 / data.rates.EUR;

        document.getElementById("fx_gbp").value = gbp_usd.toFixed(4);
        document.getElementById("fx_eur").value = eur_usd.toFixed(4);
    }
  } catch (e) {
    console.warn("FX fetch failed, using manual fallback values");
  }
}

function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;

  // Cross rates (AUTO)
  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;

  // Safely update DOM if the elements exist
  let gbp_eur_el = document.getElementById("gbp_eur");
  let eur_gbp_el = document.getElementById("eur_gbp");
  if (gbp_eur_el) gbp_eur_el.innerHTML = gbp_eur.toFixed(4);
  if (eur_gbp_el) eur_gbp_el.innerHTML = eur_gbp.toFixed(4);

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
    let cws = c[1]; // Restored CWS column

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

// SAFE AUTO FLOW (DO NOT BREAK)
document.addEventListener("DOMContentLoaded", async function () {
  // 1. Fetch FX (auto)
  await fetchFX();
  // 2. Run calculation AFTER FX loads so the table populates instantly
  calc();
});
</script>
