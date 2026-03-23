GlobalGrid2050 Map Architecture

1. The Map Frontend (repd_atlas_grid_model.md)

Built using Leaflet.js, Leaflet MarkerCluster, and Proj4js (for OSGB36 to WGS84 coordinate translation).

Reads project data from repd.csv and scales marker sizes based on MW capacity.

Uses interactive Layer Controls to overlay National Grid infrastructure (400kV, 275kV, 132kV) pulled from local GeoJSON files.

2. The Data Fetcher (scripts/fetch_grid_data.py)

A Python script that queries the OpenStreetMap Overpass API for UK power lines (power=line and power=cable).

It fetches 400kV, 275kV, and 132kV data sequentially.

Crucial: It includes 60-second time.sleep(60) pauses between requests to prevent the Overpass API from blocking our IP for rate-limiting.

3. The Automation (.github/workflows/update-grid-data.yml)

A GitHub Action set to workflow_dispatch (Manual trigger).

Spins up a virtual Ubuntu server, installs Python/Requests, runs the fetcher script, and commits any updated *.geojson files directly back to the main branch.

Committing these files automatically triggers the Jekyll build to update the live GitHub Pages site.
