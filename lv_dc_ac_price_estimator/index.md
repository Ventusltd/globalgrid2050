---
layout: default
title: Cable Price Estimator
---

# LV AC and DC Distribution Cables Price Estimator

Class II standard circular compacted conductors only, single core cables.  
Maximum cross section limited to 800 mm² based on practical LV cable manufacturing and installation constraints.

**LME Copper price:** 12021.50 USD per tonne  
**LME Aluminium price:** 3329.00 USD per tonne  
**FX:** 1 GBP = 1.3341 USD | 1 GBP = 1.1529 EUR | 1 GBP = 1.0513 CHF

---

### Supply Cost Factor
<div style="background: #f1f8ff; padding: 15px; border-radius: 6px; border: 1px solid #c8e1ff; display: inline-block;">
    <input type="number" id="factor" value="0.3" step="0.01" oninput="recalcAll()" style="padding: 5px; width: 80px;">
    <span>(Adjust factor to update Net Prices)</span>
</div>

---

### Cable Metal and Net Price Estimator

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
    <tr data-cu="57.7" data-al="4.9"><td>0.5</td><td>4.8</td><td>1.46</td><td>57.7</td><td>4.9</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="86.6" data-al="7.3"><td>0.75</td><td>7.2</td><td>2.19</td><td>86.6</td><td>7.3</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="115.4" data-al="9.7"><td>1</td><td>9.6</td><td>2.92</td><td>115.4</td><td>9.7</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="173.1" data-al="14.6"><td>1.5</td><td>14.4</td><td>4.38</td><td>173.1</td><td>14.6</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="288.5" data-al="24.3"><td>2.5</td><td>24.0</td><td>7.30</td><td>288.5</td><td>24.3</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="461.6" data-al="38.9"><td>4</td><td>38.4</td><td>11.68</td><td>461.6</td><td>38.9</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="692.4" data-al="58.3"><td>6</td><td>57.6</td><td>17.52</td><td>692.4</td><td>58.3</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="1154.1" data-al="97.2"><td>10</td><td>96.0</td><td>29.20</td><td>1,154</td><td>97.2</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="1846.5" data-al="155.5"><td>16</td><td>153.6</td><td>46.72</td><td>1,846</td><td>155.5</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="2885.2" data-al="243.0"><td>25</td><td>240.0</td><td>73.00</td><td>2,885</td><td>243.0</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="4039.2" data-al="340.2"><td>35</td><td>336.0</td><td>102.20</td><td>4,039</td><td>340.2</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="5770.3" data-al="486.0"><td>50</td><td>480.0</td><td>146.00</td><td>5,770</td><td>486.0</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="8078.4" data-al="680.4"><td>70</td><td>672.0</td><td>204.40</td><td>8,078</td><td>680.4</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="10963.6" data-al="923.3"><td>95</td><td>912.0</td><td>277.40</td><td>10,964</td><td>923.3</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="13848.8" data-al="1166.4"><td>120</td><td>1,152</td><td>350.40</td><td>13,849</td><td>1,166</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="17310.9" data-al="1458.1"><td>150</td><td>1,440</td><td>438.00</td><td>17,311</td><td>1,458</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="21346.2" data-al="1798.6"><td>185</td><td>1,776</td><td>540.20</td><td>21,346</td><td>1,799</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="27697.6" data-al="2332.9"><td>240</td><td>2,304</td><td>700.80</td><td>27,698</td><td>2,333</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="34621.9" data-al="2916.2"><td>300</td><td>2,880</td><td>876.00</td><td>34,622</td><td>2,916</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="46162.6" data-al="3887.1"><td>400</td><td>3,840</td><td>1,168</td><td>46,163</td><td>3,887</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="57703.2" data-al="4859.3"><td>500</td><td>4,800</td><td>1,460</td><td>57,703</td><td>4,859</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="72706.0" data-al="6122.0"><td>630</td><td>6,048</td><td>1,840</td><td>72,706</td><td>6,122</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
    <tr data-cu="92325.1" data-al="7775.5"><td>800</td><td>7,680</td><td>2,336</td><td>92,325</td><td>7,776</td><td class="cu_eur"></td><td class="al_eur"></td><td class="cu_gbp"></td><td class="al_gbp"></td></tr>
  </tbody>
</table>

<script>
function fmt(x){ return Math.round(x).toLocaleString(); }

function recalcAll(){
    let f = parseFloat(document.getElementById("factor").value);
    if (isNaN(f) || f <= 0) return;

    document.querySelectorAll("#tbl tbody tr").forEach(r => {
        let cu = parseFloat(r.dataset.cu);
        let al = parseFloat(r.dataset.al);

        let gbp_usd = 1.3341;
        let gbp_eur = 1.1529;

        let cu_net = cu / f;
        let al_net = al / f;

        let cu_gbp = cu_net / gbp_usd;
        let al_gbp = al_net / gbp_usd;

        let cu_eur = cu_gbp * gbp_eur;
        let al_eur = al_gbp * gbp_eur;

        r.querySelector(".cu_eur").innerText = fmt(cu_eur);
        r.querySelector(".al_eur").innerText = fmt(al_eur);
        r.querySelector(".cu_gbp").innerText = fmt(cu_gbp);
        r.querySelector(".al_gbp").innerText = fmt(al_gbp);
    });
}

// Ensure it runs once on load
window.addEventListener('DOMContentLoaded', recalcAll);
</script>
