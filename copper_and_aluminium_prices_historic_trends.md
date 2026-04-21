---
layout: page
title: Copper and Aluminium Historic Prices & Trends
permalink: /copper_and_aluminium_prices_historic_trends/
---

# Copper and Aluminium Historic Prices in Euro and USD per tonne and Trend Graphs

### Indicative annual price ranges in EUR per tonne (1000 kg)  
### For commercial budgeting, trend analysis and metal risk awareness

---

## Historic Price Trends (Interactive)

<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<div id="chartUSD" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 30px; border: 1px solid #333;"></div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

    const cuAvg = [2200, 2100, 2000, 2200, 3100, 3900, 6600, 6000, 5500, 6000, 6000, 7500, 6800, 6000, 5700, 5500, 4700, 5700, 6400, 6300, 6000, 9000, 9200, 8500, 9600, 11500];
    const cuLow = [1900, 1800, 1700, 1800, 2200, 2800, 3900, 5000, 3300, 4400, 5000, 6500, 6000, 5500, 5300, 5000, 4200, 5000, 5500, 5700, 4900, 7100, 7600, 7800, 8200, 9600];
    const cuHigh = [2800, 2500, 2400, 2800, 4200, 5500, 9900, 8300, 8800, 7100, 8300, 10500, 8800, 8100, 7600, 6600, 5500, 6800, 7800, 7100, 7600, 10600, 11400, 9600, 11100, 13200];
    
    const alAvg = [1700, 1400, 1300, 1400, 1700, 1900, 2400, 2500, 2000, 1500, 1800, 2100, 1800, 1500, 1500, 1700, 1500, 1900, 2000, 1700, 1700, 2300, 2800, 2300, 2400, 2900];
    const alLow = [1400, 1300, 1200, 1200, 1300, 1600, 2000, 2200, 1400, 1300, 1600, 2000, 1700, 1400, 1400, 1500, 1400, 1800, 1900, 1600, 1400, 2100, 2400, 2100, 2200, 2500];
    const alHigh = [2000, 1800, 1700, 1800, 2100, 2400, 3000, 3100, 3300, 2000, 2600, 3100, 2300, 2100, 2100, 2000, 1900, 2200, 2400, 2100, 2000, 3100, 4100, 2600, 2900, 3700];

    const traces = [
      { x: years, y: cuHigh, type: 'scatter', mode: 'lines', line: {width: 0}, hoverinfo: 'skip', showlegend: false },
      { x: years, y: cuLow, type: 'scatter', mode: 'lines', fill: 'tonexty', fillcolor: 'rgba(255, 0, 127, 0.15)', line: {width: 0}, name: 'Copper Range' },
      { x: years, y: cuAvg, type: 'scatter', mode: 'lines+markers', line: {color: '#FF007F', width: 2.5}, marker: {size: 6}, name: 'Copper Avg' },
      
      { x: years, y: alHigh, type: 'scatter', mode: 'lines', line: {width: 0}, hoverinfo: 'skip', showlegend: false },
      { x: years, y: alLow, type: 'scatter', mode: 'lines', fill: 'tonexty', fillcolor: 'rgba(0, 255, 255, 0.15)', line: {width: 0}, name: 'Aluminium Range' },
      { x: years, y: alAvg, type: 'scatter', mode: 'lines+markers', line: {color: '#00FFFF', width: 2.5}, marker: {size: 6}, name: 'Aluminium Avg' }
    ];

    const layout = {
      title: 'Historic Metal Prices (USD per tonne)',
      hovermode: 'x unified',
      paper_bgcolor: '#1a1a1a', 
      plot_bgcolor: '#121212',  
      font: { color: '#e0e0e0' }, 
      xaxis: { gridcolor: '#333', fixedrange: true }, 
      yaxis: { gridcolor: '#333', fixedrange: true },
      showlegend: true,
      legend: { x: 0.015, y: 0.98, xanchor: 'left', yanchor: 'top', bgcolor: 'rgba(26, 26, 26, 0.8)' }
    };

    Plotly.newPlot('chartUSD', traces, layout, { responsive: true, displayModeBar: false });
  });
</script>

---

