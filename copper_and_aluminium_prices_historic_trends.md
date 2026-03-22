## 📅 2026 Daily Price Tracker (Auto-Generated)

<div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 40px;">
  <div style="max-height: 400px; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
    <table style="width:100%; text-align: left; border-collapse: collapse; font-family: sans-serif; color: #e0e0e0; min-width: 600px;">
      <thead style="position: sticky; top: 0; background-color: #222; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
        <tr style="border-bottom: 2px solid #555;">
          <th style="padding: 12px; font-weight: bold;">Date</th>
          <th style="padding: 12px; font-weight: bold; color: #FF007F;">Cu (USD)</th>
          <th style="padding: 12px; font-weight: bold; color: #FF007F;">Cu (EUR)</th>
          <th style="padding: 12px; font-weight: bold; color: #00FFFF;">Al (USD)</th>
          <th style="padding: 12px; font-weight: bold; color: #00FFFF;">Al (EUR)</th>
        </tr>
      </thead>
      <tbody id="daily-log-body">
        <tr><td colspan="5" style="padding: 12px; text-align: center; color: #888;">Building 2026 historical log... ⏳</td></tr>
      </tbody>
    </table>
  </div>
</div>

<script>
  // The Magic: Fetch the growing array of 2026 daily prices
  fetch('2026_daily_prices.json')
    .then(response => {
      if (!response.ok) throw new Error("Daily log not found");
      return response.json();
    })
    .then(data => {
      // Sort data so the newest dates are at the top
      data.sort((a, b) => new Date(b.date) - new Date(a.date));

      const tableBody = document.getElementById('daily-log-body');
      tableBody.innerHTML = ''; // Clear the loading message

      // Loop through every day in the JSON and create a row
      data.forEach((day, index) => {
        // Alternate row colors for readability
        const bgColor = index % 2 === 0 ? '#121212' : '#1a1a1a';
        
        const row = `
          <tr style="background-color: ${bgColor}; border-bottom: 1px solid #333;">
            <td style="padding: 10px; font-size: 0.9em; color: #ccc;">${day.date}</td>
            <td style="padding: 10px; font-size: 0.95em;">$${day.cu_usd.toLocaleString()}</td>
            <td style="padding: 10px; font-size: 0.95em;">€${day.cu_eur.toLocaleString()}</td>
            <td style="padding: 10px; font-size: 0.95em;">$${day.al_usd.toLocaleString()}</td>
            <td style="padding: 10px; font-size: 0.95em;">€${day.al_eur.toLocaleString()}</td>
          </tr>
        `;
        tableBody.innerHTML += row;
      });
    })
    .catch(error => {
      document.getElementById('daily-log-body').innerHTML = `
        <tr><td colspan="5" style="padding: 12px; color: #FF007F; text-align: center;">⚠️ 2026 Daily log initializing. Awaiting first data pull.</td></tr>
      `;
      console.error("Error fetching daily log:", error);
    });
</script>
