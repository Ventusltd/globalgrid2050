# GlobalGrid2050 GridBot Mega Upgrade Report

Generated UTC: `2026-06-08T14:11:28Z`
Mode: `audit only`
Manifest: `gridbot_manifests/001_generation_data_discipline.yml`
Git head: `4d86d495`

## Executive summary

GridBot ran 9 phases in audit only mode. Apply only affects phases with applyByDefault true.

## Phase results

### repo_size_audit  Repository size audit

Operation: `repo_size_audit`
Applied: `False`

```json
{
  "totalWorkingTreeMiB": 661.23,
  "reviewFiles": [
    {
      "path": "uk_primary_roads.geojson",
      "sizeMiB": 76.016,
      "risk": "fail_threshold",
      "kind": "gis"
    },
    {
      "path": "uk_trunk_roads.geojson",
      "sizeMiB": 64.4,
      "risk": "fail_threshold",
      "kind": "gis"
    },
    {
      "path": "uk_mainline_railways.geojson",
      "sizeMiB": 52.503,
      "risk": "fail_threshold",
      "kind": "gis"
    },
    {
      "path": "data/electricity/elexon_system_prices_half_hourly.csv",
      "sizeMiB": 19.101,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/elexon_generation_sources_2026.csv",
      "sizeMiB": 17.65,
      "risk": "warn_threshold",
      "kind": "data_or_asset"
    },
    {
      "path": "data/generation/elexon_generation_sources_half_hourly.csv",
      "sizeMiB": 17.65,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-10.csv",
      "sizeMiB": 16.368,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-12.csv",
      "sizeMiB": 16.321,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-11.csv",
      "sizeMiB": 15.792,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-07.csv",
      "sizeMiB": 15.497,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-08.csv",
      "sizeMiB": 15.483,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-09.csv",
      "sizeMiB": 15.463,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-05.csv",
      "sizeMiB": 15.459,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-03.csv",
      "sizeMiB": 15.435,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-06.csv",
      "sizeMiB": 14.975,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-04.csv",
      "sizeMiB": 14.959,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-01.csv",
      "sizeMiB": 14.7,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2021-02.csv",
      "sizeMiB": 13.987,
      "risk": "warn_threshold",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json",
      "sizeMiB": 13.388,
      "risk": "warn_threshold",
      "kind": "data_or_asset"
    },
    {
      "path": "uk_motorways.geojson",
      "sizeMiB": 10.958,
      "risk": "warn_threshold",
      "kind": "gis"
    },
    {
      "path": "global_ports.geojson",
      "sizeMiB": 9.784,
      "risk": "warn_threshold",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/global_ports.geojson",
      "sizeMiB": 9.715,
      "risk": "warn_threshold",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/global_ports.geojson",
      "sizeMiB": 9.715,
      "risk": "warn_threshold",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/global_ports.geojson",
      "sizeMiB": 9.715,
      "risk": "warn_threshold",
      "kind": "gis"
    },
    {
      "path": "uk_metros_trams.geojson",
      "sizeMiB": 4.48,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "eurostar.geojson",
      "sizeMiB": 4.062,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/eurostar.geojson",
      "sizeMiB": 4.062,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/eurostar.geojson",
      "sizeMiB": 4.062,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/eurostar.geojson",
      "sizeMiB": 4.062,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_132kv.geojson",
      "sizeMiB": 3.252,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_132kv.geojson",
      "sizeMiB": 3.252,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_132kv.geojson",
      "sizeMiB": 3.252,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_132kv.geojson",
      "sizeMiB": 3.252,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/subsea_data_cables.geojson",
      "sizeMiB": 3.191,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/subsea_data_cables.geojson",
      "sizeMiB": 3.191,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/subsea_data_cables.geojson",
      "sizeMiB": 3.191,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "subsea_data_cables.geojson",
      "sizeMiB": 3.191,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_11kv_ukpn.geojson",
      "sizeMiB": 2.981,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_11kv_ukpn.geojson",
      "sizeMiB": 2.981,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_11kv_ukpn.geojson",
      "sizeMiB": 2.981,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_11kv_ukpn.geojson",
      "sizeMiB": 2.981,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking/oil_price_history.geojson",
      "sizeMiB": 1.752,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking_v5/oil_price_history.geojson",
      "sizeMiB": 1.752,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking_v6/oil_price_history.geojson",
      "sizeMiB": 1.752,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_substations.geojson",
      "sizeMiB": 1.738,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_substations.geojson",
      "sizeMiB": 1.738,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_substations.geojson",
      "sizeMiB": 1.738,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_substations.geojson",
      "sizeMiB": 1.738,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_400kv.geojson",
      "sizeMiB": 1.719,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_400kv.geojson",
      "sizeMiB": 1.719,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_400kv.geojson",
      "sizeMiB": 1.719,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_400kv.geojson",
      "sizeMiB": 1.719,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/uk_metros_trams.geojson",
      "sizeMiB": 1.574,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/uk_metros_trams.geojson",
      "sizeMiB": 1.574,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/uk_metros_trams.geojson",
      "sizeMiB": 1.574,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_275kv.geojson",
      "sizeMiB": 1.212,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_275kv.geojson",
      "sizeMiB": 1.212,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_275kv.geojson",
      "sizeMiB": 1.212,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_275kv.geojson",
      "sizeMiB": 1.212,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "industrial_offtakers.geojson",
      "sizeMiB": 1.138,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/industrial_offtakers.geojson",
      "sizeMiB": 1.138,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/industrial_offtakers.geojson",
      "sizeMiB": 1.138,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/industrial_offtakers.geojson",
      "sizeMiB": 1.138,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_Wales_South.geojson",
      "sizeMiB": 1.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_Wales_South.geojson",
      "sizeMiB": 1.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_Wales_South.geojson",
      "sizeMiB": 1.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_Wales_South.geojson",
      "sizeMiB": 1.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_South_West_England.geojson",
      "sizeMiB": 0.966,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_South_West_England.geojson",
      "sizeMiB": 0.966,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_South_West_England.geojson",
      "sizeMiB": 0.966,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_South_West_England.geojson",
      "sizeMiB": 0.966,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "global_hydrocarbons.geojson",
      "sizeMiB": 0.745,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/global_hydrocarbons.geojson",
      "sizeMiB": 0.745,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/global_hydrocarbons.geojson",
      "sizeMiB": 0.745,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/global_hydrocarbons.geojson",
      "sizeMiB": 0.745,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_66kv.geojson",
      "sizeMiB": 0.666,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_66kv.geojson",
      "sizeMiB": 0.666,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_66kv.geojson",
      "sizeMiB": 0.666,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_66kv.geojson",
      "sizeMiB": 0.666,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "railways.geojson",
      "sizeMiB": 0.556,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/railways.geojson",
      "sizeMiB": 0.556,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/railways.geojson",
      "sizeMiB": 0.556,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/railways.geojson",
      "sizeMiB": 0.556,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_Yorkshire.geojson",
      "sizeMiB": 0.265,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_Yorkshire.geojson",
      "sizeMiB": 0.265,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_Yorkshire.geojson",
      "sizeMiB": 0.265,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_Yorkshire.geojson",
      "sizeMiB": 0.265,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "ev_chargers.geojson",
      "sizeMiB": 0.25,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/ev_chargers.geojson",
      "sizeMiB": 0.248,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/ev_chargers.geojson",
      "sizeMiB": 0.248,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/ev_chargers.geojson",
      "sizeMiB": 0.248,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_South_East_England.geojson",
      "sizeMiB": 0.223,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_South_East_England.geojson",
      "sizeMiB": 0.223,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_South_East_England.geojson",
      "sizeMiB": 0.223,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_South_East_England.geojson",
      "sizeMiB": 0.223,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_tesco.geojson",
      "sizeMiB": 0.215,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_tesco.geojson",
      "sizeMiB": 0.215,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_tesco.geojson",
      "sizeMiB": 0.215,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_tesco.geojson",
      "sizeMiB": 0.215,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_Scotland_North.geojson",
      "sizeMiB": 0.21,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_Scotland_North.geojson",
      "sizeMiB": 0.21,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_Scotland_North.geojson",
      "sizeMiB": 0.21,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_Scotland_North.geojson",
      "sizeMiB": 0.21,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_North_West_England.geojson",
      "sizeMiB": 0.154,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_North_West_England.geojson",
      "sizeMiB": 0.154,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_North_West_England.geojson",
      "sizeMiB": 0.154,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_North_West_England.geojson",
      "sizeMiB": 0.154,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_morrisons.geojson",
      "sizeMiB": 0.149,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_morrisons.geojson",
      "sizeMiB": 0.149,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_morrisons.geojson",
      "sizeMiB": 0.149,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_morrisons.geojson",
      "sizeMiB": 0.149,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_sainsburys.geojson",
      "sizeMiB": 0.146,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_sainsburys.geojson",
      "sizeMiB": 0.146,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_sainsburys.geojson",
      "sizeMiB": 0.146,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_sainsburys.geojson",
      "sizeMiB": 0.146,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "airports.geojson",
      "sizeMiB": 0.131,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/airports.geojson",
      "sizeMiB": 0.131,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/airports.geojson",
      "sizeMiB": 0.131,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/airports.geojson",
      "sizeMiB": 0.131,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_East_of_England.geojson",
      "sizeMiB": 0.125,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_East_of_England.geojson",
      "sizeMiB": 0.125,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_East_of_England.geojson",
      "sizeMiB": 0.125,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_East_of_England.geojson",
      "sizeMiB": 0.125,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_asda.geojson",
      "sizeMiB": 0.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_asda.geojson",
      "sizeMiB": 0.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_asda.geojson",
      "sizeMiB": 0.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_asda.geojson",
      "sizeMiB": 0.112,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_Wales_North.geojson",
      "sizeMiB": 0.109,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_Wales_North.geojson",
      "sizeMiB": 0.109,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_Wales_North.geojson",
      "sizeMiB": 0.109,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_Wales_North.geojson",
      "sizeMiB": 0.109,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "motorway_services.geojson",
      "sizeMiB": 0.102,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/motorway_services.geojson",
      "sizeMiB": 0.102,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/motorway_services.geojson",
      "sizeMiB": 0.102,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/motorway_services.geojson",
      "sizeMiB": 0.102,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "london_underground.geojson",
      "sizeMiB": 0.079,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/london_underground.geojson",
      "sizeMiB": 0.079,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/london_underground.geojson",
      "sizeMiB": 0.079,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/london_underground.geojson",
      "sizeMiB": 0.079,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking_v2/oil_price_history.geojson",
      "sizeMiB": 0.075,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking_v3/oil_price_history.geojson",
      "sizeMiB": 0.075,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "uk_energy_tracking_v4/oil_price_history.geojson",
      "sizeMiB": 0.075,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_220kv.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_Scotland_South.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_220kv.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_Scotland_South.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_220kv.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_Scotland_South.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_220kv.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_Scotland_South.geojson",
      "sizeMiB": 0.073,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "hs2.geojson",
      "sizeMiB": 0.063,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/hs2.geojson",
      "sizeMiB": 0.063,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/hs2.geojson",
      "sizeMiB": 0.063,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/hs2.geojson",
      "sizeMiB": 0.063,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_lidl.geojson",
      "sizeMiB": 0.061,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_lidl.geojson",
      "sizeMiB": 0.061,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_lidl.geojson",
      "sizeMiB": 0.061,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_lidl.geojson",
      "sizeMiB": 0.061,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "feature_requests/004_create_test_fixtures/files/solar-bess-topology-v2/test_fixtures/fixture_001_default_string.geojson",
      "sizeMiB": 0.043,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_London_Area.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_London_Area.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_waitrose.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_London_Area.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_waitrose.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_London_Area.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_waitrose.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_waitrose.geojson",
      "sizeMiB": 0.042,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/stadiums.geojson",
      "sizeMiB": 0.041,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/stadiums.geojson",
      "sizeMiB": 0.041,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/stadiums.geojson",
      "sizeMiB": 0.041,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "stadiums.geojson",
      "sizeMiB": 0.041,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "datacentres.geojson",
      "sizeMiB": 0.039,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/datacentres.geojson",
      "sizeMiB": 0.039,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/datacentres.geojson",
      "sizeMiB": 0.039,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/datacentres.geojson",
      "sizeMiB": 0.039,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "power_plants.geojson",
      "sizeMiB": 0.033,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/power_plants.geojson",
      "sizeMiB": 0.033,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/power_plants.geojson",
      "sizeMiB": 0.033,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/power_plants.geojson",
      "sizeMiB": 0.033,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "grid_33kv_North_East_England.geojson",
      "sizeMiB": 0.026,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/grid_33kv_North_East_England.geojson",
      "sizeMiB": 0.026,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/grid_33kv_North_East_England.geojson",
      "sizeMiB": 0.026,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/grid_33kv_North_East_England.geojson",
      "sizeMiB": 0.026,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_aldi.geojson",
      "sizeMiB": 0.015,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_aldi.geojson",
      "sizeMiB": 0.015,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_aldi.geojson",
      "sizeMiB": 0.015,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_aldi.geojson",
      "sizeMiB": 0.015,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "elizabeth_line.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/elizabeth_line.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_costco.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/elizabeth_line.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_costco.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/elizabeth_line.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_costco.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_costco.geojson",
      "sizeMiB": 0.009,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_coop.geojson",
      "sizeMiB": 0.008,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_coop.geojson",
      "sizeMiB": 0.008,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_coop.geojson",
      "sizeMiB": 0.008,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_coop.geojson",
      "sizeMiB": 0.008,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "deep_subsea_illustrative.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/deep_subsea_illustrative.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_booths.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/deep_subsea_illustrative.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_booths.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/deep_subsea_illustrative.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_booths.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_booths.geojson",
      "sizeMiB": 0.003,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "data/generation/archive/2021/elexon_generation_sources_2020-12.csv",
      "sizeMiB": 0.002,
      "risk": "tracked",
      "kind": "raw_or_archive_candidate"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_ms.geojson",
      "sizeMiB": 0.001,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_ms.geojson",
      "sizeMiB": 0.001,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_ms.geojson",
      "sizeMiB": 0.001,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_ms.geojson",
      "sizeMiB": 0.001,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_farmfoods.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_iceland.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv6/data/supermarkets_spar.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_farmfoods.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_iceland.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv7/data/supermarkets_spar.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_farmfoods.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_iceland.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "repd_grid_atlasv8/data/supermarkets_spar.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_farmfoods.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_iceland.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    },
    {
      "path": "supermarkets_spar.geojson",
      "sizeMiB": 0.0,
      "risk": "tracked",
      "kind": "gis"
    }
  ]
}
```

