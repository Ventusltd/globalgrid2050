<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>33 kV Cable Price Estimator</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292e; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f6f8fa; }
        h1, h2 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        .card { background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        label { display:block; font-weight:700; color:#333; margin-bottom:8px; }
        input, select { width:100%; padding:12px; margin-bottom:18px; border:2px solid #edf2f7; border-radius:8px; box-sizing: border-box; font-size: 1rem; }
        input:focus { border-color: #3182ce; outline: none; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom:18px; }
        .market-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
        table { width:100%; border-collapse:collapse; background: white; border-radius: 8px; overflow: hidden; }
        th { background:#1a202c; color:#ffffff; padding:15px 10px; text-align: left; }
        td { padding:12px 10px; border-bottom: 1px solid #edf2f7; }
        tr:hover { background-color: #f7fafc; cursor: pointer; }
        .selected { background-color: #ebf8ff !important; border-left: 4px solid #3182ce; }
        .net-price-cell { background:#f0fff4; border-left:2px solid #c6f6d5; font-weight: bold; color: #22543d; }
    </style>
</head>
<body>

<h1>33 kV Aluminium XLPE Cable Price Estimator</h1>
<p>Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen (35-50 mm²) and MDPE oversheath to BS 7870.</p>

<div class="card">
    <label>LME Copper (USD per Tonne)</label>
    <input id="cu" type="number" value="12850" oninput="calc()">

    <label>LME Aluminium (USD per Tonne)</label>
    <input id="al" type="number" value="3520" oninput="calc()">

    <div class="market-summary">
        <div style="text-align:center;">
            <div style="font-size:0.75em; color:#64748b;">COPPER (GBP)</div>
            <div id="cu_gbp_text" style="font-weight:700;">£0</div>
        </div>
        <div style="text-align:center;">
            <div style="font-size:0.75em; color:#64748b;">ALUMINIUM (GBP)</div>
            <div id="al_gbp_text" style="font-weight:700;">£0</div>
        </div>
    </div>

    <div style="background:#fff5f5; border:1px solid #feb2b2; padding:15px; border-radius:10px; margin-bottom:20px;">
        <label style="color:#9b2c2c; font-size:0.85em;">Non-Metal Costs Estimate (%)</label>
        <input id="non_metal_input" type="number" value="70" oninput="calc()" style="margin-bottom:0; border-color:#fc8181;">
    </div>

    <div class="grid-3">
        <div><label style="font-size:0.8em;">GBP/USD</label><input id="fx_gbp" oninput="calc()"></div>
        <div><label style="font-size:0.8em;">EUR/USD</label><input id="fx_eur" oninput="calc()"></div>
        <div style="text-align:center; background:#fffaf0; border-radius:6px; padding:5px;">
            <label style="font-size:0.75em; color:#c05621;">GBP/EUR</label>
            <div id="fx_cross" style="font-weight:700;">0.0000</div>
        </div>
    </div>

    <label>Pricing Currency</label>
    <select id="currency" onchange="calc()">
        <option value="GBP">GBP (£)</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
    </select>
</div>

<h2>Estimation Logic</h2>
<p><strong>Net Price Formula:</strong> $Net Price = Metal Value \div (1 - NonMetalCost\%)$</p>

<div style="overflow-x:auto;">
    <table id="liveTbl">
        <thead>
            <tr>
                <th>Cond mm²</th>
                <th>CWS mm²</th>
                <th>Al kg/km</th>
                <th>Cu kg/km</th>
                <th>Metal Val</th>
                <th>Net Price</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>

<script>
const mvCables = [
    [120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
    [800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

async function fetchFX() {
    try {
        const res = await fetch("https://api.frankfurter.app/latest?from=USD&symbols=GBP,EUR");
        const data = await res.json();
        document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
        document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
        calc();
    } catch (e) { 
        document.getElementById("fx_gbp").value = "1.3368";
        document.getElementById("fx_eur").value = "1.1555";
        calc();
    }
}

function calc() {
    const cuUSD = parseFloat(document.getElementById("cu").value) || 0;
    const alUSD = parseFloat(document.getElementById("al").value) || 0;
    const fxGBP = parseFloat(document.getElementById("fx_gbp").value) || 1.3368;
    const fxEUR = parseFloat(document.getElementById("fx_eur").value) || 1.1555;
    const nonMetalPct = parseFloat(document.getElementById("non_metal_input").value) || 0;
    const metalRatio = (100 - nonMetalPct) / 100;
    const curr = document.getElementById("currency").value;

    document.getElementById("fx_cross").innerText = (fxGBP / fxEUR).toFixed(4);
    document.getElementById("cu_gbp_text").innerText = "£" + Math.round(cuUSD / fxGBP).toLocaleString();
    document.getElementById("al_gbp_text").innerText = "£" + Math.round(alUSD / fxGBP).toLocaleString();

    let pCu, pAl, sym;
    if (curr === "GBP") { pCu = cuUSD / fxGBP; pAl = alUSD / fxGBP; sym = "£"; }
    else if (curr === "EUR") { pCu = cuUSD / fxEUR; pAl = alUSD / fxEUR; sym = "€"; }
    else { pCu = cuUSD; pAl = alUSD; sym = "$"; }

    let rows = "";
    mvCables.forEach(c => {
        const al_kg = c[0] * 2.92;
        const cu_kg = c[1] * 9.6;
        const totMetal = (al_kg * (pAl/1000)) + (cu_kg * (pCu/1000));
        const netMain = totMetal / metalRatio;

        rows += `<tr onclick="this.classList.toggle('selected')">
            <td><strong>${c[0]}</strong></td>
            <td>${c[1]}</td>
            <td>${Math.round(al_kg).toLocaleString()}</td>
            <td>${Math.round(cu_kg).toLocaleString()}</td>
            <td>${sym}${Math.round(totMetal).toLocaleString()}</td>
            <td class="net-price-cell">${sym}${Math.round(netMain).toLocaleString()}</td>
        </tr>`;
    });
    document.querySelector("#liveTbl tbody").innerHTML = rows;
}
document.addEventListener("DOMContentLoaded", fetchFX);
</script>
</body>
</html>
