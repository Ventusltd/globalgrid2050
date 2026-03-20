<h2>33 kV Cable Price Estimator</h2>

<p>
Quick engineering tool for aluminium 33 kV cables with copper wire screen.<br>
Use live inputs below, then compare against the fixed reference table.
</p>

<div style="margin-bottom:20px;">
<label>Copper USD/Tonne</label><br>
<input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label>Aluminium USD/Tonne</label><br>
<input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label>GBP/USD</label><br>
<input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label>EUR/USD</label><br>
<input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label>Display Currency</label><br>
<select id="currency" onchange="calc()" style="width:100%;padding:10px;margin-bottom:10px;">
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
.refTbl {
  border-collapse: collapse;
  width: 100%;
}
.refTbl th, .refTbl td {
  border: 1px solid #ccc;
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
function calc() {
  let cu = parseFloat(document.getElementById("cu").value) || 0;
  let al = parseFloat(document.getElementById("al").value) || 0;
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
  let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
  let currency = document.getElementById("currency").value;

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

    // Formatting numbers with commas for readability
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

// Automatically run calculation when the page loads
window.onload = calc;
</script>

<hr>

<p>
Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire
screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.
</p>

<p>
Large scale price estimator for global 33 kV cable supply delivered to site with
typical manufacturing lead times of 10 to 30 weeks.
</p>

<h3>Market Inputs</h3>

<table class="refTbl">
<tr><th>Parameter</th><th>Value</th></tr>
<tr><td>LME Copper (USD)</td><td>$12,850 / tonne</td></tr>
<tr><td>LME Aluminium (USD)</td><td>$3,520 / tonne</td></tr>
<tr><td>GBP/USD Rate</td><td>1 GBP = 1.3265 USD</td></tr>
<tr><td>Copper (GBP)</td><td>£9,687 / tonne</td></tr>
<tr><td>Aluminium (GBP)</td><td>£2,654 / tonne</td></tr>
<tr><td>Last Update</td><td>Friday 20 March 2026 19:05 UTC</td></tr>
</table>

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

<div style="overflow-x:auto;">
<table class="refTbl">
<tr>
<th>Conductor mm²</th>
<th>CWS mm²</th>
<th>Aluminium kg/km</th>
<th>Copper kg/km</th>
<th>Aluminium £/km</th>
<th>Copper £/km</th>
<th>Total metal £/km</th>
</tr>
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
</table>
</div>
