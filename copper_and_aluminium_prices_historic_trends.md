---
layout: default
title: Copper and Aluminium Historic Prices in Euro and USD per tonne and Trend Graphs
---

# Copper and Aluminium Historic Prices in Euro and USD per tonne and Trend Graphs
## Report Date: 20th March 2026

### Indicative annual price ranges in EUR per tonne (1000 kg)  
### For commercial budgeting, trend analysis and metal risk awareness

---

## 📅 2026 Daily Price Tracker (Auto-Generated)

<div style="overflow-x: auto; background-color: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #333;">
  <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 500px; color: #e0e0e0; font-family: sans-serif;">
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
      </tbody>
  </table>
</div>

---

## Historic Price Trends (Interactive)

<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<div id="chartUSD" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 30px; border: 1px solid #333;"></div>
<div id="chartEUR" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 40px; border: 1px solid #333;"></div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

    const cuAvgUSD = [2200, 2100, 2000, 2200, 3100, 3900, 6600, 6000, 5500, 6000, 6000, 7500, 6800, 6000, 5700, 5500, 4700, 5700, 6400, 6300, 6000, 9000, 9200, 8500, 9600, 11500];
    const cuLowUSD = [1900, 1800, 1700, 1800, 2200, 2800, 3900, 5000, 3300, 4400, 5000, 6500, 6000, 5500, 5300, 5000, 4200, 5000, 5500, 5700, 4900, 7100, 7600, 7800, 8200, 9600];
    const cuHighUSD = [2800, 2500, 2400, 2800, 4200, 5500, 9900, 8300, 8800, 7100, 8300, 10500, 8800, 8100, 7600, 6600, 5500, 6800, 7800, 7100, 7600, 10600, 11400, 9600, 11100, 13200];
    
    const alAvgUSD = [1700, 1400, 1300, 1400, 1700, 1900, 2400, 2500, 2000, 1500, 1800, 2100, 1800, 1500, 1500, 1700, 1500, 1900, 2000, 1700, 1700, 2300, 2800, 2300, 2400, 2900];
    const alLowUSD = [1400, 1300, 1200, 1200, 1300, 1600, 2000, 2200, 1400, 1300, 1600, 2000, 1700, 1400, 1400, 1500, 1400, 1800, 1900, 1600, 1400, 2100, 2400, 2100, 2200, 2500];
    const alHighUSD = [2000, 1800, 1700, 1800, 2100, 2400, 3000, 3100, 3300, 2000, 2600, 3100, 2300, 2100, 2100, 2000, 1900, 2200, 2400, 2100, 2000, 3100, 4100, 2600, 2900, 3700];

    const cuAvgEUR = [2000, 1900, 1800, 2000, 2800, 3500, 6000, 5500, 5000, 5500, 5500, 6800, 6200, 5500, 5200, 5000, 4300, 5200, 5900, 5800, 5500, 8300, 8500, 7800, 8800, 10500];
    const cuLowEUR = [1700, 1600, 1500, 1600, 2000, 2500, 3500, 4500, 3000, 4000, 4500, 6000, 5500, 5000, 4800, 4500, 3800, 4500, 5000, 5200, 4500, 6500, 7000, 7200, 7500, 8800];
    const cuHighEUR = [2500, 2300, 2200, 2500, 3800, 5000, 9000, 7500, 8000, 6500, 7500, 9500, 8000, 7500, 7000, 6000, 5000, 6200, 7200, 6500, 7000, 9800, 10500, 8800, 10200, 12000];

    function createTraces(cuAvg, cuLow, cuHigh, alAvg, alLow, alHigh) {
      return [
        { x: years, y: cuHigh, type: 'scatter', mode: 'lines', line: {width: 0}, hoverinfo: 'skip', showlegend: false },
        { x: years, y: cuLow, type: 'scatter', mode: 'lines', fill: 'tonexty', fillcolor: 'rgba(255, 0, 127, 0.2)', line: {width: 0}, name: 'Copper Range' },
        { x: years, y: cuAvg, type: 'scatter', mode: 'lines+markers', line: {color: '#FF007F', width: 2}, marker: {color: '#FF007F', size: 6}, name: 'Copper Avg' },
        { x: years, y: alHigh, type: 'scatter', mode: 'lines', line: {width: 0}, hoverinfo: 'skip', showlegend: false },
        { x: years, y: alLow, type: 'scatter', mode: 'lines', fill: 'tonexty', fillcolor: 'rgba(0, 255, 255, 0.2)', line: {width: 0}, name: 'Aluminium Range' },
        { x: years, y: alAvg, type: 'scatter', mode: 'lines+markers', line: {color: '#00FFFF', width: 2}, marker: {color: '#00FFFF', size: 6}, name: 'Aluminium Avg' }
      ];
    }

    const layoutBase = {
      hovermode: 'x unified',
      autosize: true, 
      margin: {l: 50, r: 20, t: 50, b: 40}, 
      paper_bgcolor: '#1a1a1a', 
      plot_bgcolor: '#121212',  
      font: { color: '#e0e0e0' }, 
      xaxis: { gridcolor: '#333333', zerolinecolor: '#444444', fixedrange: true }, 
      yaxis: { gridcolor: '#333333', zerolinecolor: '#444444', fixedrange: true },
      showlegend: true,
      legend: {
        x: 0.015, y: 0.98, xanchor: 'left', yanchor: 'top',
        bgcolor: 'rgba(26, 26, 26, 0.7)', bordercolor: '#444444', borderwidth: 1, font: { color: '#e0e0e0' }
      }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot('chartUSD', createTraces(cuAvgUSD, cuLowUSD, cuHighUSD, alAvgUSD, alLowUSD, alHighUSD), Object.assign({ title: 'Historic Metal Prices (USD per tonne)' }, layoutBase), config);
    Plotly.newPlot('chartEUR', createTraces(cuAvgEUR, cuLowEUR, cuHighEUR, alAvgEUR, alLowEUR, alHighEUR), Object.assign({ title: 'Historic Metal Prices (EUR per tonne)' }, layoutBase), config);
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

### Indicative Market Prices

| Metal | USD per tonne | EUR per tonne |
|:---|---:|---:|
| Copper | $11,800 – $13,200 | €10,200 – €11,400 |
| Aluminium | $3,000 – $3,500 | €2,600 – €3,000 |

---

### March 2026 Estimate

| Metal | USD per tonne | EUR per tonne |
|:---|---:|---:|
| Copper | $12,850 | €11,118 |
| Aluminium | $3,520 | €3,046 |

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
| 2016 | 4,200 | 4,700 | 5,500 | 1,400 | 1,500 | 1,900 |
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
| 2003 | 1,800 | 2,200 | 2,800 | 1,200 | 1,400 | 1,800 |
| 2002 | 1,700 | 2,000 | 2,400 | 1,200 | 1,300 | 1,700 |
| 2001 | 1,800 | 2,100 | 2,500 | 1,300 | 1,400 | 1,800 |
| 2000 | 1,900 | 2,200 | 2,800 | 1,400 | 1,700 | 2,000 |

---

## Historic Metal Prices with Risk Range (EUR per tonne)

| Year | Cu Low | Cu Avg | Cu High | Al Low | Al Avg | Al High |
|:---|---:|---:|---:|---:|---:|---:|
| 2025 | 8,800 | 10,500 | 12,000 | 2,300 | 2,600 | 3,300 |
| 2024 | 7,500 | 8,800 | 10,200 | 2,000 | 2,200 | 2,600 |
| 2023 | 7,200 | 7,800 | 8,800 | 1,900 | 2,100 | 2,400 |
| 2022 | 7,000 | 8,500 | 10,500 | 2,200 | 2,600 | 3,800 |
| 2021 | 6,500 | 8,300 | 9,800 | 1,900 | 2,100 | 2,800 |
| 2020 | 4,500 | 5,500 | 7,000 | 1,300 | 1,500 | 1,800 |
| 2019 | 5,200 | 5,800 | 6,500 | 1,500 | 1,600 | 1,900 |
| 2018 | 5,000 | 5,900 | 7,200 | 1,700 | 1,800 | 2,200 |
| 2017 | 4,500 | 5,200 | 6,200 | 1,600 | 1,700 | 2,000 |
| 2016 | 3,800 | 4,300 | 5,000 | 1,300 | 1,400 | 1,700 |
| 2015 | 4,500 | 5,000 | 6,000 | 1,400 | 1,500 | 1,800 |
| 2014 | 4,800 | 5,200 | 7,000 | 1,300 | 1,400 | 1,900 |
| 2013 | 5,000 | 5,500 | 7,500 | 1,300 | 1,400 | 1,900 |
| 2012 | 5,500 | 6,200 | 8,000 | 1,500 | 1,600 | 2,100 |
| 2011 | 6,000 | 6,800 | 9,500 | 1,800 | 1,900 | 2,800 |
| 2010 | 4,500 | 5,500 | 7,500 | 1,400 | 1,600 | 2,300 |
| 2009 | 4,000 | 5,500 | 6,500 | 1,200 | 1,400 | 1,800 |
| 2008 | 3,000 | 5,000 | 8,000 | 1,300 | 1,800 | 3,000 |
| 2007 | 4,500 | 5,500 | 7,500 | 2,000 | 2,300 | 2,800 |
| 2006 | 3,500 | 6,000 | 9,000 | 1,800 | 2,200 | 2,700 |
| 2005 | 2,500 | 3,500 | 5,000 | 1,400 | 1,700 | 2,200 |
| 2004 | 2,000 | 2,800 | 3,800 | 1,200 | 1,500 | 1,900 |
| 2003 | 1,600 | 2,000 | 2,500 | 1,100 | 1,300 | 1,600 |
| 2002 | 1,500 | 1,800 | 2,200 | 1,100 | 1,200 | 1,500 |
| 2001 | 1,600 | 1,900 | 2,300 | 1,200 | 1,300 | 1,600 |
| 2000 | 1,700 | 2,000 | 2,500 | 1,300 | 1,500 | 1,800 |

---

## Commercial Interpretation

- Copper has increased from approximately €2,000 per tonne in the early 2000s to above €10,000 per tonne in the mid 2020s.  
- Aluminium shows lower structural growth but remains strongly linked to global energy prices.  
- Key volatility and procurement risk periods include 2008, 2009, 2022 and 2025 to 2026.  

---

## Disclaimer

These figures are indicative annual ranges for budgeting and commercial reference only.  
Validate prices against the London Metal Exchange or equivalent sources prior to relying on the data.  
No liability is accepted for any errors, omissions or reliance placed on this information.  
Real contract pricing depends on timing, specification, manufacturing route, currency, logistics, project conditions and supplier negotiation.
