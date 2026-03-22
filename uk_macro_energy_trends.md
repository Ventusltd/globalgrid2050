---
layout: page
title: UK Macro Energy Consumption & Grid Peak Trends
permalink: /uk_macro_energy_trends/
---

<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    .chart-wrapper { background: #0b0e14; border: 3px solid #2a2f3a; border-radius: 12px; padding: 20px; margin-bottom: 20px; position: relative; }
    .main-chart { height: 500px; }
    .sub-chart { height: 350px; }
    .summary-panel { background: #111; padding: 25px; border-radius: 12px; border: 1px solid #444; margin-bottom: 20px; color: #ddd; line-height: 1.6; }
    .summary-panel h3 { color: #66ccff; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .grid-row { display: flex; flex-wrap: wrap; gap: 20px; }
    .grid-col { flex: 1; min-width: 400px; }

    /* ONS Table Styling */
    .ons-table-container { background: #fff; padding: 20px; border-radius: 12px; color: #333; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #eee; text-align: left; padding: 10px; border-bottom: 2px solid #ccc; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
</style>

<div class="dashboard-container">

    <div class="summary-panel">
        <h3>The Real Peak Challenge: Electrifying Heat and Transport</h3>
        <p>A fully electrified UK would likely require only <b>500 to 700 TWh</b> of electricity rather than replacing the full <b>1644 TWh</b> of primary energy one for one. This transition eliminates conversion losses and delivers the same output with far less input energy.</p>
    </div>

    <div class="grid-row">
        <div class="grid-col chart-wrapper sub-chart">
            <canvas id="demandChart"></canvas>
        </div>
        <div class="grid-col chart-wrapper sub-chart">
            <canvas id="peakChart"></canvas>
        </div>
    </div>

    <div class="ons-table-container">
        <h3>UK Energy Use by Sector (2019 ONS Data)</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Economic Sector</th>
              <th>SourceName</th>
              <th>ActivityName</th>
              <th>Mtoe</th>
              <th>TWh</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Electricity production - gas</td><td>Power stations</td><td>Natural gas</td><td>20.13</td><td>234</td><td>14.24%</td></tr>
            <tr><td>2</td><td>Consumer expenditure - not travel</td><td>Domestic Space Heater</td><td>Natural gas</td><td>16.518</td><td>192</td><td>11.69%</td></tr>
            <tr><td>3</td><td>Air transport services</td><td>Aircraft - international cruise</td><td>Aviation turbine fuel</td><td>9.869</td><td>115</td><td>6.98%</td></tr>
            <tr><td>4</td><td>Water transport services</td><td>Shipping - international IPCC definition</td><td>Fuel oil</td><td>6.013</td><td>70</td><td>4.25%</td></tr>
            <tr><td>5</td><td>Consumer expenditure - not travel</td><td>Domestic Water Heater</td><td>Natural gas</td><td>4.832</td><td>56</td><td>3.42%</td></tr>
            <tr><td>6</td><td>Consumer expenditure - travel</td><td>Road transport - cars - urban driving</td><td>Petrol</td><td>4.132</td><td>48</td><td>2.92%</td></tr>
            <tr><td>7</td><td>Consumer expenditure - travel</td><td>Road transport - cars - rural driving</td><td>Petrol</td><td>3.572</td><td>42</td><td>2.53%</td></tr>
            <tr><td>8</td><td>Consumer expenditure - travel</td><td>Road transport - cars - rural driving</td><td>DERV</td><td>3.353</td><td>39</td><td>2.37%</td></tr>
            <tr><td>9</td><td>Consumer expenditure - travel</td><td>Road transport - cars - urban driving</td><td>DERV</td><td>2.901</td><td>34</td><td>2.05%</td></tr>
            <tr><td>10</td><td>Manufacture of refined petroleum products</td><td>Refineries - combustion</td><td>OPG</td><td>2.682</td><td>31</td><td>1.90%</td></tr>
            <tr><td>11</td><td>Crude petroleum and natural gas</td><td>Upstream Oil Production - fuel combustion</td><td>Natural gas</td><td>2.203</td><td>26</td><td>1.56%</td></tr>
            <tr><td>12</td><td>Human health services</td><td>Public sector combustion</td><td>Natural gas</td><td>1.64</td><td>19</td><td>1.16%</td></tr>
            <tr><td>13</td><td>Products of agriculture, hunting and related services</td><td>NRMM; Agriculture</td><td>Gas oil</td><td>1.587</td><td>18</td><td>1.12%</td></tr>
            <tr><td>14</td><td>Freight transport by road and removal services</td><td>Road transport - HGV articulated - motorway driving</td><td>DERV</td><td>1.496</td><td>17</td><td>1.06%</td></tr>
            <tr><td>15</td><td>Consumer expenditure - travel</td><td>Road transport - cars - motorway driving</td><td>Petrol</td><td>1.493</td><td>17</td><td>1.06%</td></tr>
            <tr><td>16</td><td>Manufacture of basic Iron & Steel</td><td>Blast furnaces</td><td>Coke</td><td>1.475</td><td>17</td><td>1.04%</td></tr>
            <tr><td>17</td><td>Consumer expenditure - travel</td><td>Road transport - cars - motorway driving</td><td>DERV</td><td>1.448</td><td>17</td><td>1.02%</td></tr>
            <tr><td>18</td><td>Electricity production - coal</td><td>Power stations</td><td>Coal</td><td>1.376</td><td>16</td><td>0.97%</td></tr>
            <tr><td>19</td><td>Consumer expenditure - not travel</td><td>Domestic Space Heater</td><td>Burning oil</td><td>1.302</td><td>15</td><td>0.92%</td></tr>
            <tr><td>20</td><td>Consumer expenditure - travel</td><td>Road transport - cars - cold start</td><td>Petrol</td><td>1.186</td><td>14</td><td>0.84%</td></tr>
          </tbody>
        </table>
    </div>

    <div class="summary-panel" style="margin-top:20px;">
        <h3>System-Level Interpretation</h3>
        <p>The UK consumes ~1644 TWh (141 Mtoe) of primary energy. Internal combustion vehicles lose 70-75% as heat; thermal power stations lose 50-65%.</p>
        <ul>
            <li><b>EVs:</b> 70% efficient (energy to motion).</li>
            <li><b>Heat Pumps:</b> 350-500% efficient (SCOP 3.5 to 5.0).</li>
        </ul>
        <p><b>Logic:</b> Conversion factor used is 11.63 TWh per Mtoe. Percentages relative to UK primary total.</p>
    </div>
</div>

<script>
    // --- Charts Initialization ---
    const ctxDemand = document.getElementById('demandChart').getContext('2d');
    new Chart(ctxDemand, {
        type: 'bar',
        data: {
            labels: ['2019 Primary Demand', 'Future Electrified Demand'],
            datasets: [{
                label: 'TWh',
                data: [1644, 600],
                backgroundColor: ['#2e86c1', '#28b463']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Energy Demand Reduction', color: '#fff' } } }
    });

    const ctxPeak = document.getElementById('peakChart').getContext('2d');
    new Chart(ctxPeak, {
        type: 'bar',
        data: {
            labels: ['Theoretical Unmanaged', 'Managed Diversity Ceiling', 'Current Grid Peak'],
            datasets: [{
                label: 'GW',
                data: [246, 95, 48.3],
                backgroundColor: ['#e74c3c', '#f39c12', '#2c3e50']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Peak Grid Load Challenge (GW)', color: '#fff' } } }
    });

    // --- Line Chart for Historical Data ---
    const csvUrl = '{{ site.baseurl }}/ons-energy-fuels-clean.csv';
    Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) {
            const years = results.meta.fields.filter(f => !isNaN(f));
            const datasets = [{
                label: 'Natural Gas',
                data: years.map(y => results.data.filter(r => r.ActivityName === 'Natural gas').reduce((a, b) => a + parseFloat(b[y] || 0), 0)),
                borderColor: '#00f2ff', fill: false
            }];
            new Chart(document.getElementById('energyChart'), {
                type: 'line',
                data: { labels: years, datasets: datasets },
                options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Historical Fossil Transition (1990-2023)', color: '#fff' } } }
            });
        }
    });
</script>
