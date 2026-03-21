---
layout: default
title: LV Cable Price Estimator
---

# LV AC and DC Distribution Cables Price Estimator for Large Projects

Class II standard circular compacted conductors only, single core cables, other conductor types may vary.  
Maximum cross section limited to 800 mm² based on practical LV cable manufacturing and installation constraints.

---

## Market Inputs

| Parameter | Value |
|---|---|
| LME Copper (USD) | $12,022 / tonne |
| LME Aluminium (USD) | $3,329 / tonne |
| GBP/USD Rate | 1 GBP = 1.3341 USD |
| GBP/EUR Rate | 1 GBP = 1.1529 EUR |
| Last Update | Saturday 21 March 2026 06:37 UTC |

---

## Weight Formulas

* **Copper kg per km** = mm² × 9.6  
* **Aluminium kg per km** = mm² × 2.92  

---

## Net Price Rule

**Net cable price ≈ Metal value ÷ Supply Cost Factor**

<div style="background: #f1f8ff; padding: 15px; border-radius: 6px; border: 1px solid #c8e1ff; display: inline-block; margin-top: 15px;">
    <label for="factor"><strong>Supply Cost Factor:</strong> </label>
    <input type="number" id="factor" value="0.3" step="0.01" oninput="recalcAll()" style="padding: 5px; width: 80px;">
    <span>(Adjust factor to update Net Prices)</span>
</div>

---

## Cable Metal and Net Price Estimator

<table id="tbl" style="width:100%; border-collapse: collapse; margin-top: 20px;">
  <thead>
    <tr style="background-color: #f6f8fa;">
      <th style="border: 1px solid #dfe2e5; padding: 8px;">mm²</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Cu kg/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Al kg/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Cu USD/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Al USD/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Cu EUR/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Al EUR/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Cu GBP/km</th>
      <th style="border: 1px solid #dfe2e5; padding: 8px;">Al GBP/km</th>
    </tr>
  </thead>
  <tbody>
    <tr data-mm2="0.5"><td>0.5</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="0.75"><td>0.75</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="1"><td>1</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="1.5"><td>1.5</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="2.5"><td>2.5</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="4"><td>4</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="6"><td>6</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="10"><td>10</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="16"><td>16</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="25"><td>25</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="35"><td>35</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="50"><td>50</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="70"><td>70</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="95"><td>95</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="120"><td>120</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="150"><td>150</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="185"><td>185</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="240"><td>240</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="300"><td>300</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="400"><td>400</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="500"><td>500</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="630"><td>630</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-mm2="800"><td>800</td><td class="cu_kg"></td><td class="al_kg"></td><td class="cu_usd"></td><td class="al_usd"></td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
  </tbody>
</table>

<script>
// --- Base Market Variables (Python will update these automatically) ---
let lme_cu_usd = 12021.50;
let lme_al_usd = 3329.00;
let gbp_usd = 1.3341;
let gbp_eur = 1.1529;

function fmt(x) { return Math.round(x).toLocaleString(); }
function fmtDec(x) { return Number.isInteger(x) ? x : x.toFixed(2); }

function recalcAll() {
    let f = parseFloat(document.getElementById("factor").value);
    if (isNaN(f) || f <= 0) return;

    // Metal prices per kg in USD
    let cu_usd_per_kg = lme_cu_usd / 1000;
    let al_usd_per_kg = lme_al_usd / 1000;

    document.querySelectorAll("#tbl tbody tr").forEach(r => {
        let mm2 = parseFloat(r.dataset.mm2);

        // 1. Calculate Weights
        let cu_kg = mm2 * 9.6;
        let al_kg = mm2 * 2.92;

        // 2. Calculate Base USD values
        let cu_usd_base = cu_kg * cu_usd_per_kg;
        let al_usd_base = al_kg * al_usd_per_kg;

        // 3. Apply Supply Factor to get Net USD
        let cu_net_usd = cu_usd_base / f;
        let al_net_usd = al_usd_base / f;

        // 4. Convert to GBP
        let cu_net_gbp = cu_net_usd / gbp_usd;
        let al_net_gbp = al_net_usd / gbp_usd;

        // 5. Convert to EUR
        let cu_net_eur = cu_net_gbp * gbp_eur;
        let al_net_eur = al_net_gbp * gbp_eur;

        // 6. Inject into HTML table
        r.querySelector(".cu_kg").innerText = fmtDec(cu_kg);
        r.querySelector(".al_kg").innerText = fmtDec(al_kg);
        
        r.querySelector(".cu_usd").innerText = fmt(cu_net_usd);
        r.querySelector(".al_usd").innerText = fmt(al_net_usd);
        
        r.querySelector(".cu_eur").innerText = fmt(cu_net_eur);
        r.querySelector(".al_eur").innerText = fmt(al_net_eur);
        
        r.querySelector(".cu_gbp").innerText = fmt(cu_net_gbp);
        r.querySelector(".al_gbp").innerText = fmt(al_net_gbp);
    });
}

// Run calculation immediately on page load
window.addEventListener('DOMContentLoaded', recalcAll);
</script>
