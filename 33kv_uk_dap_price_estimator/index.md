# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

---

## Market Inputs

<div style="background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Copper (USD/Tonne)</label>
    <input id="cu" type="number" value="12850" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #edf2f7; border-radius:8px; background:#f9fff0; font-size:1.1em; font-weight:600;">

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Aluminium (USD/Tonne)</label>
    <input id="al" type="number" value="3520" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #edf2f7; border-radius:8px; background:#f9fff0; font-size:1.1em; font-weight:600;">

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom:18px;">
        <div>
            <label style="font-size:0.85em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">GBP/USD (Live)</label>
            <input id="fx_gbp" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px; background:#fff;">
        </div>
        <div>
            <label style="font-size:0.85em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">EUR/USD (Live)</label>
            <input id="fx_eur" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px; background:#fff;">
        </div>
    </div>

    <div id="fx_time" style="font-size:0.75em; color:#a0aec0; margin-bottom:20px; font-style:italic;">Fetching live global rates...</div>

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">Display Currency for Table</label>
    <select id="currency" onchange="calc()" style="width:100%; padding:14px; border:2px solid #edf2f7; border-radius:8px; background:#fff; font-size:1em; cursor:pointer;">
        <option value="GBP">GBP (£)</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
    </select>
</div>

---

## Weight Formulas
* **Copper kg per km** = $mm^2 \times 9.6$
* **Aluminium kg per km** = $mm^2 \times 2.92$

## Net Price Rule
**Net cable price ≈ Metal value ÷ 0.3**
* Metal content: ≈ 30%
* Manufacturing, logistics, and margin: ≈ 70%

---

## Cable Metal and Net Price Estimator

<div style="overflow-x:auto; border-radius: 8px; border: 1px solid #e1e4e8;">
    <table id="liveTbl" style="width:100%; border-collapse:collapse; font-size:0.95em; text-align:left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <thead>
            <tr style="background:#1a202c; color:#ffffff;">
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Cond mm²</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">CWS mm²</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Al kg/km</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Cu kg/km</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Al Cost</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Cu Cost</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Total Metal</th>
                <th style="padding:15px 10px; border-bottom:2px solid #2d3748;">Net Price</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>

<style>
    /* Interactive Row Highlighting */
    #liveTbl tbody tr { cursor: pointer; transition: background 0.2s; }
    #liveTbl tbody tr:hover { background-color: #f7fafc !important; }
    #liveTbl tbody tr.selected { background-color: #ebf8ff !important; border-left: 4px solid #3182ce; }
</style>

<script>
const mvCables = [
    [120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
    [800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

async function fetchFX() {
    try {
        const res = await fetch("https://api.frankfurter.app/latest?from=USD&symbols=GBP,EUR");
        const data = await res.json();
        // Sets rates to "How many USD per 1 [Target Currency]"
        document.getElementById("fx_gbp").value = (1 / data.rates.GBP).toFixed(4);
        document.getElementById("fx_eur").value = (1 / data.rates.EUR).toFixed(4);
        document.getElementById("fx_time").innerHTML = "Last update: " + new Date().toUTCString();
        calc();
    } catch (e) {
        document.getElementById("fx_time").innerHTML = "Manual FX Mode Active";
    }
}

function calc() {
    const cuUSD = parseFloat(document.getElementById("cu").value) || 0;
    const alUSD = parseFloat(document.getElementById("al").value) || 0;
    const fxGBP = parseFloat(document.getElementById("fx_gbp").value) || 1.33;
    const fxEUR = parseFloat(document.getElementById("fx_eur").value) || 1.15;
    const curr = document.getElementById("currency").value;

    let pCu, pAl, sym;
    if (curr === "GBP") { pCu = cuUSD / fxGBP; pAl = alUSD / fxGBP; sym = "£"; }
    else if (curr === "EUR") { pCu = cuUSD / fxEUR; pAl = alUSD / fxEUR; sym = "€"; }
    else { pCu = cuUSD; pAl = alUSD; sym = "$"; }

    let rows = "";
    mvCables.forEach(c => {
        const [cond, cws] = c;
        const al_kg = cond * 2.92;
        const cu_kg = cws * 9.6;
        const al_c = al_kg * (pAl / 1000);
        const cu_c = cu_kg * (pCu / 1000);
        const tot = al_c + cu_c;
        const net = tot / 0.3;

        rows += `<tr onclick="this.classList.toggle('selected')" style="border-bottom:1px solid #edf2f7;">
            <td style="padding:12px 10px;"><strong>${cond}</strong></td>
            <td style="padding:12px 10px;">${cws}</td>
            <td style="padding:12px 10px;">${Math.round(al_kg).toLocaleString()}</td>
            <td style="padding:12px 10px;">${Math.round(cu_kg).toLocaleString()}</td>
            <td style="padding:12px 10px;">${sym}${Math.round(al_c).toLocaleString()}</td>
            <td style="padding:12px 10px;">${sym}${Math.round(cu_c).toLocaleString()}</td>
            <td style="padding:12px 10px; color:#4a5568;">${sym}${Math.round(tot).toLocaleString()}</td>
            <td style="padding:12px 10px; background:#f0fff4; color:#22543d; font-weight:bold;">${sym}${Math.round(net).toLocaleString()}</td>
        </tr>`;
    });
    document.querySelector("#liveTbl tbody").innerHTML = rows;
}

document.addEventListener("DOMContentLoaded", fetchFX);
</script>
