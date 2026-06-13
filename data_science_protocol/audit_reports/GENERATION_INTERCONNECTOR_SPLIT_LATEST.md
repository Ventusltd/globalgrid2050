# Generation Interconnector Split

Generated UTC: `2026-06-13T19:39:37.337349Z`
Mode: `audit`
Pass: `True`

## Executive summary

Splits interconnectors out of the live V6 Generation Output in MWh panel using granular signed per-link files. The legacy Imports & Exports bucket is hidden, ten interconnectors each receive separate import and export JSON files, imports remain positive, exports remain negative, and a total electricity check line is shown at the bottom for reconciliation.

## Granular data contract

- Two files per interconnector: one imports file and one exports file.
- Imports are positive MWh.
- Exports are negative MWh.
- Total electricity check lines are written for external reconciliation.
- Label order is country, interconnector name, BMRS code.

## Interconnectors

- France - IFA / HVDC Cross-Channel - INTFR
- France - IFA2 - INTIFA2
- France - ElecLink - INTELEC
- Belgium - Nemo Link - INTNEM
- Netherlands - BritNed - INTNED
- Norway - North Sea Link - INTNSL
- Denmark - Viking Link - INTVKL
- Ireland - East-West Interconnector / EWIC - INTEW
- Ireland - Greenlink - INTGRNL
- Northern Ireland - Moyle Interconnector - INTIRL

## Output rows

- Index rows: `70`
- Total electricity rows: `11`
- JSON output files: `22`

## Planned changed files

- `uk_energy_tracking_v6/generation_history/index.md`
- `uk_energy_tracking_v6/generation_history/load_generation_mwh_aggregates.js`
- `uk_energy_tracking_v6/generation_history/render_generation_mwh_aggregates.js`
- `uk_energy_tracking_v6/generation_history/control_generation_mwh_aggregates.js`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_ifa_hvdc_cross_channel_intfr_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_ifa_hvdc_cross_channel_intfr_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_ifa2_intifa2_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_ifa2_intifa2_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_eleclink_intelec_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/france_eleclink_intelec_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/belgium_nemo_link_intnem_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/belgium_nemo_link_intnem_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/netherlands_britned_intned_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/netherlands_britned_intned_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/norway_north_sea_link_intnsl_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/norway_north_sea_link_intnsl_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/denmark_viking_link_intvkl_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/denmark_viking_link_intvkl_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/ireland_east_west_interconnector_ewic_intew_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/ireland_east_west_interconnector_ewic_intew_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/ireland_greenlink_intgrnl_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/ireland_greenlink_intgrnl_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/northern_ireland_moyle_interconnector_intirl_imports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/northern_ireland_moyle_interconnector_intirl_exports.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_index.json`
- `uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_total_electricity_summary.json`

## Changed files in this mode

- none

## Checks

| Check | Result |
|---|---|
| target_files_exist | ✅ |
| target_route_present | ✅ |
| mwh_panel_present | ✅ |
| legacy_imports_exports_hidden_in_render | ✅ |
| legacy_imports_exports_hidden_in_control | ✅ |
| load_reads_interconnector_index_and_totals | ✅ |
| two_files_per_interconnector | ✅ |
| imports_positive_exports_negative | ✅ |
| separate_import_export_net_fields | ✅ |
| labels_are_country_first_interconnector_second_code_third | ✅ |
| all_ten_interconnector_codes_present | ✅ |
| total_electricity_summary_present | ✅ |
| signed_rows_detected_in_source | ✅ |
| raw_rows_not_written | ✅ |
| existing_generation_aggregate_jsons_not_modified | ✅ |
| index_cache_busters_updated | ✅ |
| index_has_interconnector_warning | ✅ |
| load_js_syntax_ok | ✅ |
| render_js_syntax_ok | ✅ |
| control_js_syntax_ok | ✅ |

## Method

Signed raw-code interconnector rows are scanned before collapse. Energy is calculated per BMRS code, not inside a merged INT* technology bucket. Imports are stored as positive signed MWh and exports as negative signed MWh.

## Rollback

Revert the apply commit. Existing generation aggregate JSON files are not modified by this workflow.

