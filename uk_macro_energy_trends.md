---
layout: page
title: UK Macro Energy Consumption Trends (1990-2023)
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
    
    /* Professional Chart Viewport */
    .chart-wrapper {
        background: #0b0e14;
        border: 3px solid #2a2f3a;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        position: relative;
        height: 60vh;
        min-height: 500px;
    }

    /* Executive Summary Panel */
    .summary-panel {
        background: #111;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: #ddd;
        line-height: 1.6;
    }
    
    .summary-panel h3 { color: #66ccff; margin-top: 0; }
</style>

<div class="dashboard-container">
    
    <div class="summary-panel">
        <h3>System Load: National Fuel Transition</h3>
        <p>This macro-economic dashboard aggregates the Office for National Statistics (ONS) data on energy consumption across all UK economic sectors. Values are represented in <b>Million tonnes of oil equivalent (Mtoe)</b>.</p>
        <p><i>Note: Click on the legend items below the chart to isolate specific fuel types (e.g., Coal vs. Renewable electricity).</i></p>
    </div>

    <div class="chart-wrapper">
        <canvas id="energyChart"></canvas>
    </div>

</div>

<script>
    const csvUrl = '{{ site.baseurl }}/ons-energy-fuels.csv';

    // Generate Years Array (1990 to 2023)
    const years = [];
    for (let y = 1990; y <= 2023; y++) {
        years.push(y.toString());
    }

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            processData(results.data);
        }
    });

    function processData(data) {
        const fuelData = {};

        // Aggregate data by ActivityName (Fuel Type)
        data.forEach(row => {
            const fuelType = row['ActivityName'];
            if (!fuelType || fuelType === 'Total' || fuelType === 'Not elsewhere classified') return;

            if (!fuelData[fuelType]) {
                fuelData[fuelType] = new Array(years.length).fill(0);
            }

            years.forEach((year, index) => {
                const value = parseFloat(row[year]);
                if (!isNaN(value)) {
                    fuelData[fuelType][index] += value;
                }
            });
        });

        // Sort fuels by total historical volume to find the top drivers
        const sortedFuels = Object.keys(fuelData).sort((a, b) => {
            const sumA = fuelData[a].reduce((acc, val) => acc + val, 0);
            const sumB = fuelData[b].reduce((acc, val) => acc + val, 0);
            return sumB - sumA; 
        });

        // Select the Top 7 Energy Sources for clarity
        const topFuels = sortedFuels.slice(0, 7);

        // Technical Color Palette (Neon/Dark Theme)
        const colors = [
            '#00f2ff', // Cyan
            '#ff3366', // Neon Pink (Often Coal/Gas dropoff)
            '#ff9d00', // Amber
            '#33cc33', // Green
            '#cc33ff', // Purple
            '#ffff00', // Yellow
            '#ff6600'  // Orange
        ];

        const datasets = topFuels.map((fuel, index) => {
            return {
                label: fuel,
                data: fuelData[fuel],
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20', // 20 = hex transparency
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3 // Smooth curves
            };
        });

        renderChart(datasets);
    }

    function renderChart(datasets) {
        const ctx = document.getElementById('energyChart').getContext('2d');
        
        // Ensure chart text is readable on dark background
        Chart.defaults.color = '#aaaaaa';
        Chart.defaults.font.family = "'Courier New', Courier, monospace";

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'UK Energy Consumption by Primary Fuel Types (1990 - 2023)',
                        color: '#ffffff',
                        font: { size: 16 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#66ccff',
                        bodyColor: '#ffffff',
                        borderColor: '#444',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#333' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#333' },
                        title: {
                            display: true,
                            text: 'Consumption (Mtoe)',
                            color: '#66ccff'
                        }
                    }
                }
            }
        });
    }
</script>

