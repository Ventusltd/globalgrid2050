<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>33 kV Aluminium XLPE Cable Price Estimator</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a202c; line-height: 1.6; }
        h1 { font-size: 1.8em; border-bottom: 2px solid #e1e4e8; padding-bottom: 12px; }
        h2 { font-size: 1.3em; margin-top: 30px; }
        hr { border: none; border-top: 1px solid #e1e4e8; margin: 24px 0; }
        #liveTbl tbody tr { cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #edf2f7; }
        #liveTbl tbody tr:hover { background-color: #f7fafc; }
        #liveTbl tbody tr.selected { background-color: #ebf8ff !important; border-left: 4px solid #3182ce; }
    </style>
</head>
<body>

<h1>33 kV Aluminium XLPE Cable Price Estimator</h1>

<p>Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.</p>

<hr>

<h2>Market Inputs</h2>

<div style="background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

```
<div style="font-size:0.78em; font-weight:700; color:#3182ce; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px; padding-bottom:6px; border-bottom:1px solid #e2e8f0;">Metals — USD per Tonne</div>

<label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Copper</label>
<input id="cu" type="number" value="12850" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700; box-sizing:border-box;">

<label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Aluminium</label>
<input id="al" type="number" value="3520" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700; box-sizing:border-box;">

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; pointer-events: none;">
    <div style="text-align:center; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">
        <div style="font-size:0.75em; color:#64748b; font-weight:700;">Cu £</div>
        <div id="cu_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
    </div>
    <div style="text-align:center; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">
        <div style="font-size:0.75em; color:#64748b; font-weight:700;">Al £</div>
        <div id="al_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
    </div>
    <div style="text-align:center; padding-top: 10px;">
        <div style="font-size:0.75em; color:#64748b; font-weight:700;">Cu €</div>
        <div id="cu_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
    </div>
    <div style="text-align:center; padding-top: 10px;">
        <div style="font-size:0.75em; color:#64748b; font-weight:700;">Al €</div>
        <div id="al_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
    </div>
</div>

<div style="background:#fff5f5; border:2px solid #feb2b2; padding:20px; border-radius:10px; margin-bottom:25px;">
    <label style="display:block; font-weight:800; color:#9b2c2c; margin-bottom:6px; text-transform:uppercase; font-size:0.85em;">Non-Metal Costs (%)</label>
    <p style="font-size:0.78em; color:#c53030; margin:0 0 10px 0; line-height:1.5;">All costs excluding metal values for a DAP delivery estimate — covering manufacturing, insulation, sheathing, screening, logistics, and margin. Replace with an official supplier quote for greater accuracy.</p>
    <input id="non_metal_input" type="number" value="70" oninput="calc()" style="width:100%; padding:12px; border:1px solid #fc8181; border-radius:6px; font-weight:700; color:#c53030; background:#fff; box-sizing:border-box;">
</div>

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom:18px;">
    <div>
        <label style="font-size:0.8em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">GBP/USD</label>
        <input id="fx_gbp" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px; box-sizing:border-box;">
    </div>
    <div>
        <label style="font-size:0.8em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">EUR/USD</label>
        <input id="fx_eur" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px; box-sizing:border-box;">
    </div>
    <div style="background:#fffaf0; border:1px solid #feebc8; border-radius:6px; padding:5px; text-align:center;">
        <label style="font-size:0.75em; font-weight:700; color:#c05621; display:block; margin-bottom:2px;">GBP to EUR</label>
        <div id="fx_cross" style="font-weight:700; color:#744210; font-size:1.1em;">0.0000</div>
    </div>
</div>

<label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">Pricing Currency</label>
<select id="currency" onchange="calc()" style="width:100%; padding:14px; border:2px solid #edf2f7; border-radius:8px; background:#fff; font-size:1em; cursor:pointer;">
    <option value="GBP">GBP (£)</option>
    <option value="USD">USD ($)</option>
    <option value="EUR">EUR (€)</option>
</select>
```

</div>

<hr>

<h2>Technical Notes: Net Price Rule</h2>

<p><span id="span_0"><span id="span_1">The <strong>Net cable price</strong> is estimated by dividing the total metal value by the remaining percentage after non-metal costs are removed.</span></span></p>

<p><strong><span id="span_2">Formula: Net Price = Metal Value / (1 - Non-Metal Cost %)</span></strong></p>

<p>Typical cost structure for utility-grade 33 kV XLPE:</p>
<ul>
    <li><strong><span id="span_3">Metal content: approximately 30%</span></strong></li>
    <li><strong><span id="span_4">Manufacturing, logistics, and margin: approximately 70%</span></strong></li>
</ul>

<h2>Weight Formulas</h2>
<ul>
    <li><strong><span id="span_5">Copper kg per km</span></strong> = Conductor Size (mm²) x 9.6</li>
    <li><strong><span id="span_6">Aluminium kg per km</span></strong> = Conductor Size (mm²) x 2.92</li>
</ul>

<hr>

<h2>Cable Metal and Net Price Estimator</h2>

<div style="overflow-x:auto; border-radius: 8px; border: 1px solid #e1e4e8;">
    <table id="liveTbl" style="width:100%; border-collapse:collapse; font-size:0.95em; text-align:left; font-family: sans-serif;">
        <thead>
            <tr style="background:#1a202c; color:#ffffff;">
                <th style="padding:15px 10px;">Cond mm²</th>
                <th style="padding:15px 10px;">CWS mm²</th>
                <th style="padding:15px 10px;">Al kg/km</th>
                <th style="padding:15px 10px;">Cu kg/km</th>
                <th style="padding:15px 10px;">Total Metal</th>
                <th style="padding:15px 10px;">Net Price</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>

<p id="fx_status" style="font-size:0.8em; color:#718096; margin-top:8px; text-align:right;"></p>

<div style="margin-top: 40px; background:#fffbeb; border: 1px solid #f6d860; border-left: 5px solid #d69e2e; border-radius: 8px; padding: 20px 24px;">
    <div style="font-weight:800; color:#92400e; font-size:0.85em; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">⚠ Disclaimer</div>
    <p style="font-size:0.85em; color:#78350f; margin:0; line-height:1.7;">
        This tool is provided for indicative estimation purposes only. No liability is accepted for any errors, omissions, or losses arising from the use of this estimator, including those resulting from market price fluctuations, currency movements, or inaccuracies in input data. All outputs should be independently validated by qualified professionals, including registered electrical engineers, cable manufacturers, specialist installers, and procurement specialists, before being used for commercial, contractual, or engineering decisions.
    </p>
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
        document.getElementById("fx_status").innerText = "✓ Live FX rates loaded from Frankfurter API";
        calc();
    } catch (e) {
        document.getElementById("fx_gbp").value = "1.3368";
        document.getElementById("fx_eur").value = "1.1555";
        document.getElementById("fx_status").innerText = "⚠ Using fallback FX rates (API unavailable)";
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
    document.getElementById("cu_eur_text").innerText = "€" + Math.round(cuUSD / fxEUR).toLocaleString();
    document.getElementById("al_eur_text").innerText = "€" + Math.round(alUSD / fxEUR).toLocaleString();

    let pCu, pAl, sym;
    if (curr === "GBP") { pCu = cuUSD / fxGBP; pAl = alUSD / fxGBP; sym = "£"; }
    else if (curr === "EUR") { pCu = cuUSD / fxEUR; pAl = alUSD / fxEUR; sym = "€"; }
    else { pCu = cuUSD; pAl = alUSD; sym = "$"; }

    let rows = "";
    mvCables.forEach(c => {
        const cond = c[0];
        const cws = c[1];
        const al_kg = cond * 2.92;
        const cu_kg = cws * 9.6;
        const totMetal = (al_kg * (pAl / 1000)) + (cu_kg * (pCu / 1000));
        const netMain = totMetal / metalRatio;

        const mUSD = (al_kg * (alUSD / 1000) + cu_kg * (cuUSD / 1000)) / metalRatio;
        const mGBP = mUSD / fxGBP;
        const mEUR = mUSD / fxEUR;

        let subText = "";
        if (curr === "GBP") subText = "$" + Math.round(mUSD).toLocaleString() + " | €" + Math.round(mEUR).toLocaleString();
        else if (curr === "EUR") subText = "$" + Math.round(mUSD).toLocaleString() + " | £" + Math.round(mGBP).toLocaleString();
        else subText = "£" + Math.round(mGBP).toLocaleString() + " | €" + Math.round(mEUR).toLocaleString();

        rows += "<tr onclick=\"this.classList.toggle('selected')\">" +
            "<td style='padding:12px 10px;'><strong>" + cond + "</strong></td>" +
            "<td style='padding:12px 10px;'>" + cws + "</td>" +
            "<td style='padding:12px 10px;'>" + Math.round(al_kg).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px;'>" + Math.round(cu_kg).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px;'>" + sym + Math.round(totMetal).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px; background:#f0fff4; border-left:2px solid #c6f6d5;'>" +
                "<div style='font-weight:bold; color:#22543d; font-size:1.1em;'>" + sym + Math.round(netMain).toLocaleString() + "</div>" +
                "<div style='font-size:0.7em; color:#718096;'>" + subText + "</div>" +
            "</td>" +
        "</tr>";
    });
    document.querySelector("#liveTbl tbody").innerHTML = rows;
}

fetchFX();
</script>

</body>
</html>
