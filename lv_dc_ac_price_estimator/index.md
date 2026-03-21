# LV AC and DC Distribution Cables Price Estimator for Large Projects

Class II standard circular compacted conductors only, single core cables, other conductor types may vary.  
Maximum cross section limited to 800 mm² based on practical LV cable manufacturing and installation constraints.  
DC resistance at 20°C per IEC 60228.

---

## Market Inputs

| Parameter | Value |
|---|---|
| LME Copper (USD) | $12,021.50 per tonne |
| LME Aluminium (USD) | $3,329.00 per tonne |
| GBP/USD Rate | 1 GBP = 1.3341 USD |
| GBP/EUR Rate | 1 GBP = 1.1529 EUR |
| GBP/CHF Rate | 1 GBP = 1.0513 CHF |
| Supply Cost Factor | 0.3 |
| Last Update | Saturday 21 March 2026 |

---

## Cable Metal and Net Price Estimator

<input id="search" placeholder="Search mm²..." onkeyup="filterTable()" style="margin-bottom:10px; padding:6px; width:200px;">

<style>
table {
border-collapse:collapse;
width:100%;
}

th, td {
padding:6px;
border:1px solid #444;
text-align:right;
background:black;
color:white;
}

th {
position:sticky;
top:0;
background:#111;
z-index:2;
}

td:first-child, th:first-child {
position:sticky;
left:0;
background:#111;
z-index:3;
text-align:left;
}

input.factor {
background:black;
color:white;
border:1px solid #666;
width:60px;
text-align:center;
font-family:Courier, monospace;
}
</style>

<script>
function recalc(row){
let cu_usd = parseFloat(row.dataset.cu);
let al_usd = parseFloat(row.dataset.al);

let cu_factor = parseFloat(row.querySelector(".cu_factor").value);
let al_factor = parseFloat(row.querySelector(".al_factor").value);

row.querySelector(".cu_net").innerText = (cu_usd / cu_factor).toFixed(0);
row.querySelector(".al_net").innerText = (al_usd / al_factor).toFixed(0);
}

function filterTable(){
let input = document.getElementById("search").value.toLowerCase();
let rows = document.querySelectorAll("tbody tr");

rows.forEach(row=>{
let mm2 = row.cells[0].innerText;
row.style.display = mm2.includes(input) ? "" : "none";
});
}
</script>

<table>
<thead>
<tr>
<th>mm²</th>
<th>Cu USD/km</th>
<th>Al USD/km</th>
<th>Cu Factor</th>
<th>Al Factor</th>
<th>Cu Net USD/km</th>
<th>Al Net USD/km</th>
</tr>
</thead>

<tbody>

<tr data-cu="46163" data-al="3887">
<td>400</td>
<td>46163</td>
<td>3887</td>
<td><input class="factor cu_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td><input class="factor al_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td class="cu_net">153875</td>
<td class="al_net">12957</td>
</tr>

<tr data-cu="57703" data-al="4859">
<td>500</td>
<td>57703</td>
<td>4859</td>
<td><input class="factor cu_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td><input class="factor al_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td class="cu_net">192344</td>
<td class="al_net">16198</td>
</tr>

<tr data-cu="72706" data-al="6122">
<td>630</td>
<td>72706</td>
<td>6122</td>
<td><input class="factor cu_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td><input class="factor al_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td class="cu_net">242353</td>
<td class="al_net">20407</td>
</tr>

<tr data-cu="92325" data-al="7776">
<td>800</td>
<td>92325</td>
<td>7776</td>
<td><input class="factor cu_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td><input class="factor al_factor" value="0.3" oninput="recalc(this.closest('tr'))"></td>
<td class="cu_net">307750</td>
<td class="al_net">25918</td>
</tr>

</tbody>
</table>

---

## Notes

This estimator supports early stage cost analysis for:

- Solar farms  
- Battery energy storage systems  
- EV infrastructure  
- Industrial LV distribution systems  

---

## Disclaimer

These values are derived from market assumptions and internal modelling.  
Actual cable pricing varies based on project volume, factory loading, and procurement strategy.  
No warranty is given for data accuracy.
