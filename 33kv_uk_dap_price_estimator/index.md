# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

Large scale price estimator for global 33 kV cable supply delivered to site with typical manufacturing lead times of 10 to 30 weeks.

---

## Market Inputs (Active Drivers)

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border:1px solid #ddd; border-radius:8px;">

<p style="font-size:0.85em; color:#666; margin-bottom:15px;">
<strong>Correlation:</strong> The green input boxes (Metals and FX) are the primary drivers. 
Changing these values instantly updates the green <strong>Net Price</strong> column in the table below.
</p>

<label><strong>LME Copper (USD per tonne)</strong></label><br>
<input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;background:#eef8e5;border:1px solid #999;font-weight:bold;">

<label><strong>LME Aluminium (USD per tonne)</strong></label><br>
<input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;background:#eef8e5;border:1px solid #999;font-weight:bold;">

<label><strong>GBP USD rate (live auto fetch)</strong></label><br>
<input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;background:#eef8e5;border:1px solid #999;font-weight:bold;">

<label><strong>EUR USD rate (live auto fetch)</strong></label><br>
<input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;background:#eef8e5;border:1px solid #999;font-weight:bold;">

<label><strong>Copper (GBP per tonne)</strong></label><br>
<input id="cu_gbp_val" readonly style="width:100%;padding:10px;margin-bottom:10px;background:#fff;border:1px solid #ccc;">

<label><strong>Aluminium (GBP per tonne)</strong></label><br>
<input id="al_gbp_val" readonly style="width:100%;padding:10px;margin-bottom:10px;background:#fff;border:1px solid #ccc;">

<label><strong>Copper (EUR per tonne)</strong></label><br>
<input id="cu_eur_val" readonly style="width:100%;padding:10px;margin-bottom:10px;background:#fff;border:1px solid #ccc;">

<label><strong>Aluminium (EUR per tonne)</strong></label><br>
<input id="al_eur_val" readonly style="width:100%;padding:10px;margin-bottom:10px;background:#fff;border:1px solid #ccc;">

<div style="font-size:0.9em; color:#555; margin-bottom:15px;">
<strong id="fx_time">Fetching live FX...</strong>
</div>

<label><strong>Display currency for tables</strong></label><br>
<select id="currency" onchange="calc()" style="width:100%;padding:10px;">
<option value="GBP">GBP (£)</option>
<option value="USD">USD ($)</option>
<option value="EUR">EUR (€)</option>
</select>

</div>

---

## Weight formulas

- **Copper kg per km = mm² × 9.6**
- **Aluminium kg per km = mm² × 2.92**

---

## Net price rule

**Net cable price ≈ metal value ÷ 0.3**

Typical cost structure:
- Metal content ≈ 30%
- Manufacturing, logistics, and margin ≈ 70%

---

## Cable metal and net price estimator

<div style="overflow-x:auto; margin-bottom:25px;">

<table id="liveTbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;font-size:0.95em;">

<thead>
<tr>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Cond mm²</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">CWS mm²</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Al kg per km</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Cu kg per km</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Al cost</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Cu cost</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Total metal</th>
<th style="border:1px solid #ddd; padding:8px; background:#111; color:#fff;">Net price</th>
</tr>
</thead>

<tbody></tbody>

</table>
</div>

<style>
#liveTbl td { border:1px solid #ddd; padding:8px; }
#liveTbl tr:nth-child(even) { background:#fafafa; }
@media print { select, input { display:none; } }
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
document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
updateFXTime();
} catch {
document.getElementById("fx_time").innerHTML = "Live FX unavailable. Using manual inputs";
}
}

function updateFXTime() {
let now = new Date();
document.getElementById("fx_time").innerHTML = "Last update: " + now.toUTCString();
}

function calc() {

let cu = parseFloat(document.getElementById("cu").value) || 0;
let al = parseFloat(document.getElementById("al").value) || 0;
let fx_gbp = parseFloat(document.getElementById("fx_gbp").value) || 1;
let fx_eur = parseFloat(document.getElementById("fx_eur").value) || 1;
let currency = document.getElementById("currency").value;

document.getElementById("cu_gbp_val").value = "£" + (cu / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits:0});
document.getElementById("al_gbp_val").value = "£" + (al / fx_gbp).toLocaleString('en-GB', {maximumFractionDigits:0});
document.getElementById("cu_eur_val").value = "€" + (cu / fx_eur).toLocaleString('en-GB', {maximumFractionDigits:0});
document.getElementById("al_eur_val").value = "€" + (al / fx_eur).toLocaleString('en-GB', {maximumFractionDigits:0});

let cu_price, al_price, symbol;

if (currency === "GBP") {
cu_price = cu / fx_gbp;
al_price =
