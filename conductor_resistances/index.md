# Maximum DC Conductor Resistance (IEC 60228)

This reference tool provides Maximum DC Resistance values for Class 2 stranded conductors at 20°C and 90°C.

---

## Conductor Data Table

*Type a size (e.g. "240") to filter the table:*  
<input type="text" id="tableSearch" onkeyup="filterTable()" placeholder="Search Nominal Area (mm²)..." style="padding:8px;width:250px;border-radius:4px;border:1px solid #ccc;margin-bottom:15px;">

<table id="resTable">
<thead>
<tr>
<th>Nominal Area (mm²)</th>
<th>Verified Conductor Diameter (mm)</th>
<th>Copper @ 20°C (Ω/km)</th>
<th>Copper @ 90°C (Ω/km)</th>
<th>Aluminium @ 20°C (Ω/km)</th>
<th>Aluminium @ 90°C (Ω/km)</th>
</tr>
</thead>
<tbody>
<tr><td>0.5</td><td></td><td>36.0</td><td>45.9</td><td></td><td></td></tr>
<tr><td>0.75</td><td></td><td>24.5</td><td>31.2</td><td></td><td></td></tr>
<tr><td>1.0</td><td></td><td>18.1</td><td>23.1</td><td></td><td></td></tr>
<tr><td>1.5</td><td></td><td>12.1</td><td>15.4</td><td></td><td></td></tr>
<tr><td>2.5</td><td></td><td>7.41</td><td>9.45</td><td></td><td></td></tr>
<tr><td>4</td><td></td><td>4.61</td><td>5.88</td><td></td><td></td></tr>
<tr><td>6</td><td></td><td>3.08</td><td>3.93</td><td></td><td></td></tr>
<tr><td>10</td><td></td><td>1.83</td><td>2.33</td><td>3.08</td><td>3.95</td></tr>
<tr><td>16</td><td></td><td>1.15</td><td>1.47</td><td>1.91</td><td>2.45</td></tr>
<tr><td>25</td><td></td><td>0.727</td><td>0.927</td><td>1.20</td><td>1.54</td></tr>
<tr><td>35</td><td></td><td>0.524</td><td>0.668</td><td>0.868</td><td>1.11</td></tr>
<tr><td>50</td><td>8.16</td><td>0.387</td><td>0.494</td><td>0.641</td><td>0.822</td></tr>
<tr><td>70</td><td>9.90</td><td>0.268</td><td>0.342</td><td>0.443</td><td>0.568</td></tr>
<tr><td>95</td><td>11.35</td><td>0.193</td><td>0.246</td><td>0.320</td><td>0.410</td></tr>
<tr><td>120</td><td>12.83</td><td>0.153</td><td>0.195</td><td>0.253</td><td>0.324</td></tr>
<tr><td>150</td><td>13.95</td><td>0.124</td><td>0.158</td><td>0.206</td><td>0.264</td></tr>
<tr><td>185</td><td>16.40</td><td>0.0991</td><td>0.126</td><td>0.164</td><td>0.210</td></tr>
<tr><td>240</td><td>17.95</td><td>0.0754</td><td>0.0961</td><td>0.125</td><td>0.160</td></tr>
<tr><td>300</td><td>20.5</td><td>0.0601</td><td>0.0766</td><td>0.100</td><td>0.128</td></tr>
<tr><td>400</td><td>23.5</td><td>0.0470</td><td>0.0599</td><td>0.0778</td><td>0.0997</td></tr>
<tr><td>500</td><td>26.40</td><td>0.0366</td><td>0.0467</td><td>0.0605</td><td>0.0776</td></tr>
<tr><td>630</td><td>30.8</td><td>0.0283</td><td>0.0361</td><td>0.0469</td><td>0.0601</td></tr>
<tr><td>800</td><td></td><td>0.0221</td><td>0.0282</td><td>0.0367</td><td>0.0471</td></tr>
<tr><td>1000</td><td>38.4</td><td>0.0176</td><td>0.0224</td><td>0.0291</td><td>0.0373</td></tr>
<tr><td>1200</td><td>44.0</td><td>0.0151</td><td>0.0193</td><td>0.0247</td><td>0.0317</td></tr>
<tr><td>1400</td><td></td><td>0.0129</td><td>0.0164</td><td>0.0212</td><td>0.0272</td></tr>
<tr><td>1600</td><td>50.3</td><td>0.0113</td><td>0.0144</td><td>0.0186</td><td>0.0238</td></tr>
<tr><td>1800</td><td></td><td>0.0101</td><td>0.0129</td><td>0.0165</td><td>0.0212</td></tr>
<tr><td>2000</td><td></td><td>0.0090</td><td>0.0115</td><td>0.0149</td><td>0.0191</td></tr>
<tr><td>2500</td><td></td><td>0.0072</td><td>0.0092</td><td>0.0127</td><td>0.0163</td></tr>
</tbody>
</table>

<script>
function filterTable() {
  const input = document.getElementById("tableSearch");
  const filter = input.value.toUpperCase();
  const table = document.getElementById("resTable");
  const tr = table.getElementsByTagName("tr");

  for (let i = 1; i < tr.length; i++) {
    const td = tr[i].getElementsByTagName("td")[0];
    if (td) {
      const txtValue = td.textContent || td.innerText;
      tr[i].style.display = txtValue.toUpperCase().includes(filter) ? "" : "none";
    }
  }
}
</script>

---

⚠️ Note: JavaScript will not run inside GitHub Markdown. Host via GitHub Pages or HTML file for full functionality.
