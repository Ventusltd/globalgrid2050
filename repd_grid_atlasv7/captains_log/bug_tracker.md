# V7 Bug Tracker

**Atlas:** repd_grid_atlasv7 — Ventus OS V7 Experimental
**Engine:** ventus-corev7engine.js
**Maintained by:** Ventus Ltd

---

## Bug Log

---

### BUG-001 | Duplicate `const` Declaration — Blank Screen on Load

**Date:** 2026-04-21
**Severity:** CRITICAL — complete blank screen, map never renders
**Status:** RESOLVED

**Symptom:**
Map loads blank. No layers appear. Browser console shows `SyntaxError: Identifier 'ZONE_DRAW_DEFAULT_KM' has already been declared`.

**Root Cause:**
During messy reverts of the `bess_operational` implementation, the constant `ZONE_DRAW_DEFAULT_KM` was declared twice in `ventus-corev7engine.js`. JavaScript strict mode (enforced by module scope) throws a fatal SyntaxError on duplicate `const`, halting all execution before the map initialises.

**Resolution:**
Hard reset to clean commit `da3d4cc`. Rebuilt `bess_operational` from scratch on a clean engine. Added verification step: always `grep ZONE_DRAW_DEFAULT_KM` before committing engine changes.

**Prevention Rule:**
Before committing any engine change, confirm there is exactly one instance of `ZONE_DRAW_DEFAULT_KM` in the file. Never revert partial hunks through UI — use `git reset --hard` to a known-clean commit.

---

### BUG-002 | Operational Layer Labels Showing `[EMPTY]`

**Date:** 2026-04-22
**Severity:** HIGH — incorrect UI state, layers appear broken to user
**Status:** RESOLVED

**Symptom:**
Operational sub-layers (`solar_operational`, `bess_operational`, `wind_onshore_operational`, `wind_offshore_operational`) show `[EMPTY]` in the layer panel instead of count and MW total, despite features clearly rendering on the map.

**Root Cause:**
The `hydrateLayer()` function computed stats by grouping features on `f.properties.tech === id`. The operational layer IDs (`solar_operational` etc.) do not match the `tech` field values (`solar`, `bess`, `wind`) so the stats dictionary returned zero count for every operational layer.

**Resolution:**
Added `evalFilter()` function to V7 engine. This evaluates each layer's own MapLibre filter expression (`==`, `all`, `>=`) against every feature to compute the correct per-layer count and MW total. Stats are now accurate for all sub-layers regardless of ID naming.

**Prevention Rule:**
When adding new REPD sub-layers whose ID does not match the `tech` field, always verify stats computation uses the layer's filter expression, not a direct `tech === id` match.

---

### BUG-003 | `nan` Appearing in Popups for Mounting Field

**Date:** 2026-04-22
**Severity:** LOW — cosmetic, shows Python null artefact to user
**Status:** RESOLVED

**Symptom:**
REPD asset popups show `| nan` in the technology/mounting line for assets where the mounting type is not recorded.

**Root Cause:**
Python `pandas` writes the string `'nan'` (not a JS `null` or `undefined`) when a DataFrame cell is empty and is serialised to JSON. The click handler rendered `p.mounting` unconditionally.

**Resolution:**
Added string equality check: `(p.mounting && p.mounting !== 'nan')` before rendering the mounting field in the popup.

**Prevention Rule:**
Treat all fields originating from pandas-generated JSON as potentially containing the string `'nan'`. Always guard with `!== 'nan'` before rendering optional fields.

---

### BUG-004 | All Operational Layers Not Clickable — Silent Click Handler Crash

**Date:** 2026-05-01
**Severity:** CRITICAL — core interaction broken, no asset popups on click
**Status:** RESOLVED

**Symptom:**
Clicking any REPD operational layer circle (solar, BESS, onshore wind, offshore wind) produces no popup. No console error visible to user. Layer toggles and renders correctly — only click interaction is dead.

**Root Cause:**
When BUG-003 was fixed, the replacement targeted the `mounting` variable declaration line but accidentally replaced the **entire variable declaration block** that preceded it. This stripped the following variables from the click handler scope:

```
tech, rawTech, voltage, capacity, powerKw, connectors,
status, operator, capStr, statusCol, searchBtns, evFields
```

The click handler continued to call `openPopup()` referencing these now-undefined variables, causing a silent `ReferenceError` that crashed the handler on every REPD feature click. Because the error occurred after `queryRenderedFeatures` returned features, no early-exit guard caught it — it just silently failed.

**Diagnosed by:** Comparing V7 click handler line-by-line against frozen V5 reference (`ventus-core.js`). V5 has the full declaration block on one line; V7 was missing it entirely.

**Resolution:**
Restored the full V5-identical declaration block, with the nan-safe mounting check correctly merged in:
```javascript
const tech = p.tech || ''; const rawTech = p.raw_tech || p.type || tech; ... const mounting = (p.mounting && p.mounting !== 'nan') ? ` | ${escapeHTML(p.mounting)}` : ''; ...
```

**Prevention Rule:**
When making targeted fixes to a dense single-line variable declaration block, always read the full line first with `get_file` and replace the entire line — never attempt a partial replacement of a substring within it. Always compare the modified handler against V5 reference before committing.

---

## Open Bugs

None currently.

---

## Bug Count Summary

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| BUG-001 | Duplicate `const` — blank screen | CRITICAL | RESOLVED |
| BUG-002 | Operational labels showing `[EMPTY]` | HIGH | RESOLVED |
| BUG-003 | `nan` in mounting popup field | LOW | RESOLVED |
| BUG-004 | All operational layers not clickable | CRITICAL | RESOLVED |
