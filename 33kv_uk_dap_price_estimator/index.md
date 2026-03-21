## Live Pricing Engine: 33 kV and LV Single Core Models

Single core 19/33 kV aluminium conductor XLPE insulated cable with copper wire screen and MDPE oversheath to BS 7870.

- Copper wire screen is fixed by design:
  - 35 mm² for 120 to 630 mm² conductors
  - 50 mm² for 800 to 2500 mm² conductors

The LV section models single core copper and aluminium conductors. Both allow user defined non metal cost percentages or flat hollow prices to calculate final net prices.

---

## Weight Formulas and Rules

- Copper kg per km = mm² × 9.6  
- Aluminium kg per km = mm² × 2.92  
- Net Price Rule = Total Metal Value plus Non Metal Costs  

---

## Market Inputs

<div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border:1px solid #ddd; border-radius:8px;">

<label><strong>Copper USD per tonne</strong></label><br>
<input id="cu" value="12850" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label><strong>Aluminium USD per tonne</strong></label><br>
<input id="al" value="3520" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label><strong>GBP per USD</strong></label><br>
<input id="fx_gbp" value="1.3265" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<label><strong>EUR per USD</strong></label><br>
<input id="fx_eur" value="1.0800" oninput="calc()" style="width:100%;padding:10px;margin-bottom:10px;">

<div style="font-size:0.9em; color:#555; margin-bottom:20px;">
<strong id="fx_time">Fetching live FX...</strong><br>
<em>1 GBP = <span id="gbp_eur">...</span> EUR | 1 EUR = <span id="eur_gbp">...</span> GBP</em>
</div>

---

### Manufacturing Inputs

<label>Supplier Quote Currency</label><br>
<select id="flat_currency" onchange="calc()">
<option value="EUR">EUR</option>
<option value="GBP">GBP</option>
<option value="USD">USD</option>
</select>

<label>33 kV Non Metal Cost (%)</label>
<input id="mv_non_metal_pct" type="number" value="70" oninput="calc()">

<label>33 kV Flat Price</label>
<input id="mv_flat_val" type="number" value="0" oninput="calc()">

<label>LV Non Metal Cost (%)</label>
<input id="lv_non_metal_pct" type="number" value="70" oninput="calc()">

<label>LV Flat Price</label>
<input id="lv_flat_val" type="number" value="0" oninput="calc()">

<label>Display Currency</label>
<select id="currency" onchange="calc()">
<option value="GBP">GBP</option>
<option value="USD">USD</option>
<option value="EUR">EUR</option>
</select>

</div>

---

## 33 kV Aluminium Cable Pricing

<table id="liveTbl33">
<thead>
<tr>
<th>Cond mm²</th>
<th>CWS mm²</th>
<th>Al kg per km</th>
<th>Cu kg per km</th>
<th>Al R90</th>
<th>Total Metal</th>
<th>Non Metal</th>
<th>£</th>
<th>$</th>
<th>€</th>
</tr>
</thead>
<tbody></tbody>
</table>

---

## LV Cable Pricing

<table id="lvTbl">
<thead>
<tr>
<th>mm²</th>
<th>Material</th>
<th>kg per km</th>
<th>Metal</th>
<th>Non Metal</th>
<th>£</th>
<th>$</th>
<th>€</th>
</tr>
</thead>
<tbody></tbody>
</table>

---

## Script

<script>

const al_res_20c = {
120:0.253,150:0.206,185:0.164,240:0.125,300:0.100,
400:0.0778,500:0.0605,630:0.0469,800:0.0367,1000:0.0291,
1200:0.0247,1400:0.0212,1600:0.0186,1800:0.0165,2000:0.0149,2500:0.0127
};

const mvCables = [
[120,35],[150,35],[185,35],[240,35],[300,35],[400,35],[500,35],[630,35],
[800,50],[1000,50],[1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
];

const lvSizes = [4,6,10,16,25,35,50,70,95,120,150,185,240,300,400,500,630,800,1000,1200,1400,1600,1800,2000,2500];

async function fetchFX(){
try{
let r=await fetch("https://api.exchangerate.host/latest?base=USD&symbols=GBP,EUR");
let d=await r.json();
document.getElementById("fx_gbp").value=(1/d.rates.GBP).toFixed(4);
document.getElementById("fx_eur").value=(1/d.rates.EUR).toFixed(4);
}catch{}
}

function calc(){

let cu=parseFloat(cuEl.value)||0;
let al=parseFloat(alEl.value)||0;
let fxg=parseFloat(fx_gbp.value)||1;
let fxe=parseFloat(fx_eur.value)||1;

let mv_pct=parseFloat(mv_non_metal_pct.value)||0;
let lv_pct=parseFloat(lv_non_metal_pct.value)||0;

let mv_flat=parseFloat(mv_flat_val.value)||0;
let lv_flat=parseFloat(lv_flat_val.value)||0;

let metal_ratio_mv=Math.max((100-mv_pct)/100,0.01);
let metal_ratio_lv=Math.max((100-lv_pct)/100,0.01);

let tbody33="";
mvCables.forEach(c=>{
let cond=c[0],cws=c[1];

let alkg=cond*2.92;
let cukg=cws*9.6;

let metal=(alkg*(al/1000))+(cukg*(cu/1000));
let net=(metal/metal_ratio_mv)+mv_flat;

tbody33+=`<tr>
<td>${cond}</td><td>${cws}</td>
<td>${alkg.toFixed(0)}</td><td>${cukg.toFixed(0)}</td>
<td>${(al_res_20c[cond]||0).toFixed(4)}</td>
<td>${metal.toFixed(0)}</td>
<td>${(net-metal).toFixed(0)}</td>
<td>${(net/fxg).toFixed(0)}</td>
<td>${net.toFixed(0)}</td>
<td>${(net/fxe).toFixed(0)}</td>
</tr>`;
});
liveTbl33.innerHTML=tbody33;

}

document.addEventListener("DOMContentLoaded",()=>{
fetchFX();
calc();
});

</script>

---

## Notes

This estimator supports early stage cost modelling for:

- Solar farms  
- Battery energy storage systems  
- Wind farms  
- Utility substations  
- Transmission and distribution  

---

## Disclaimer

Values are indicative only. Actual pricing varies with volume, factory loading, and specification. No warranty is given for accuracy.
