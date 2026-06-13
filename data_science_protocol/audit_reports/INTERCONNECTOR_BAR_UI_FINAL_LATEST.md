# Interconnector Bar UI Final

Generated UTC: `2026-06-13T22:55:44.812885Z`
Mode: `apply`
Pass: `True`

Repairs the phone layout after screenshot review. Interconnectors keep the same bar row grammar as generation rows, but labels are shortened to country and BMRS code. The red accounting warning is removed from the card, and the total electricity check becomes a compact metric grid instead of fake empty bars. Granular JSON data is not changed.

## Planned changed files

- `uk_energy_tracking_v6/generation_history/index.md`
- `uk_energy_tracking_v6/generation_history/render_generation_mwh_aggregates.js`
- `uk_energy_tracking_v6/generation_history/control_generation_mwh_aggregates.js`

## Checks

| Check | Result |
|---|---|
| renderer_syntax_ok | ✅ |
| control_syntax_ok | ✅ |
| warning_box_removed_from_index | ✅ |
| index_cache_busters_updated | ✅ |
| interconnector_rows_use_standard_mwh_row_layout | ✅ |
| interconnector_labels_shortened_for_mobile | ✅ |
| total_check_uses_metric_grid_not_fake_bars | ✅ |
| explanatory_note_removed_from_main_card | ✅ |
| status_line_shortened | ✅ |
| generation_jsons_not_touched | ✅ |

## Rollback

Revert the apply commit. This repair changes only index.md, render_generation_mwh_aggregates.js and control_generation_mwh_aggregates.js.
