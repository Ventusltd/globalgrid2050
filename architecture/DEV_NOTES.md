23 March 2026 - Development Notes & Map Architecture Summary

Today marked a massive leap forward in building the GlobalGrid2050 interactive dashboard. We successfully transformed a static REPD (Renewable Energy Planning Database) cluster map into a fully integrated, multi-layered visualization of the UK’s high-voltage electrical infrastructure. By combining crowdsourced OpenStreetMap data with automated Python scripts and GitHub Actions, we engineered a completely free, enterprise-grade mapping tool directly within the browser.

Here is a comprehensive breakdown of the core processes and the specific milestones we achieved today:

1. The Frontend UI and Map Engine
The core of the dashboard is powered by Leaflet.js, utilizing the MarkerCluster plugin to manage the heavy computational load of thousands of UK energy projects without crashing the user's browser. We upgraded the map to a sleek, dark-mode aesthetic, allowing the vibrant grid lines and project nodes to stand out clearly.

Crucially, we implemented an interactive Layer Control panel in the top right corner. Instead of forcing a static view, users can now toggle specific grid layers—400kV, 275kV, and 132kV—on and off at will. This keeps the interface clean and prevents visual overload, especially when viewing the incredibly dense 132kV distribution networks. We also ensured our coordinate translation engine (Proj4js) was accurately mapping the REPD’s OSGB36 coordinates onto Leaflet’s standard WGS84 projection.

2. Automated Data Sourcing via Overpass API
To accurately map the physical lines of the UK's power grid, we developed a Python script (fetch_grid_data.py) that queries the OpenStreetMap Overpass API. We designed the script to specifically hunt for power lines and cables tagged with exact voltages (132000, 275000, and 400000) contained strictly within the UK boundary.

A major breakthrough today was implementing robust API rate-limit protections. Because querying the entire UK grid is incredibly resource-intensive, we integrated time.sleep(60) commands between each individual voltage fetch. This forces the script to pause for exactly one minute between pulling the different layers, successfully preventing the Overpass servers from blocking our IP address. The script then parses the geometry and saves it locally as distinct, lightweight .geojson files.

3. CI/CD Pipeline and GitHub Actions Integration
We established a seamless, automated pipeline using GitHub Actions (update-grid-data.yml). Configured with a workflow_dispatch trigger, this automation allows us to manually spin up a virtual Ubuntu server on demand. The server automatically installs Python, runs our fetcher script, and—most importantly—uses a wildcard git add *.geojson || true command to safely scoop up all the newly generated grid layers. It then commits and pushes these files directly back to the main branch, which immediately triggers a background Jekyll build to update the live GitHub Pages site.

4. Overcoming Technical Hurdles
We successfully navigated a few stubborn technical hurdles today. First, we aligned the map's visual identity with the official National Grid color standards: Blue for 400kV, Red for 275kV, and Green for 132kV. Second, we tackled aggressive browser caching. We proved that GitHub Pages and local browsers will stubbornly hold onto old code, requiring hard refreshes or Incognito windows to accurately view our live deployments.

In summary, we built a highly automated, self-updating, and visually accurate interactive energy map. The foundation is now rock-solid and fully documented, setting the perfect stage for our next addition: mapping the HVDC subsea interconnectors.
