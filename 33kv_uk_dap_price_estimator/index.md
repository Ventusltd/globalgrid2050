<h2>33 kV Cable Price Estimator</h2>

<p>
Quick engineering tool for aluminium 33 kV cables with copper wire screen.<br>
Use live inputs below, then compare against the fixed reference table.
</p>

<div style="margin-bottom:20px;">
<label>Copper USD</label><br>
<input id="cu" value="12850" style="width:100%;padding:10px;margin-bottom:10px;">

<label>Aluminium USD</label><br>
<input id="al" value="3520" style="width:100%;padding:10px;margin-bottom:10px;">

<label>FX (GBP/USD)</label><br>
<input id="fx" value="1.3265" style="width:100%;padding:10px;margin-bottom:10px;">

<button onclick="calc()" style="padding:10px 20px;">Run</button>
</div>

<div style="overflow-x:auto;">
<table id="tbl" style="border-collapse:collapse;width:100%;font-family:Courier, monospace;">
<thead>
<tr>
<th>mm²</th>
<th>Al kg/km</th>
<th>Cu kg/km</th>
<th>Total £/km</th>
<th>Net £/km</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>

<script>
function calc(){

let cu = parseFloat(document.getElementById("cu").value);
let al = parseFloat(document.getElementById("al").value);
let fx = parseFloat(document.getElementById("fx").value);

let cu_gbp = cu / fx;
let al_gbp = al / fx;

let cables = [
[120,35],[150,35],[185,35],[240,35],[300,35],
[400,35],[500,35],[630,35],[800,50],[1000,50],
[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

let tbody = document.querySelector("#tbl tbody");
tbody.innerHTML = "";

cables.forEach(c => {

let cond = c[0];
let cws = c[1];

let al_kg = cond * 2.92;
let cu_kg = cws * 9.6;

let al_cost = al_kg * (al_gbp/1000);
let cu_cost = cu_kg * (cu_gbp/1000);

let total = al_cost + cu_cost;
let net = total / 0.3;

let row = `<tr>
<td>${cond}</td>
<td>${al_kg.toFixed(0)}</td>
<td>${cu_kg.toFixed(0)}</td>
<td>${total.toFixed(0)}</td>
<td>${net.toFixed(0)}</td>
</tr>`;

tbody.innerHTML += row;

});
}
</script>

<style>
#tbl th {
position:sticky;
top:0;
background:#000;
color:#fff;
}

#tbl th, #tbl td {
border:1px solid #555;
padding:8px;
text-align:left;
}
</style>

<hr>

<h3>Reference Table (Fixed Market Snapshot)</h3>

<p>
This table is preserved as a fixed reference for comparison against live market inputs.
</p>
