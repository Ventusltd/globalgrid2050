---
layout: page
title: UK Macro Energy Consumption and Grid Peak Trends
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

    .grid-row { display: flex; flex-wrap: wrap; gap: 20px; }
    .grid-col { flex: 1; min-width: 400px; }

    .technical-footer {
        margin-top: 30px;
        font-size: 14px;
        color: #aaaaaa;
        border-top: 1px solid #333;
        padding-top: 15px;
        line-height: 1.8;
    }
    .technical-footer a { color: #66ccff; text-decoration: none; }
</style>

<div class="dashboard-container">
    
    <div class="summary-panel">
        <h3>Historical System Load: National Fuel Transition (1990–2023)</h3>
        [span_2](start_span)<p>This dashboard aggregates Office for National Statistics (ONS) data on energy consumption across all UK economic sectors[span_2](end_span). [span_3](start_span)Values are represented in <b>Million tonnes of oil equivalent (Mtoe)</b>[span_3](end_span).</p>
    </div>

    <div class="chart-wrapper main-chart">
        <canvas id="energyChart"></canvas>
    </div>

    <div class="summary-panel">
        <h3>Engineering Study: The Peak Challenge of Electrification</h3>
        [span_4](start_span)<p>Transitioning to full electrification fundamentally alters both Primary Energy Demand and Peak Grid Load[span_4](end_span).</p>
        <ul>
            [span_5](start_span)<li><b>The Efficiency Dividend:</b> Electrification can reduce total primary energy demand by up to 70%[span_5](end_span). [span_6](start_span)Heat pumps operate at 350% to 500% efficiency (SCOP 3.5 to 5), meaning 3.5 kW of electrical input delivers ~12.25 kW of thermal output[span_6](end_span). [span_7](start_span)Electric vehicles convert 70% of energy to motion, vs. ~25% for internal combustion[span_7](end_span).</li>
            [span_8](start_span)<li><b>The Peak Load Stress Test:</b> A theoretical scenario with 28 million homes (3.5 kW heat pumps) and 20 million EVs (7.4 kW chargers) creates an unmanaged 246 GW peak[span_8](end_span). [span_9](start_span)The current UK grid is designed for a winter peak of 48.3 GW[span_9](end_span).</li>
            [span_10](start_span)<li><b>Managed Diversity:</b> Accounting for diversity (1.7 kW per home) and smart charging, the realistic managed peak is projected between 90 and 100 GW[span_10](end_span).</li>
            [span_11](start_span)<li><b>Infrastructure Resilience:</b> To prevent localized failures like the 2025 Heathrow blackout, grid design must prioritize coincident peaks and protection coordination[span_11](end_span).</li>
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
        <b>Sources:</b><br>
        1. [span_12](start_span)ONS UK Environmental Accounts: Energy Use[span_12](end_span)<br>
        2. [span_13](start_span)Ventus Ltd: The Real Peak Challenge (May 2025)[span_13](end_span)
    </div>
</div>

<script>
    const csvUrl = '{{ site.baseurl }}/ons-energy-fuels-clean.csv';
    const years = Array.from({length: 34}, (_, i) => (1990 + i).toString());

    Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: r => {
            const fuelData = {};
            r.data.forEach(row => {
                const fuel = row['ActivityName'];
                if (!fuel || fuel.includes('Total')) return;
                if (!fuelData[fuel]) fuelData[fuel] = new Array(years.length).fill(0);
                years.forEach((y, i) => {
                    let val = parseFloat(String(row[y]).replace(/,/g, ''));
                    if (!isNaN(val)) fuelData[fuel][i] += val;
                });
            });

            const topFuels = Object.keys(fuelData).sort((a,b) => 
                fuelData[b].reduce((s,v)=>s+v,0) - fuelData[a].reduce((s,v)=>s+v,0)).slice(0,7);
            
            const colors = ['#00f2ff', '#ff3366', '#ff9d00', '#33cc33', '#cc33ff', '#ffff00', '#ff6600'];

            new Chart(document.getElementById('energyChart'), {
                type: 'line',
                data: {
                    labels: years,
                    datasets: topFuels.map((f, i) => ({
                        label: f, data: fuelData[f], borderColor: colors[i],
                        backgroundColor: colors[i]+'20', fill: true, tension: 0.3
                    }))
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    });

    new Chart(document.getElementById('demandChart'), {
        type: 'bar',
        data: {
            labels: ['2019 Historic', 'Useful Energy', 'Future Electrified'],
            datasets: [{ label: 'TWh', data: [1644, 1000, 600], backgroundColor: ['#2e86c1', '#f39c12', '#28b463'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    new Chart(document.getElementById('peakChart'), {
        type: 'bar',
        data: {
            labels: ['Unmanaged', 'Managed', 'Current Peak'],
            datasets: [{ label: 'GW', data: [246, 95, 48.3], backgroundColor: ['#e74c3c', '#e67e22', '#2c3e50'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
</script>
