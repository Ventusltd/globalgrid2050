---
layout: page
title: UK Macro Energy Consumption Trends (ONS)
permalink: /uk_macro_energy_trends/
---

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>

<style>
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    .study-panel { background: #111; padding: 25px; border-radius: 12px; border: 1px solid #444; margin-bottom: 25px; color: #ddd; line-height: 1.6; }
    .study-panel h2 { color: #66ccff; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .chart-wrapper { background: #0b0e14; border: 3px solid #2a2f3a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .grid-row { display: flex; flex-wrap: wrap; gap: 20px; }
    .grid-col { flex: 1; min-width: 450px; height: 450px; }
    
    .ons-table-container { background: #fff; padding: 20px; border-radius: 12px; color: #333; margin-top: 30px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #eee; text-align: left; padding: 12px; border-bottom: 2px solid #ccc; font-weight: bold; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .total-row { background: #f9f9f9; font-weight: bold; border-top: 2px solid #333; }
</style>

<div class="dashboard-container">

    <div class="study-panel">
        <h2>UK Energy Use by Sector (2019 ONS Data)</h2>
        <p>The UK consumes approximately <b>141.3 Mtoe</b> of primary energy annually, equivalent to <b>1,644 TWh</b>. From an engineering standpoint, fossil fuel conversion is inherently wasteful: internal combustion vehicles lose ~75% as heat, and thermal power stations lose ~60%.</p>
    </div>

    <div class="ons-table-container">
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
            <tr class="total-row">
                <td colspan="4">TOTAL UK PRIMARY ENERGY (All Sectors)</td>
                <td>141.30</td>
                <td>1,644</td>
                <td>100.00%</td>
            </tr>
          </tbody>
        </table>
    </div>

    <div class="study-panel" style="margin-top: 30px;">
        <h2>Ventus Study: The Electrification Efficiency Dividend</h2>
        <p>Transitioning to electric systems (EVs and Heat Pumps) eliminates conversion losses. A fully electrified UK delivers the same useful energy for ~60% less primary input. Reference: <a href="https://www.ventusltd.com/post/the-real-peak-challenge-of-electrifying-heat-and-transport-in-the-uk" target="_blank" style="color:#66ccff;">Ventus Engineering Study</a>.</p>
    </div>

    <div class="grid-row">
        <div class="grid-col chart-wrapper">
            <canvas id="demandChart"></canvas>
        </div>
        <div class="grid-col chart-wrapper">
            <canvas id="peakChart"></canvas>
        </div>
    </div>
</div>

<script>
    // Register the data labels plugin globally
    Chart.register(ChartDataLabels);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: {
                color: '#fff',
                anchor: 'end',
                align: 'top',
                offset: 5,
                font: { weight: 'bold', size: 14 },
                formatter: (value) => value.toLocaleString()
            }
        },
        scales: {
            y: { 
                beginAtZero: true, 
                grid: { color: '#333' },
                ticks: { color: '#aaa' }
            },
            x: { 
                ticks: { color: '#fff', font: { size: 12 } }
            }
        }
    };

    const ctxDemand = document.getElementById('demandChart').getContext('2d');
    new Chart(ctxDemand, {
        type: 'bar',
        data: {
            labels: ['2019 Primary Demand', 'Electrified Requirement'],
            datasets: [{ 
                data: [1644, 600], 
                backgroundColor: ['#2e86c1', '#28b463'],
                borderRadius: 5
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: { display: true, text: 'Energy Demand Reduction (TWh)', color: '#66ccff', font: { size: 18 } }
            }
        }
    });

    const ctxPeak = document.getElementById('peakChart').getContext('2d');
    new Chart(ctxPeak, {
        type: 'bar',
        data: {
            labels: ['Theoretical Unmanaged', 'Managed Diversity', 'Current Winter Peak'],
            datasets: [{ 
                data: [246, 95, 48.3], 
                backgroundColor: ['#e74c3c', '#f39c12', '#2c3e50'],
                borderRadius: 5
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: { display: true, text: 'Grid Peak Load Challenge (GW)', color: '#66ccff', font: { size: 18 } }
            }
        }
    });
</script>
