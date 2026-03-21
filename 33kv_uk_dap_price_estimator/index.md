# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

---

## Market Inputs

<div style="background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Copper (USD/Tonne)</label>
    <input id="cu" type="number" value="12850" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Aluminium (USD/Tonne)</label>
    <input id="al" type="number" value="3520" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; pointer-events: none;">
        <div style="text-align:center;">
            <span style="font-size:0.75em; color:#64748b; font-weight:700; text-transform:uppercase;">Copper (GBP/t)</span>
            <div id="cu_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="text-align:center;">
            <span style="font-size:0.75em; color:#64748b; font-weight:700; text-transform:uppercase;">Aluminium (GBP/t)</span>
            <div id="al_gbp_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="text-align:center;">
            <span style="font-size:0.75em; color:#64748b; font-weight:700; text-transform:uppercase;">Copper (EUR/t)</span>
            <div id="cu_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
        </div>
        <div style="text-align:center;">
            <span style="font-size:0.75em; color:#64748b; font-weight:700; text-transform:uppercase;">Aluminium (EUR/t)</span>
            <div id="al_eur_text" style="font-size:1.1em; font-weight:700; color:#1a202c;">€0</div>
        </div>
    </div>

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

    <div id="fx_time" style="font-size:0.75em; color:#a0aec0; margin-bottom:20px; font-style:italic;">Syncing market rates...</div>

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">Pricing Currency</label>
    <select id="currency" onchange="calc()" style="width:100%; padding:14px; border:2px solid #edf2f7; border-radius:8px; background:#fff; font-size:1em; cursor:pointer;">
        <option value="GBP">GBP (£)</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
    </select>
</div>

---

## Weight Formulas
* **Copper kg per km** = Conductor Size (mm²) × 9.6
* **Aluminium kg per km** = Conductor Size (mm²) × 2.92

## Net Price Rule
**Net cable price ≈ Metal value ÷ 0.3**

---

## Cable Metal and Net Price Estimator

<div style="overflow-x:auto; border-radius: 8px; border: 1px solid #e1e4e8;">
    <table id="liveTbl" style="width:100%; border-collapse:collapse; font-size:0.95em; text-align:left; font-family: sans-serif;">
        <thead>
            <tr style="background:#1a202c; color:#ffffff;">
                <th style="padding:15px 10px;">Cond mm²</th>
                <th style="padding:15px 10px;">CWS mm²</th>
                <th style="padding:15px 10px;">Al kg/km</th>
                <th style="padding:15px 10px;">Cu kg/km</th>
                <th style="padding:15px 10px;">Al Cost</th>
                <th style="padding:15px 10px;">Cu Cost</th>
                <th style="padding:15px 10px;">Total Metal</th>
                <th style="padding:15px 10px;">Net Price</th>
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
        document.getElementById("fx_time").innerHTML = "Data Sync: " + new Date().toUTCString();
        calc();
    } catch (e) {
        document.getElementById("fx_time").innerHTML = "Manual FX Entry Active";
    }
}

function calc() {
    const cuUSD = parseFloat(document.getElementById("cu").value) || 0;
    const alUSD = parseFloat(document.getElementById("al").value) || 0;
    const fxGBP = parseFloat(document.getElementById("fx_gbp").value) || 1.33;
    const fxEUR = parseFloat(document.getElementById("fx_eur").value) || 1.15;
    const curr = document.getElementById("currency").value;

    // UPDATE CONVERSION BOXES
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
        const [cond, cws] = c;
        const al_kg = cond * 2.92;
        const cu_kg = cws * 9.6;
        const al_c = al_kg * (pAl / 1000);
        const cu_c = cu_kg * (pCu / 1000);
        const tot = al_c + cu_c;
        const net = tot / 0.3;

        rows += `<tr style="border-bottom:1px solid #edf2f7;" onclick="this.classList.toggle('selected')">
            <td style="padding:12px 10px;"><strong>${cond}</strong></td>
            <td style="padding:12px 10px;">${cws}</td>
            <td style="padding:12px 10px;">${Math.round(al_kg).toLocaleString()}</td>
            <td style="padding:12px 10px;">${Math.round(cu_kg).toLocaleString()}</td>
            <td style="padding:12px 10px;">${sym}${Math.round(al_c).toLocaleString()}</td>
            <td style="padding:12px 10px;">${sym}${Math.round(cu_c).toLocaleString()}</td>
            <td style="padding:12px 10px;">${sym}${Math.round(tot).toLocaleString()}</td>
            <td style="padding:12px 10px; background:#f0fff4; color:#22543d; font-weight:bold;">${sym}${Math.round(net).toLocaleString()}</td>
        </tr>`;
    });
    document.querySelector("#liveTbl tbody").innerHTML = rows;
}

document.addEventListener("DOMContentLoaded", fetchFX);
</script>

<style>
    #liveTbl tbody tr.selected { background-color: #ebf8ff !important; border-left: 4px solid #3182ce; }
</style>
