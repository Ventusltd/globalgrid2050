# Interconnector Bar UI Match

Generated UTC: `2026-06-13T20:14:17.958383Z`
Mode: `audit`
Pass: `True`

Matches the interconnector section to the existing annual MWh generation bar style. Interconnectors remain below generation, but each row uses the same label, track and TWh value grammar. The value displayed is net MWh, with import/export detail retained in the hover title and JSON files. Granular JSON data is not changed.

## Planned changed files

- `uk_energy_tracking_v6/generation_history/render_generation_mwh_aggregates.js`
- `uk_energy_tracking_v6/generation_history/control_generation_mwh_aggregates.js`

## Checks

| Check | Result |
|---|---|
| renderer_syntax_ok | ✅ |
| control_syntax_ok | ✅ |
| interconnector_rows_use_mwh_row_bar_layout | ✅ |
| interconnector_rows_not_collapsed_into_details | ✅ |
| interconnector_labels_shortened_for_mobile | ✅ |
| values_show_net_twh_like_generation_rows | ✅ |
| total_check_uses_same_mwh_row_layout | ✅ |
| status_line_shortened | ✅ |
| generation_jsons_not_touched | ✅ |

## Rollback

Revert the apply commit. This repair changes only render_generation_mwh_aggregates.js and control_generation_mwh_aggregates.js.
