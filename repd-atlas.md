<div class="controls">
    <div style="display:flex; flex-direction:column; gap:5px;">
        <label style="font-size:12px; color:#aaa;">TECHNOLOGY BIOME:</label>
        <select id="techFilter">
            <option value="ALL">All Systems</option>
            <option value="Solar Photovoltaics">Solar Only</option>
            <option value="Battery">Battery/Storage Only</option>
            <option value="Wind">Wind Only</option>
        </select>
    </div>
    <div style="display:flex; flex-direction:column; gap:5px;">
        <label style="font-size:12px; color:#aaa;">STATUS FILTER:</label>
        <select id="statusFilter">
            <option value="ALL">All Statuses</option>
            <option value="Operational">Operational Only</option>
            <option value="Planning">Planning/Construction</option>
        </select>
    </div>
    <div style="display:flex; flex-direction:column; gap:5px;">
        <label style="font-size:12px; color:#aaa;">RAW DATA:</label>
        <a href="https://assets.publishing.service.gov.uk/media/6985c316d3f57710b50a9b1f/REPD_Publication_Q4_2025.csv" 
           style="text-decoration:none;">
           <button type="button" style="background:#00f2ff; color:#000; font-weight:bold; border:none; padding:10px 15px; border-radius:6px; cursor:pointer;">
             📥 DOWNLOAD SOURCE CSV
           </button>
        </a>
    </div>
    <div id="legend-box" class="legend"></div>
</div>
