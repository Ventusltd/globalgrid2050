# 33 kV Aluminium XLPE Cable Price Estimator

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen 35 mm² or 50 mm² and MDPE oversheath to BS 7870.

---

## Market Inputs

<div style="background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Copper (USD per Tonne)</label>
    <input id="cu" type="number" value="12850" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">LME Aluminium (USD per Tonne)</label>
    <input id="al" type="number" value="3520" oninput="calc()" style="width:100%; padding:14px; margin-bottom:18px; border:2px solid #3182ce; border-radius:8px; background:#f0f7ff; font-size:1.1em; font-weight:700;">

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 25px;">
        <div style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; text-align:center;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">COPPER (GBP per Tonne)</div>
            <div id="cu_gbp_text" style="font-size:1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; text-align:center;">
            <div style="font-size:0.75em; color:#64748b; font-weight:700;">ALUMINIUM (GBP per Tonne)</div>
            <div id="al_gbp_text" style="font-size:1em; font-weight:700; color:#1a202c;">£0</div>
        </div>
        <div style="background:#fffaf0; padding:12px; border-radius:10px; border:1px solid #feebc8; text-align:center;">
            <div style="font-size:0.75em; color:#c05621; font-weight:700;">GBP to EUR</div>
            <div id="fx_cross" style="font-size:1em; font-weight:700; color:#744210;">0.0000</div>
        </div>
    </div>

    <div style="background:#f0fff4; border:1px solid #c6f6d5; padding:20px; border-radius:10px; margin-bottom:25px;">
        <label style="display:block; font-weight:700; color:#22543d; margin-bottom:10px;">Net Price Rule (Metal Content %)</label>
        <input type="range" id="markup_slider" min="15" max="50" value="30" oninput="updateMarkupText(); calc();" style="width:100%; cursor:pointer;">
        <div style="display:flex; justify-content:space-between; font-size:0.85em; margin-top:10px; font-weight:600;">
            <div>Metal is <span id="markup_val">30</span>% of Total Price</div>
            <div style="color:#718096;">Mark-up: <span id="overhead_val">70</span>%</div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom:18px;">
        <div>
            <label style="font-size:0.85em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">GBP/USD (Live)</label>
            <input id="fx_gbp" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
        </div>
        <div>
            <label style="font-size:0.85em; font-weight:600; color:#718096; display:block; margin-bottom:4px;">EUR/USD (Live)</label>
            <input id="fx_eur" oninput="calc()" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
        </div>
    </div>

    <label style="display:block; font-weight:700; color:#333; margin-bottom:8px;">Pricing Currency</label>
    <select id="currency" onchange="calc()" style="width:100%; padding:14px; border:2px solid #edf2f7; border-radius:8px; background:#fff; font-size:1em; cursor:pointer;">
        <option value="GBP">GBP (£)</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
    </select>
</div>

---

## Weight Formulas
* **Copper kg per km** = Conductor Size (mm²) x 9.6
* **Aluminium kg per km** = Conductor Size (mm²) x 2.92

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
                <th style="padding:15px 10px;">Total Metal</th>
                <th style="padding:15px 10px;">Net Price</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
</div>

<style>
    #liveTbl tbody tr { cursor: pointer; transition: background 0.2s; }
    #liveTbl tbody tr:hover { background-color: #f7fafc; }
    #liveTbl tbody tr.selected { background-color: #ebf8ff !important; border-left: 4px solid #3182ce; }
</style>

<script>
const mvCables = [
    [120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
    [800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

function updateMarkupText() {
    const val = document.getElementById("markup_slider").value;
    document.getElementById("markup_val").innerText = val;
    document.getElementById("overhead_val").innerText = 100 - val;
}

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
    const metalRatio = parseFloat(document.getElementById("markup_slider").value) / 100;
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
        const cond = c[0];
        const cws = c[1];
        const al_kg = cond * 2.92;
        const cu_kg = cws * 9.6;
        const totMetal = (al_kg * (pAl/1000)) + (cu_kg * (pCu/1000));
        const netMain = totMetal / metalRatio;

        const mUSD = (al_kg * (alUSD/1000) + cu_kg * (cuUSD/1000)) / metalRatio;
        const mGBP = mUSD / fxGBP;
        const mEUR = mUSD / fxEUR;

        let subText = "";
        if(curr === "GBP") {
            subText = "$" + Math.round(mUSD).toLocaleString() + " | €" + Math.round(mEUR).toLocaleString();
        } else if(curr === "EUR") {
            subText = "$" + Math.round(mUSD).toLocaleString() + " | £" + Math.round(mGBP).toLocaleString();
        } else {
            subText = "£" + Math.round(mGBP).toLocaleString() + " | €" + Math.round(mEUR).toLocaleString();
        }

        rows += "<tr onclick=\"this.classList.toggle('selected')\" style='border-bottom:1px solid #edf2f7;'>" +
            "<td style='padding:12px 10px;'><strong>" + cond + "</strong></td>" +
            "<td style='padding:12px 10px;'>" + cws + "</td>" +
            "<td style='padding:12px 10px;'>" + Math.round(al_kg).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px;'>" + Math.round(cu_kg).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px;'>" + sym + Math.round(totMetal).toLocaleString() + "</td>" +
            "<td style='padding:12px 10px; background:#f0fff4; border-left:2px solid #c6f6d5;'>" +
                "<div style='font-weight:bold; color:#22543d; font-size:1.1em;'>" + sym + Math.round(netMain).toLocaleString() + "</div>" +
                "<div style='font-size:0.75em; color:#718096;'>" + subText + "</div>" +
            "</td>" +
        "</tr>";
    });
    document.querySelector("#liveTbl tbody").innerHTML = rows;
}

document.addEventListener("DOMContentLoaded", fetchFX);
</script>
