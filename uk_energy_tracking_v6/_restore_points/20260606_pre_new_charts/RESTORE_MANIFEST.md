# GlobalGrid2050 V6 restore point

Date: 2026 06 06
Purpose: Restore point before adding new charts to UK Live Grid Tracker V6.
Live page: /uk_energy_tracking_v6/
Repository: Ventusltd/globalgrid2050
Anchor commit: ce967d53635d0f8532f8775687235c4b8c963f8c
Anchor commit message: Automated UK grid update V6 both 2026 06 06 21:54 UTC

## Scope

This restore point protects the current V6 application shell, stylesheet and loaded JavaScript modules before new chart development begins.

It intentionally records source modules and page structure rather than hourly live data files, because the live data files are updated by GridBot and should continue to move.

## Protected files and current blob SHAs

uk_energy_tracking_v6/index.md
b04daaf33e9b8658122a0c90c0d7da3d3eed02a6

uk_energy_tracking_v6/styles/app.css
617321dee2109b5f5642a1ead85a62d1bf0fea53

uk_energy_tracking_v6/shared_helpers/dom_text/dom_text.js
21e09bda160601c814207d3a16b8b39a80f8c4fc

uk_energy_tracking_v6/live_data_pipeline/live-config.js
5dd69f16d73c3e8f8eb7beafe341f49e57d27745

uk_energy_tracking_v6/live_data_pipeline/load_json/load_json.js
9cb26e2acf113cd9914b3347f1b2ee3b2a1ce69c

uk_energy_tracking_v6/live_data_pipeline/render_live_snapshot/render_live_snapshot.js
7db57c80e8d4c46f3017f71b68cacd6b2dc3ab0a

uk_energy_tracking_v6/live_data_pipeline/render_generation_mix/render_generation_mix.js
9a6c7d465e32b7b845ed8087aebe9787dcdaeaa1

uk_energy_tracking_v6/commodity_price_signals/render_commodities/render_commodities.js
9f3c4f5d5c3bedc9920ffc7b9ade303c1ad81f59

uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js
1ef08898c0b492d2e83530e6cea48bde41c4332b

uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js
9cbd330203ef9170d6b74373e55376378c666130

uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js
71ec5be450afa63812558a664e05b56785d8c234

uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js
e168eaecaa17734a2a7720a7fc335a031ddcc477

uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js
0af813bd998c800050a7735b521075ad8c1bf900

uk_energy_tracking_v6/frequency_history/frequency-history-ui.js
e975257b2fafa060315396655fb9597b9ccfadbf

## Current behaviour to preserve

V6 page is the modular development build.
V5 remains the protected reference.
The electricity price history chart is present.
The full screen electricity price chart is present.
The year selector, start date selector and period selector are present.
Commodity price cards are present.
Oil price trend panel is present.
Road fuel and EV charging panel is present.
Frequency history module is loaded from the V6 folder.
Live data placeholders may appear until client side feeds load.

## Restore method

Preferred restore method:
Use Git history to restore the protected files from anchor commit ce967d53635d0f8532f8775687235c4b8c963f8c.

Manual restore method:
For each protected file above, recover the blob matching the recorded SHA and copy it back to the original path.

Do not restore hourly live data JSON or CSV files unless the failure specifically relates to live data history.

## Change control rule after this point

Any new chart should be added in its own folder or clearly isolated module.
Do not edit V5.
Do not overwrite existing V6 chart modules without a report.
Do not mix layout, data and rendering changes in the same change unless unavoidable.
After the new chart works, write a fresh current state report in this folder or at the V6 root.
