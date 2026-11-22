# V9.69 — Expanded REPD visual parity with native Pipeline

Owner correction 22 November 2026, 16:19 GMT. This release is based directly on the proven V9.65 component rather than extending V9.66's red UI.

- Exactly the original black/cyan native Pipeline appearance and gauge instruments, not ticker-red, for both normal and expanded REPD.
- All 13 original columns visible and sortable. Notes restored; original MAP + A4 controls stay in the native MAP/actions column; no action relocation into Operator.
- Wider 188px action column to prevent clipped/stacked MAP/A4 on mobile, with original-size (90px MAP / 52px A4) cyan MAP and muted A4 button styling as on the normal REPD.
- Operator 116px wrapped (not 52px). Full name remains accessible.
- The same native full 13-column table opens **scaled to fit all columns across the browser** (even a phone), with no new buttons. Two-finger pinch (or trackpad pinch) magnifies just the table; thumb/mouse swipes navigate the magnified records, and closing clears all view-only zoom. The real three-gauge cockpit stays full size and stationary.
- Full viewport, 2D swipe/trackpad scrolling, 100 records per expanded page; original 50-row dashboard retained.
- Original data, report generator, PDF, GridAtlas model, news, producer engine and prior releases left byte-identical.


## Landscape reading view

Expanded REPD is an immersive, landscape-only, full-height reading table. It omits the live gauges, technology selector, and the Technology, GlobalGrid reference and Machine Read Notes columns **only while expanded**. Ten visible columns retain original cyan/black styling, native column-header sorting, 100 rows per page, horizontal swipe and pinch zoom. MAP and A4 remain side by side in their unchanged far-right original cell. In portrait the user sees a tasteful rotation prompt; returning to portrait while open temporarily covers the table. Normal REPD, its gauges, controls and A4/PDF remain unchanged.


## V9.69 full-screen layout contract
Expanded REPD works in both orientations. No title bar: a minimal × Close control floats over a full-height, native-colour scrolling table. Project is immediately followed by **MAP only**. Each MAP link in the second column is a presentation clone, while the original anchor remains in the final Actions cell for the unchanged A4 report model. The A4 button remains in the final column at the far right. Technology, GlobalGrid reference, and Machine Read Notes remain hidden in expanded mode only. 100 rows/page and native sortable headers remain. Temporary MAP column is removed when minimised, restoring the original 13-cell DOM in the normal view. V9.68 is preserved unchanged for rollback.
