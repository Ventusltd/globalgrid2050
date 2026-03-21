<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>LV Cable Price Estimator</title>

<style>
body { font-family: Arial, sans-serif; margin: 20px; }

.table-container {
  max-height: 600px;
  overflow: auto;
  border: 1px solid #ccc;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th, td {
  border: 1px solid #ccc;
  padding: 6px;
  text-align: right;
}

th {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
}

td:first-child, th:first-child {
  position: sticky;
  left: 0;
  background: #fff;
  text-align: left;
  z-index: 3;
}
</style>

</head>

<body>

<h2>LV AC and DC Distribution Cables Price Estimator for Large Projects</h2>

<p>
Class II standard circular compacted conductors only, single core cables, other conductor types may vary<br>
DC resistance at 20°C per IEC 60228<br>
LME Copper price: 12021.50 USD per tonne (1000 kg)<br>
LME Aluminium price: 3329.00 USD per tonne (1000 kg)<br>
FX: 1 GBP = 1.3341 USD | 1 GBP = 1.1529 EUR | 1 GBP = 1.0513 CHF<br>
Supply cost factor: 0.3 (adjustable)<br>
Net price estimate = metal cost ÷ supply cost factor
</p>

<div class="table-container">

<table>
<thead>
<tr>
<th>Cross section mm²</th>
<th>Cu DC Ω/km @20°C</th>
<th>Al DC Ω/km @20°C</th>
<th>Cu kg/km</th>
<th>Al kg/km</th>
<th>Cu USD/km</th>
<th>Al USD/km</th>
<th>Cu net USD/km</th>
<th>Al net USD/km</th>
<th>Cu net GBP/km</th>
<th>Al net GBP/km</th>
<th>Cu net EUR/km</th>
<th>Al net EUR/km</th>
<th>Cu net CHF/km</th>
<th>Al net CHF/km</th>
</tr>
</thead>

<tbody>

<tr><td>10</td><td>1.83</td><td>3.08</td><td>96</td><td>29.2</td><td>1154.1</td><td>97.2</td><td>3847.0</td><td>324.0</td><td>2883.7</td><td>242.9</td><td>3325.5</td><td>280.1</td><td>3032.7</td><td>255.5</td></tr>
<tr><td>25</td><td>0.727</td><td>1.20</td><td>240</td><td>73</td><td>2885.2</td><td>243.0</td><td>9617.3</td><td>810.0</td><td>7208.6</td><td>607.1</td><td>8313.0</td><td>700.0</td><td>7582.6</td><td>638.4</td></tr>
<tr><td>50</td><td>0.387</td><td>0.641</td><td>480</td><td>146</td><td>5770.3</td><td>486.0</td><td>19234.3</td><td>1620.0</td><td>14417.1</td><td>1214.3</td><td>16623.6</td><td>1400.0</td><td>15162.0</td><td>1276.0</td></tr>
<tr><td>95</td><td>0.193</td><td>0.320</td><td>912</td><td>277.4</td><td>10963.6</td><td>923.3</td><td>36545.3</td><td>3077.7</td><td>27390.2</td><td>2307.3</td><td>31582.0</td><td>2660.9</td><td>28809.0</td><td>2426.7</td></tr>
<tr><td>240</td><td>0.0754</td><td>0.125</td><td>2304</td><td>700.8</td><td>27697.6</td><td>2332.9</td><td>92325.3</td><td>7776.3</td><td>69181.7</td><td>5830.0</td><td>79786.5</td><td>6716.6</td><td>72759.0</td><td>6129.0</td></tr>
<tr><td>630</td><td>0.0283</td><td>0.0469</td><td>6048</td><td>1839.6</td><td>72706.0</td><td>6122.0</td><td>242353.3</td><td>20406.7</td><td>181660.3</td><td>15299.9</td><td>209412.2</td><td>17643.6</td><td>190974.0</td><td>16080.0</td></tr>
<tr><td>1200</td><td>0.0151</td><td>0.0247</td><td>11520</td><td>3504</td><td>138487.7</td><td>11643.2</td><td>461625.7</td><td>38810.7</td><td>346026.8</td><td>29087.7</td><td>398986.0</td><td>33526.3</td><td>363655.0</td><td>30570.0</td></tr>

</tbody>
</table>

</div>

</body>
</html>
