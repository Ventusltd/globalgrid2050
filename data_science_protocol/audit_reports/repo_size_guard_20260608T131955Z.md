# GlobalGrid2050 Repository Size Guard

Generated UTC: `2026-06-08T13:19:55Z`
Repository: `Ventusltd/globalgrid2050`
Branch: `main`
Git head: `da888c4d`
Mode: `audit only`
Scan scope: `all`
Base ref: `origin/main`

## Executive summary

Repository size guard ran in audit only mode with all scan scope. Warn threshold 5.0 MiB. Fail threshold 25.0 MiB. Hard threshold 100.0 MiB. Found 21 warning files and 3 fail threshold files.

## Files requiring review

| Path | MiB | Risk | Kind |
| --- | --- | --- | --- |
| uk_primary_roads.geojson | 76.016 | fail | gis geometry |
| uk_trunk_roads.geojson | 64.4 | fail | gis geometry |
| uk_mainline_railways.geojson | 52.503 | fail | gis geometry |
| data/electricity/elexon_system_prices_half_hourly.csv | 19.101 | warn | data |
| data/generation/elexon_generation_sources_2026.csv | 17.65 | warn | data |
| data/generation/elexon_generation_sources_half_hourly.csv | 17.65 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-10.csv | 16.368 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-12.csv | 16.321 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-11.csv | 15.792 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-07.csv | 15.497 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-08.csv | 15.483 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-09.csv | 15.463 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-05.csv | 15.459 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-03.csv | 15.435 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-06.csv | 14.975 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-04.csv | 14.959 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-01.csv | 14.7 | warn | data |
| data/generation/archive/2021/elexon_generation_sources_2021-02.csv | 13.987 | warn | data |
| uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json | 13.388 | warn | repository file |
| uk_motorways.geojson | 10.958 | warn | gis geometry |
| global_ports.geojson | 9.784 | warn | gis geometry |
| repd_grid_atlasv6/data/global_ports.geojson | 9.715 | warn | gis geometry |
| repd_grid_atlasv7/data/global_ports.geojson | 9.715 | warn | gis geometry |
| repd_grid_atlasv8/data/global_ports.geojson | 9.715 | warn | gis geometry |
| uk_metros_trams.geojson | 4.48 | pass | gis geometry |
| eurostar.geojson | 4.062 | pass | gis geometry |
| repd_grid_atlasv6/data/eurostar.geojson | 4.062 | pass | gis geometry |
| repd_grid_atlasv7/data/eurostar.geojson | 4.062 | pass | gis geometry |
| repd_grid_atlasv8/data/eurostar.geojson | 4.062 | pass | gis geometry |
| grid_132kv.geojson | 3.252 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_132kv.geojson | 3.252 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_132kv.geojson | 3.252 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_132kv.geojson | 3.252 | pass | gis geometry |
| repd_grid_atlasv6/data/subsea_data_cables.geojson | 3.191 | pass | gis geometry |
| repd_grid_atlasv7/data/subsea_data_cables.geojson | 3.191 | pass | gis geometry |
| repd_grid_atlasv8/data/subsea_data_cables.geojson | 3.191 | pass | gis geometry |
| subsea_data_cables.geojson | 3.191 | pass | gis geometry |
| grid_11kv_ukpn.geojson | 2.981 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_11kv_ukpn.geojson | 2.981 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_11kv_ukpn.geojson | 2.981 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_11kv_ukpn.geojson | 2.981 | pass | gis geometry |
| uk_energy_tracking_v6/oil_price_history.geojson | 1.752 | pass | gis geometry |
| uk_energy_tracking_v5/oil_price_history.geojson | 1.752 | pass | gis geometry |
| uk_energy_tracking/oil_price_history.geojson | 1.752 | pass | gis geometry |
| grid_substations.geojson | 1.738 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_substations.geojson | 1.738 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_substations.geojson | 1.738 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_substations.geojson | 1.738 | pass | gis geometry |
| grid_400kv.geojson | 1.719 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_400kv.geojson | 1.719 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_400kv.geojson | 1.719 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_400kv.geojson | 1.719 | pass | gis geometry |
| repd_grid_atlasv6/data/uk_metros_trams.geojson | 1.574 | pass | gis geometry |
| repd_grid_atlasv7/data/uk_metros_trams.geojson | 1.574 | pass | gis geometry |
| repd_grid_atlasv8/data/uk_metros_trams.geojson | 1.574 | pass | gis geometry |
| grid_275kv.geojson | 1.212 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_275kv.geojson | 1.212 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_275kv.geojson | 1.212 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_275kv.geojson | 1.212 | pass | gis geometry |
| industrial_offtakers.geojson | 1.138 | pass | gis geometry |
| repd_grid_atlasv6/data/industrial_offtakers.geojson | 1.138 | pass | gis geometry |
| repd_grid_atlasv7/data/industrial_offtakers.geojson | 1.138 | pass | gis geometry |
| repd_grid_atlasv8/data/industrial_offtakers.geojson | 1.138 | pass | gis geometry |
| grid_33kv_Wales_South.geojson | 1.112 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_Wales_South.geojson | 1.112 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_Wales_South.geojson | 1.112 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_Wales_South.geojson | 1.112 | pass | gis geometry |
| grid_33kv_South_West_England.geojson | 0.966 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_South_West_England.geojson | 0.966 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_South_West_England.geojson | 0.966 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_South_West_England.geojson | 0.966 | pass | gis geometry |
| global_hydrocarbons.geojson | 0.745 | pass | gis geometry |
| repd_grid_atlasv6/data/global_hydrocarbons.geojson | 0.745 | pass | gis geometry |
| repd_grid_atlasv7/data/global_hydrocarbons.geojson | 0.745 | pass | gis geometry |
| repd_grid_atlasv8/data/global_hydrocarbons.geojson | 0.745 | pass | gis geometry |
| grid_66kv.geojson | 0.666 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_66kv.geojson | 0.666 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_66kv.geojson | 0.666 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_66kv.geojson | 0.666 | pass | gis geometry |
| railways.geojson | 0.556 | pass | gis geometry |
| repd_grid_atlasv6/data/railways.geojson | 0.556 | pass | gis geometry |
| repd_grid_atlasv7/data/railways.geojson | 0.556 | pass | gis geometry |
| repd_grid_atlasv8/data/railways.geojson | 0.556 | pass | gis geometry |
| grid_33kv_Yorkshire.geojson | 0.265 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_Yorkshire.geojson | 0.265 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_Yorkshire.geojson | 0.265 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_Yorkshire.geojson | 0.265 | pass | gis geometry |
| ev_chargers.geojson | 0.25 | pass | gis geometry |
| repd_grid_atlasv6/data/ev_chargers.geojson | 0.248 | pass | gis geometry |
| repd_grid_atlasv7/data/ev_chargers.geojson | 0.248 | pass | gis geometry |
| repd_grid_atlasv8/data/ev_chargers.geojson | 0.248 | pass | gis geometry |
| grid_33kv_South_East_England.geojson | 0.223 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_South_East_England.geojson | 0.223 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_South_East_England.geojson | 0.223 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_South_East_England.geojson | 0.223 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_tesco.geojson | 0.215 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_tesco.geojson | 0.215 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_tesco.geojson | 0.215 | pass | gis geometry |
| supermarkets_tesco.geojson | 0.215 | pass | gis geometry |
| grid_33kv_Scotland_North.geojson | 0.21 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_Scotland_North.geojson | 0.21 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_Scotland_North.geojson | 0.21 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_Scotland_North.geojson | 0.21 | pass | gis geometry |
| grid_33kv_North_West_England.geojson | 0.154 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_North_West_England.geojson | 0.154 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_North_West_England.geojson | 0.154 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_North_West_England.geojson | 0.154 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_morrisons.geojson | 0.149 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_morrisons.geojson | 0.149 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_morrisons.geojson | 0.149 | pass | gis geometry |
| supermarkets_morrisons.geojson | 0.149 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_sainsburys.geojson | 0.146 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_sainsburys.geojson | 0.146 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_sainsburys.geojson | 0.146 | pass | gis geometry |
| supermarkets_sainsburys.geojson | 0.146 | pass | gis geometry |
| airports.geojson | 0.131 | pass | gis geometry |
| repd_grid_atlasv6/data/airports.geojson | 0.131 | pass | gis geometry |
| repd_grid_atlasv7/data/airports.geojson | 0.131 | pass | gis geometry |
| repd_grid_atlasv8/data/airports.geojson | 0.131 | pass | gis geometry |
| grid_33kv_East_of_England.geojson | 0.125 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_East_of_England.geojson | 0.125 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_East_of_England.geojson | 0.125 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_East_of_England.geojson | 0.125 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_asda.geojson | 0.112 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_asda.geojson | 0.112 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_asda.geojson | 0.112 | pass | gis geometry |
| supermarkets_asda.geojson | 0.112 | pass | gis geometry |
| grid_33kv_Wales_North.geojson | 0.109 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_Wales_North.geojson | 0.109 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_Wales_North.geojson | 0.109 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_Wales_North.geojson | 0.109 | pass | gis geometry |
| motorway_services.geojson | 0.102 | pass | gis geometry |
| repd_grid_atlasv6/data/motorway_services.geojson | 0.102 | pass | gis geometry |
| repd_grid_atlasv7/data/motorway_services.geojson | 0.102 | pass | gis geometry |
| repd_grid_atlasv8/data/motorway_services.geojson | 0.102 | pass | gis geometry |
| london_underground.geojson | 0.079 | pass | gis geometry |
| repd_grid_atlasv6/data/london_underground.geojson | 0.079 | pass | gis geometry |
| repd_grid_atlasv7/data/london_underground.geojson | 0.079 | pass | gis geometry |
| repd_grid_atlasv8/data/london_underground.geojson | 0.079 | pass | gis geometry |
| uk_energy_tracking_v2/oil_price_history.geojson | 0.075 | pass | gis geometry |
| uk_energy_tracking_v3/oil_price_history.geojson | 0.075 | pass | gis geometry |
| uk_energy_tracking_v4/oil_price_history.geojson | 0.075 | pass | gis geometry |
| grid_220kv.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_220kv.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_220kv.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_220kv.geojson | 0.073 | pass | gis geometry |
| grid_33kv_Scotland_South.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_Scotland_South.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_Scotland_South.geojson | 0.073 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_Scotland_South.geojson | 0.073 | pass | gis geometry |
| hs2.geojson | 0.063 | pass | gis geometry |
| repd_grid_atlasv6/data/hs2.geojson | 0.063 | pass | gis geometry |
| repd_grid_atlasv7/data/hs2.geojson | 0.063 | pass | gis geometry |
| repd_grid_atlasv8/data/hs2.geojson | 0.063 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_lidl.geojson | 0.061 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_lidl.geojson | 0.061 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_lidl.geojson | 0.061 | pass | gis geometry |
| supermarkets_lidl.geojson | 0.061 | pass | gis geometry |
| feature_requests/004_create_test_fixtures/files/solar-bess-topology-v2/test_fixtures/fixture_001_default_string.geojson | 0.043 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_waitrose.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_waitrose.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_waitrose.geojson | 0.042 | pass | gis geometry |
| supermarkets_waitrose.geojson | 0.042 | pass | gis geometry |
| grid_33kv_London_Area.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_London_Area.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_London_Area.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_London_Area.geojson | 0.042 | pass | gis geometry |
| repd_grid_atlasv6/data/stadiums.geojson | 0.041 | pass | gis geometry |
| repd_grid_atlasv7/data/stadiums.geojson | 0.041 | pass | gis geometry |
| repd_grid_atlasv8/data/stadiums.geojson | 0.041 | pass | gis geometry |
| stadiums.geojson | 0.041 | pass | gis geometry |
| datacentres.geojson | 0.039 | pass | gis geometry |
| repd_grid_atlasv6/data/datacentres.geojson | 0.039 | pass | gis geometry |
| repd_grid_atlasv7/data/datacentres.geojson | 0.039 | pass | gis geometry |
| repd_grid_atlasv8/data/datacentres.geojson | 0.039 | pass | gis geometry |
| power_plants.geojson | 0.033 | pass | gis geometry |
| repd_grid_atlasv6/data/power_plants.geojson | 0.033 | pass | gis geometry |
| repd_grid_atlasv7/data/power_plants.geojson | 0.033 | pass | gis geometry |
| repd_grid_atlasv8/data/power_plants.geojson | 0.033 | pass | gis geometry |
| grid_33kv_North_East_England.geojson | 0.026 | pass | gis geometry |
| repd_grid_atlasv6/data/grid_33kv_North_East_England.geojson | 0.026 | pass | gis geometry |
| repd_grid_atlasv7/data/grid_33kv_North_East_England.geojson | 0.026 | pass | gis geometry |
| repd_grid_atlasv8/data/grid_33kv_North_East_England.geojson | 0.026 | pass | gis geometry |
| repd_grid_atlasv6/data/supermarkets_aldi.geojson | 0.015 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_aldi.geojson | 0.015 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_aldi.geojson | 0.015 | pass | gis geometry |
| supermarkets_aldi.geojson | 0.015 | pass | gis geometry |
| scripts/add_v8_bess_geospatial_layout_drawing.py | 0.013 | pass | raw or transient candidate |
| solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v8/bess-gis-sld-financial-sandbox/gis-sld-v5-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v4/gis-sld-v4-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v5/gis-sld-v4-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v5/gis-sld-v5-drawing.js | 0.01 | pass | raw or transient candidate |
| solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-drawing.js | 0.01 | pass | raw or transient candidate |
| repd_grid_atlasv6/data/supermarkets_costco.geojson | 0.009 | pass | gis geometry |
| repd_grid_atlasv7/data/supermarkets_costco.geojson | 0.009 | pass | gis geometry |
| repd_grid_atlasv8/data/supermarkets_costco.geojson | 0.009 | pass | gis geometry |
| supermarkets_costco.geojson | 0.009 | pass | gis geometry |
| solar-bess-topology-v3/gis-sld-v3-drawing.js | 0.009 | pass | raw or transient candidate |

## Governance note

Use changed scope for push and pull request enforcement. Use all scope for manual audit runs.