### patch_generation_archive_gitignore  Ignore generation archive transient files

Operation: `patch_gitignore`
Applied: `False`

```json
{
  "path": ".gitignore",
  "patternsAdded": [
    "data/generation/archive/",
    "data/generation/elexon_generation_sources_half_hourly.csv",
    "data/generation/elexon_generation_sources_2026.csv",
    "data/generation/*half_hourly*.csv",
    "data/generation/*archive*.csv"
  ],
  "applied": false
}
```

### merge_guard_audit  Audit never overwrite good data guard

Operation: `merge_guard_audit`
Applied: `False`

```json
{
  "scriptPath": "scripts/backfill_generation_aggregates_year_v6.py",
  "exists": true,
  "dangerousLastWriteWinsPatternPresent": false,
  "guardSignalsPresent": [
    "should_replace_existing",
    "weak_row",
    "FAIL_ON_WEAK_OVERWRITE",
    "completeness",
    "record_count"
  ],
  "appearsGuarded": true
}
```

### confirmed_fact_source_audit  Audit confirmed fact source discipline

Operation: `confirmed_fact_source_audit`
Applied: `False`

```json
{
  "scripts": [
    {
      "path": "scripts/backfill_generation_aggregates_year_v6.py",
      "exists": true,
      "mentionsFUELINST": true,
      "mentionsFUELHH": false
    }
  ],
  "dataFiles": [
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json",
      "exists": true,
      "mentionsFUELINST": true,
      "mentionsFUELHH": false,
      "sourceText": "{\"source\": \"Elexon BMRS FUELINST and Sheffield Solar PVLive where available\", \"sourceDatasets\": null, \"metadata\": null, \"description\": \"Monthly MWh by generation technology, with MW statistics\"}"
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json",
      "exists": true,
      "mentionsFUELINST": true,
      "mentionsFUELHH": false,
      "sourceText": "{\"source\": \"Elexon BMRS FUELINST and Sheffield Solar PVLive where available\", \"sourceDatasets\": null, \"metadata\": null, \"description\": \"Annual MWh by generation technology\"}"
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json",
      "exists": true,
      "mentionsFUELINST": true,
      "mentionsFUELHH": false,
      "sourceText": "{\"source\": \"Elexon BMRS FUELINST and Sheffield Solar PVLive where available\", \"sourceDatasets\": null, \"metadata\": null, \"description\": \"Seasonal MWh by generation technology\"}"
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json",
      "exists": true,
      "mentionsFUELINST": true,
      "mentionsFUELHH": false,
      "sourceText": "{\"source\": \"Elexon BMRS FUELINST and Sheffield Solar PVLive where available\", \"sourceDatasets\": null, \"metadata\": null, \"description\": \"Monthly day versus night MWh by generation technology\"}"
    }
  ]
}
```

