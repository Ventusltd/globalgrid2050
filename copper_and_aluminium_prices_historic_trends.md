---
layout: default
title: Copper and Aluminium Historic Prices in Euro and USD per tonne and Trend Graphs
---

# Copper and Aluminium Historic Prices in Euro and USD per tonne and Trend Graphs

### Indicative annual price ranges in EUR per tonne (1000 kg)  
### For commercial budgeting, trend analysis and metal risk awareness

---

## March 2026 Price Tracker

<div style="overflow-x: auto; background-color: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #333;">
  <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 600px; color: #e0e0e0; font-family: sans-serif;">
    <thead>
      <tr style="border-bottom: 2px solid #555; background-color: #222;">
        <th style="padding: 12px;">Date</th>
        <th style="padding: 12px; color: #FF007F;">Cu (USD)</th>
        <th style="padding: 12px; color: #FF007F;">Cu (EUR)</th>
        <th style="padding: 12px; color: #00FFFF;">Al (USD)</th>
        <th style="padding: 12px; color: #00FFFF;">Al (EUR)</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #333; background-color: #121212;">
        <td style="padding: 10px;">20 March 2026</td>
        <td style="padding: 10px;">$12,850</td>
        <td style="padding: 10px;">€11,118</td>
        <td style="padding: 10px;">$3,155</td>
        <td style="padding: 10px;">€2,746</td>
      </tr>
    </tbody>
  </table>
</div>

---

## Historic Price Trends (Interactive)

<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
<div id="chartUSD" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 30px; border: 1px solid #333;"></div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const cuAvgUSD = [2200, 2100, 2000, 2200, 3100, 3900, 6600, 6000, 5500, 6000, 6000, 7500, 6800, 6000, 5700, 5500, 4700, 5700, 6400, 6300, 6000, 9000, 9200, 8500, 9600, 11500];
    const alAvgUSD = [1700, 1400, 1300, 1400, 1700, 1900, 2400, 2500, 2000, 1500, 1800, 2100, 1800, 1500, 1500, 1700, 1500, 1900, 2000, 1700, 1700, 2300, 2800, 2300, 2400, 2900];

    const layout = {
      title: 'Historic Metal Prices (USD per tonne)',
      hovermode: 'x unified',
      paper_bgcolor: '#1a1a1a', 
      plot_bgcolor: '#121212',  
      font: { color: '#e0e0e0' }, 
      xaxis: { gridcolor: '#333333', fixedrange: true }, 
      yaxis: { gridcolor: '#333333', fixedrange: true },
      legend: { x: 0.015, y: 0.98, bgcolor: 'rgba(26, 26, 26, 0.7)' }
    };

    const traces = [
      { x: years, y: cuAvgUSD, mode: 'lines+markers', line: {color: '#FF007F', width: 2}, name: 'Copper Avg' },
      { x: years, y: alAvgUSD, mode: 'lines+markers', line: {color: '#00FFFF', width: 2}, name: 'Aluminium Avg' }
    ];

    Plotly.newPlot('chartUSD', traces, layout, { responsive: true, displayModeBar: false });
  });
</script>

[...Rest of your Historic tables and Disclaimer from previous versions...]
