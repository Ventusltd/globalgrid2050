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
        <p>This macro-economic dashboard aggregates the Office for National Statistics (ONS) data on energy consumption across all UK economic sectors. Values are represented in <b>Million tonnes of oil equivalent (Mtoe)</b>. <i>Click on legend items below the chart to isolate specific fuel types.</i></p>
    </div>

    <div class="chart-wrapper main-chart">
        <canvas id="energyChart"></canvas>
    </div>

    <div class="summary-panel" style="margin-top: 40px;">
        <h3>Engineering Study: The Real Peak Challenge of Electrifying Heat and Transport</h3>
        <p>While the historical ONS data above tracks the decline of coal and the plateau of gas, the transition to full electrification radically alters both <b>Primary Energy Demand</b> and <b>Peak Grid Load</b>.</p>
        <ul>
            [span_3](start_span)<li><b>The Efficiency Dividend:</b> Electrification can reduce the UK's total primary energy demand by up to 70 percent[span_3](end_span). [span_4](start_span)[span_5](start_span)Heat pumps operate at 350% to 500% efficiency (SCOP 3.5 to 5), requiring roughly 3.5 kW of electrical input to deliver 12.25 kW of thermal output[span_4](end_span)[span_5](end_span). [span_6](start_span)Similarly, electric vehicles convert 70% of energy to motion, compared to roughly 25% for internal combustion engines[span_6](end_span).</li>
            [span_7](start_span)<li><b>The Peak Load Stress Test:</b> A theoretical scenario where 28 million homes draw 3.5 kW for heat pumps simultaneously, alongside 20 million EVs charging at 7.4 kW, would create an unmanaged 246 GW peak demand spike[span_7](end_span). [span_8](start_span)The current UK grid is designed to meet a winter peak of 48.3 GW[span_8](end_span).</li>
            [span_9](start_span)[span_10](start_span)<li><b>Managed Diversity:</b> Accounting for load diversity (approx. 1.7 kW per home) and smart EV charging, the realistic managed peak load ceiling is projected between 90 and 100 GW[span_9](end_span)[span_10](end_span).</li>
            [span_11](start_span)[span_12](start_span)<li><b>Infrastructure Resilience:</b> To prevent localized failures (such as the 2025 Heathrow Airport substation blackout), grid operators must rigorously design for coincident peaks, implementing advanced protection coordination, relay settings, and insulation coordination[span_11](end_span)[span_12](end_span).</li>
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

    <div class="technical-footer">
        <b>Sources & Technical Documentation:</b><br>
        <a href="https://www.ons.gov.uk/economy/environmentalaccounts/datasets/ukenvironmentalaccountsenergyusebyindustrysourceandfuel" target="_blank">1. Office for National Statistics (ONS) - UK Environmental Accounts: Energy Use by Industry, Source and Fuel</a><br>
        <a href="https://www.ventusltd.com/post/the-real-peak-challenge-of-electrifying-heat-and-transport-in-the-uk" target="_blank">2. Ventus Ltd: The Real Peak Challenge of Electrifying Heat and Transport (May 2025)</a>
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
                data: [1644, 1000, 600], // Extracted from Ventus report data (1,644 TWh dropping to 500-700 TWh)
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
            labels: ['Unmanaged Peak (100% Coincident)', 'Managed Peak (After Diversity)', 'Current Grid Winter Peak'],
            datasets: [{
                label: 'Peak Load (GW)',
                data: [246, 95, 48.3], // Extracted from Ventus report (246 GW theoretical, 90-100GW ceiling, 48.3GW current)
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