### resample_recent_generation_30min  Resample recent generation to true 30 minute MW slice

Operation: `resample_recent_30min`
Applied: `False`

```json
{
  "sourcePath": "uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json",
  "outputPath": "uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json",
  "sourceRows": 79200,
  "outputRows": 14409,
  "sourceMiB": 13.388,
  "outputEstimatedMiB": 2.309,
  "applied": false
}
```

### rewire_recent_loader  Rewire browser config to true 30 minute recent slice

Operation: `rewire_recent_loader`
Applied: `False`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "oldPathFound": true,
  "newPathAlreadyPresent": false,
  "applied": false
}
```

### source_routing_audit  Generation history source routing audit

Operation: `source_routing_audit`
Applied: `False`

```json
{
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "exists": true,
  "hasTierFor": true,
  "longRangesRouteDaily": true,
  "recentTierPresent": true,
  "configStillUsesOldRecentFile": true,
  "configUsesNewRecentFile": false
}
```

### non_additive_peak_audit  Non additive peak audit

Operation: `non_additive_peak_audit`
Applied: `False`

```json
{
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "hits": [
    "highMW\\s*\\+=",
    "lowMW\\s*\\+="
  ],
  "riskPresent": true
}
```

### confirmed_fact_schema_audit  Confirmed fact schema audit

Operation: `confirmed_fact_schema_audit`
Applied: `False`

```json
{
  "files": [
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json",
      "exists": true,
      "rowCount": 1239,
      "missingMetadata": [
        "schemaVersion",
        "sourceDatasets",
        "timezone",
        "dayNightRule"
      ],
      "missingRowFields": [
        "status",
        "completeness"
      ]
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json",
      "exists": true,
      "rowCount": 109,
      "missingMetadata": [
        "schemaVersion",
        "sourceDatasets",
        "timezone",
        "dayNightRule"
      ],
      "missingRowFields": [
        "status",
        "completeness"
      ]
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json",
      "exists": true,
      "rowCount": 424,
      "missingMetadata": [
        "schemaVersion",
        "sourceDatasets",
        "timezone",
        "dayNightRule"
      ],
      "missingRowFields": [
        "status",
        "completeness"
      ]
    },
    {
      "path": "uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json",
      "exists": true,
      "rowCount": 1239,
      "missingMetadata": [
        "schemaVersion",
        "sourceDatasets",
        "timezone",
        "dayNightRule"
      ],
      "missingRowFields": [
        "status",
        "completeness"
      ]
    }
  ]
}
```
