# V7 Version Control

**Atlas:** repd_grid_atlasv9 — Ventus OS V7 Experimental
**Engine:** ventus-corev9engine.js

---

## Changelog

---

### v7.0.0 — 2026-04-23 | Initial Clone from V6

- Full clone of repd_grid_atlasv6 into repd_grid_atlasv9
- All four operational layers inherited: solar (green), bess (pink), onshore wind (teal), offshore wind (blue)
- Engine renamed to ventus-corev9engine.js
- Commit: `6c702cc`

---

### v7.1.0 — 2026-04-23 | Operational Layer Stats Fix (evalFilter)

- Fixed operational sub-layers showing `[EMPTY]` in layer panel
- Added `evalFilter()` function to evaluate MapLibre filter expressions against features
- Stats now computed per-layer using the layer's own filter, not tech field matching
- See: BUG-002 in bug_tracker.md
- Commit: `e8e45bc`

---

### v7.1.1 — 2026-04-23 | Popup `nan` Mounting Fix

- Suppressed `nan` string from pandas null serialisation in asset popups
- Mounting field now only renders if value is truthy and not the string 'nan'
- See: BUG-003 in bug_tracker.md
- Commit: `7614ef3`

---

### v7.1.2 — 2026-04-23 | Homepage Update

- V7 added to homepage (index.html) as experimental sandbox
- V6 experimental label removed — V6 now listed as stable
- Commit: `4814bdd`

---

### v7.1.3 — 2026-04-24 | NAEI Point Sources Pipeline

- Added `scripts/fetch_naei_point_sourcesv9.py` — annual NAEI emissions fetcher
- Downloads from naei.energysecurity.gov.uk, parses GHGs sheet, converts OSGB36 → WGS84
- Added `.github/workflows/fetch_naei_point_sources.yml` — runs 1 October annually + manual trigger
- Commit: `c3d0bfd`

---

### v7.2.0 — 2026-05-01 | Critical Click Handler Restore

- Fixed all REPD operational layers not clickable
- Root cause: nan mounting fix accidentally stripped entire variable declaration block from click handler (tech, rawTech, voltage, capacity, status, operator, capStr, searchBtns, evFields)
- Restored full V5-identical declaration block with nan-safe mounting check merged in
- See: BUG-004 in bug_tracker.md
- Commit: `48322f0`
