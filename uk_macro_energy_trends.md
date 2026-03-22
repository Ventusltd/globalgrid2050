---
layout: page
title: UK Macro Energy Consumption & Grid Peak Trends
permalink: /uk_macro_energy_trends/
---

<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
    .dashboard-container { 
        max-width: 1400px; 
        margin: auto; 
        padding: 10px; 
        font-family: 'Courier New', Courier, monospace; 
    }
    
    .chart-wrapper {
        background: #0b0e14;
        border: 3px solid #2a2f3a;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        position: relative;
    }

    .main-chart { height: 60vh; min-height: 500px; }
    .sub-chart { height: 40vh; min-height: 350px; }

    .summary-panel {
        background: #111;
        padding: 25px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 20px;
        color: #ddd;
        line-height: 1.6;
    }
    
    .summary-panel h3 { color: #66ccff; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .summary-panel ul { margin-top: 10px; padding-left: 20px; }
    .summary-panel li { margin-bottom: 10px; }

    .grid-row {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
    }
    .grid-col {
        flex: 1;
        min-width: 400px;
    }

    /* ONS Table Styling */
    .data-table-wrapper {
        margin-top: 30px;
        overflow-x: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        color: #ddd;
        font-size: 14px;
    }
    th {
        background: #2a2f3a;
        color: #66ccff;
        text-align: left;
        padding: 12px;
        border-bottom: 2px solid #444;
    }
    td {
        padding: 10px;
        border-bottom: 1px solid #333;
    }
    tr:hover { background: #1a1a1a; }

    .technical-footer {
        margin-top: 30px;
        font-size: 14px;
        color: #aaaaaa;
        border-top: 1px solid #333;
        padding-top: 15px;
        line-height: 1.8;
    }
    .technical-footer a { color: #66ccff; text-decoration: none; }
    .technical-footer a:hover { text-decoration: underline; }
</style>

<div class="dashboard-container">
    
    <div class="summary-panel">
        <h3>Historical System Load: National Fuel Transition (1990 - 2023)</h3>
        <p>This macro-economic dashboard aggregates the Office for National Statistics (ONS) data on energy consumption across all UK economic sectors. Values are represented in <b>Million tonnes of oil equivalent (Mtoe)</b>.</p>
    </div>

    <div class="chart-wrapper main-chart">
        <canvas id="energyChart"></canvas>
    </div>

    <div class="summary-panel" style="margin-top: 40px;">
        <h3>Engineering Study: The Real Peak Challenge of Electrifying Heat and Transport</h3>
        <p>While historical ONS data tracks the decline of coal and the plateau of gas, the transition to full electrification radically alters both <b>Primary Energy Demand</b> and <b>Peak Grid Load</b>.</p>
        <ul>
            [span_1](start_span)[span_2](start_span)[span_3](start_span)<li><b>The Efficiency Dividend:</b> Electrification can reduce the UK's total primary energy demand by up to 70 percent[span_1](end_span)[span_2](end_span)[span_3](end_span). </li>
            [span_4](start_span)[span_5](start_span)<li><b>Heat Pump Efficiency:</b> Heat pumps typically require approximately 3.5 kW of electrical input to deliver 12.25 kW of thermal output (SCOP 3.5)[span_4](end_span)[span_5](end_span). </li>
            [span_6](start_span)<li><b>Peak Load Stress Test:</b> A theoretical simultaneous peak of 28 million homes (heat pumps) and 20 million EVs (7.4 kW chargers) creates a theoretical stress test load of 246 GW[span_6](end_span). </li>
            [span_7](start_span)<li><b>Grid Capacity:</b> The UK grid is currently designed for a winter peak of 48.3 GW[span_7](end_span). </li>
            [span_8](start_span)<li><b>Managed Diversity:</b> Accounting for load diversity, the maximum demand for heat pumps is approximately 1.7 kW per home[span_8](end_span). </li>
        </ul>
    </div>

    <div class="grid-row">
        <div class="grid-col chart-wrapper sub-chart">
            <canvas id="demandChart"></canvas>
        </div>
        <div class="grid-col chart-wrapper sub-chart">
            <canvas id="peakChart"></canvas>
        </div>
    </div>

    <div class="summary-panel" style="margin-top: 40px;">
        <h3>2019 Office of National Statistics Data: Primary Energy Drivers</h3>
        <div class="data-table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Economic Sector</th>
                        <th>SourceName</th>
                        <th>ActivityName</th>
                        <th>Mtoe</th>
                        <th>TWh</th>
                        <th>% Total UK Energy</th>
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
                    <tr><td>16</td><td>Manufacture of basic Iron &amp; Steel</td><td>Blast furnaces</td><td>Coke</td><td>1.475</td><td>17</td><td>1.04%</td></tr>
                    <tr><td>17</td><td>Consumer expenditure - travel</td><td>Road transport - cars - motorway driving</td><td>DERV</td><td>1.448</td><td>17</td><td>1.02%</td></tr>
                    <tr><td>18</td><td>Electricity production - coal</td><td>Power stations</td><td>Coal</td><td>1.376</td><td>16</td><td>0.97%</td></tr>
                    <tr><td>19</td><td>Consumer expenditure - not travel</td><td>Domestic Space Heater</td><td>Burning oil</td><td>1.302</td><td>15</td><td>0.92%</td></tr>
                    <tr><td>20</td><td>Consumer expenditure - travel</td><td>Road transport - cars - cold start</td><td>Petrol</td><td>1.186</td><td>14</td><td>0.84%</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="technical-footer">
        <b>Sources & Technical Documentation:</b><br>
        <a href="https://www.ons.gov.uk/economy/environmentalaccounts/datasets/ukenvironmentalaccountsenergyusebyindustrysourceandfuel" target="_blank">1. Office for National Statistics (ONS) - UK Environmental Accounts: Energy Use by Industry, Source and Fuel (Primary Dataset)</a><br>
        <a href="https://www.ons.gov.uk/economy/environmentalaccounts" target="_blank">2. For More Recent Analysis and Raw Data Updates: Visit ONS Environmental Accounts Portal</a><br>
        <a href="https://www.ventusltd.com/post/the-real-peak-challenge-of-electrifying-heat-and-transport-in-the-uk" target="_blank">3. Ventus Ltd Engineering Report: The Real Peak Challenge of Electrifying Heat and Transport</a>
    </div>

</div>

<script>
    // --- CHART 1: ONS HISTORICAL DATA (CSV) ---
    const csvUrl = '{{ site.baseurl }}/ons-energy-fuels-clean.csv';
    const years = [];
    for (let y = 1990; y <= 2023; y++) years.push(y.toString());

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        transformHeader: function(header) { return header.trim(); },
        complete: function(results) { processData(results.data); }
    });

    function processData(data) {
        if (!data || data.length === 0) return;
        const fuelData = {};
        
        data.forEach(row => {
            const fuelType = row['ActivityName'];
            if (!fuelType || fuelType.includes('Total') || fuelType.includes('Not elsewhere classified')) return;
            if (!fuelData[fuelType]) fuelData[fuelType] = new Array(years.length).fill(0);

            years.forEach((year, index) => {
                let rawValue = row[year];
                if (typeof rawValue === 'string') rawValue = rawValue.replace(/,/g, '');
                const value = parseFloat(rawValue);
                if (!isNaN(value)) fuelData[fuelType][index] += value;
            });
        });

        const sortedFuels = Object.keys(fuelData).sort((a, b) => {
            const sumA = fuelData[a].reduce((acc, val) => acc + val, 0);
            const sumB = fuelData[b].reduce((acc, val) => acc + val, 0);
            return sumB - sumA; 
        });

        const topFuels = sortedFuels.slice(0, 7);
        const colors = ['#00f2ff', '#ff3366', '#ff9d00', '#33cc33', '#cc33ff', '#ffff00', '#ff6600'];

        const datasets = topFuels.map((fuel, index) => ({
            label: fuel,
            data: fuelData[fuel],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 2,
            pointRadius: 1,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3
        }));

        const ctx1 = document.getElementById('energyChart').getContext('2d');
        Chart.defaults.color = '#aaaaaa';
        Chart.defaults.font.family = "'Courier New', Courier, monospace";

        new Chart(ctx1, {
            type: 'line',
            data: { labels: years, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'UK Energy Consumption by Primary Fuel Types (1990 - 2023)', color: '#ffffff', font: { size: 16 } },
                    tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#66ccff' }
                },
                scales: {
                    x: { grid: { color: '#333' } },
                    y: { beginAtZero: true, grid: { color: '#333' }, title: { display: true, text: 'Consumption (Mtoe)', color: '#66ccff' } }
                }
            }
        });
    }

    // --- CHART 2: VENTUS PRIMARY DEMAND REDUCTION ---
    const ctxDemand = document.getElementById('demandChart').getContext('2d');
    new Chart(ctxDemand, {
        type: 'bar',
        data: {
            labels: ['2019 Historic Demand', 'Estimated Useful Energy', 'Future Electrified Demand'],
            datasets: [{
                label: 'Energy (TWh)',
                data: [1644, 1000, 600], 
                backgroundColor: ['#2e86c1', '#f39c12', '#28b463'],
                borderWidth: 1,
                borderColor: '#111'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Primary Energy Demand Reduction (TWh)', color: '#ffffff', font: { size: 14 } },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, title: { display: true, text: 'Terawatt Hours (TWh)', color: '#66ccff' } }
            }
        }
    });

    // --- CHART 3: VENTUS PEAK LOAD CHALLENGE ---
    const ctxPeak = document.getElementById('peakChart').getContext('2d');
    new Chart(ctxPeak, {
        type: 'bar',
        data: {
            labels: ['Unmanaged Peak (Theoretical)', 'Managed Peak (After Diversity)', 'Current Grid Winter Peak'],
            datasets: [{
                label: 'Peak Load (GW)',
                data: [246, 95, 48.3],
                backgroundColor: ['#28b463', '#e67e22', '#2c3e50'],
                borderWidth: 1,
                borderColor: '#111'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'The Peak Load Challenge (GW)', color: '#ffffff', font: { size: 14 } },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, title: { display: true, text: 'Gigawatts (GW)', color: '#66ccff' } }
            }
        }
    });
</script>
