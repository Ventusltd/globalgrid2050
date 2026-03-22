## Historic Price Trends (Interactive)

<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<div id="chartUSD" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 30px; overflow: hidden;"></div>
<div id="chartEUR" style="width: 100%; height: 450px; background-color: #1a1a1a; border-radius: 8px; margin-bottom: 40px; overflow: hidden;"></div>

<script>
  // 1. Define the Shared X-Axis (Years from 2000 to 2025)
  const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  // 2. Define USD Data Arrays
  const cuAvgUSD = [2200, 2100, 2000, 2200, 3100, 3900, 6600, 6000, 5500, 6000, 6000, 7500, 6800, 6000, 5700, 5500, 4700, 5700, 6400, 6300, 6000, 9000, 9200, 8500, 9600, 11500];
  const cuLowUSD = [1900, 1800, 1700, 1800, 2200, 2800, 3900, 5000, 3300, 4400, 5000, 6500, 6000, 5500, 5300, 5000, 4200, 5000, 5500, 5700, 4900, 7100, 7600, 7800, 8200, 9600];
  const cuHighUSD = [2800, 2500, 2400, 2800, 4200, 5500, 9900, 8300, 8800, 7100, 8300, 10500, 8800, 8100, 7600, 6600, 5500, 6800, 7800, 7100, 7600, 10600, 11400, 9600, 11100, 13200];
  
  const alAvgUSD = [1700, 1400, 1300, 1400, 1700, 1900, 2400, 2500, 2000, 1500, 1800, 2100, 1800, 1500, 1500, 1700, 1500, 1900, 2000, 1700, 1700, 2300, 2800, 2300, 2400, 2900];
  const alLowUSD = [1400, 1300, 1200, 1200, 1300, 1600, 2000, 2200, 1400, 1300, 1600, 2000, 1700, 1400, 1400, 1500, 1400, 1800, 1900, 1600, 1400, 2100, 2400, 2100, 2200, 2500];
  const alHighUSD = [2000, 1800, 1700, 1800, 2100, 2400, 3000, 3100, 3300, 2000, 2600, 3100, 2300, 2100, 2100, 2000, 1900, 2200, 2400, 2100, 2000, 3100, 4100, 2600, 2900, 3700];

  // 3. Define EUR Data Arrays
  const cuAvgEUR = [2000, 1900, 1800, 2000, 2800, 3500, 6000, 5500, 5000, 5500, 5500, 6800, 6200, 5500, 5200, 5000, 4300, 5200, 5900, 5800, 5500, 8300, 8500, 7800, 8800, 10500];
  const cuLowEUR = [1700, 1600, 1500, 1600, 2000, 2500, 3500, 4500, 3000, 4000, 4500, 6000, 5500, 5000, 4800, 4500, 3800, 4500, 5000, 5200, 4500, 6500, 7000, 7200, 7500, 8800];
  const cuHighEUR = [2500, 2300, 2200, 2500, 3800, 5000, 9000, 7500, 8000, 6500, 7500, 9500, 8000, 7500, 7000, 6000, 5000, 6200, 7200, 6500, 7000, 9800, 10500, 8800, 10200, 12000];

  // 4. Helper function to create trace objects (Neon Colors)
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

  // 5. Layout configs (Dark Theme, Max Space, Legend Top-Left)
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
      x: 0.015,
      y: 0.98,
      xanchor: 'left',
      yanchor: 'top',
      bgcolor: 'rgba(26, 26, 26, 0.7)',
      bordercolor: '#444444',
      borderwidth: 1,
      font: { color: '#e0e0e0' }
    }
  };

  const layoutUSD = Object.assign({ title: 'Historic Metal Prices (USD per tonne)' }, layoutBase);
  const layoutEUR = Object.assign({ title: 'Historic Metal Prices (EUR per tonne)' }, layoutBase);

  // 6. Config to kill the clutter!
  const config = { responsive: true, displayModeBar: false };

  // 7. Draw the charts!
  Plotly.newPlot('chartUSD', createTraces(cuAvgUSD, cuLowUSD, cuHighUSD, alAvgUSD, alLowUSD, alHighUSD), layoutUSD, config);
  Plotly.newPlot('chartEUR', createTraces(cuAvgEUR, cuLowEUR, cuHighEUR, alAvgEUR, alLowEUR, alHighEUR), layoutEUR, config);
</script>