## Market Context

2026 represents a historic high pricing regime for base metals, with copper exceeding €11,000 per tonne in sustained trading and reaching above €12,000 per tonne equivalent at peak levels, based on London Metal Exchange pricing.

Aluminium has also approached multi year highs, trading in the range of €2,600 to €3,000 per tonne with spikes above €3,000 during supply disruptions.

---

### Live LME Market Prices
For up-to-the-minute pricing, please refer to the official London Metal Exchange (LME) live data:
* **[Live LME Copper Prices](https://www.lme.com/metals/non-ferrous/lme-copper#Overview)**
* **[Live LME Aluminium Prices](https://www.lme.com/metals/non-ferrous/lme-aluminium#Overview)**

---

### Live Daily Market Prices (API Sync)
*Last Sync: Tuesday 21 April 2026 08:01 UTC*

| Metal | Live USD per tonne | Live EUR per tonne | Live GBP per tonne |
|:---|---:|---:|---:|
| **Copper** | $13,320 | €11,311 | £9,847 |
| **Aluminium** | $3,478 | €2,953 | £2,571 |

---

## Historic Metal Prices with Risk Range (USD per tonne)

| Year | Cu Low | Cu Avg | Cu High | Al Low | Al Avg | Al High |
|:---|---:|---:|---:|---:|---:|---:|
| 2025 | 9,600 | 11,500 | 13,200 | 2,500 | 2,900 | 3,700 |
| 2024 | 8,200 | 9,600 | 11,100 | 2,200 | 2,400 | 2,900 |
| 2023 | 7,800 | 8,500 | 9,600 | 2,100 | 2,300 | 2,600 |
| 2022 | 7,600 | 9,200 | 11,400 | 2,400 | 2,800 | 4,100 |
| 2021 | 7,100 | 9,000 | 10,600 | 2,100 | 2,300 | 3,100 |
| 2020 | 4,900 | 6,000 | 7,600 | 1,400 | 1,700 | 2,000 |
| 2019 | 5,700 | 6,300 | 7,100 | 1,600 | 1,700 | 2,100 |
| 2018 | 5,500 | 6,400 | 7,800 | 1,900 | 2,000 | 2,400 |
| 2017 | 5,000 | 5,700 | 6,800 | 1,800 | 1,900 | 2,200 |
| 2016 | 4,200 | 4,700 | 5,500 | 1,400 | 1,500 | 1900 |
| 2015 | 5,000 | 5,500 | 6,600 | 1,500 | 1,700 | 2,000 |
| 2014 | 5,300 | 5,700 | 7,600 | 1,400 | 1,500 | 2,100 |
| 2013 | 5,500 | 6,000 | 8,100 | 1,400 | 1,500 | 2,100 |
| 2012 | 6,000 | 6,800 | 8,800 | 1,700 | 1,800 | 2,300 |
| 2011 | 6,500 | 7,500 | 10,500 | 2,000 | 2,100 | 3,100 |
| 2010 | 5,000 | 6,000 | 8,300 | 1,600 | 1,800 | 2,600 |
| 2009 | 4,400 | 6,000 | 7,100 | 1,300 | 1,500 | 2,000 |
| 2008 | 3,300 | 5,500 | 8,800 | 1,400 | 2,000 | 3,300 |
| 2007 | 5,000 | 6,000 | 8,300 | 2,200 | 2,500 | 3,100 |
| 2006 | 3,900 | 6,600 | 9,900 | 2,000 | 2,400 | 3,000 |
| 2005 | 2,800 | 3,900 | 5,500 | 1,600 | 1,900 | 2,400 |
| 2004 | 2,200 | 3,100 | 4,200 | 1,300 | 1,700 | 2,100 |
| 2003 | 1,800 | 2200 | 2,800 | 1,200 | 1,400 | 1,800 |
| 2002 | 1,700 | 2,000 | 2,400 | 1,200 | 1,300 | 1,700 |
| 2001 | 1,800 | 2,100 | 2,500 | 1,300 | 1,400 | 1,800 |
| 2000 | 1,900 | 2,200 | 2,800 | 1,400 | 1,700 | 2,000 |
