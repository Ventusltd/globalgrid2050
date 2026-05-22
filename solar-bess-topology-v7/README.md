# GlobalGrid2050 V7

V7 is the separated application workspace for the Solar BESS Topology system.

It was created from the stable V5 toolset so the working V5 baseline remains protected while V7 becomes the controlled testing and modularisation area.

Public test address:

```text
https://globalgrid2050.com/solar-bess-topology-v7/
```

## Mandatory instruction for AI, LLMs and GridBot

Before making any change to V7, every AI, LLM, automation agent or human operator must first read the recent diary notes.

The diary folder is:

```text
/diary-notes-log/
```

Read the last 3 dated diary entries in that folder before modifying any V7 file.

If fewer than 3 diary entries exist, read all available diary entries.

Then read the core documentation:

```text
/README.md
/PHILOSOPHY.md
solar-bess-topology-v7/README.md
solar-bess-topology-v7/docs/ARCHITECTURE.md
```

Only after reading the diary and docs should any V7 change be proposed, scripted or applied.

This is now part of the V7 doctrine.

Do not rely on memory from a previous chat thread. Do not assume the current browser state matches the latest commit. Do not continue a failed patch sequence without checking the diary, current branch head and live file contents.

## Diary note indexing rule

Each major development note must be dated and placed in:

```text
/diary-notes-log/
```

Use this filename pattern:

```text
DDMMYY-HHMM-short-description.md
```

Example:

```text
260522-0115-v7-rollback-and-working-method.md
```

Each diary entry should clearly state:

1. Date and time.
2. What changed.
3. What failed.
4. What was rolled back.
5. Which commit is trusted.
6. Which files or workflows are relevant.
7. What must not be repeated.
8. What the next safe step is.

Future AI threads must scan the latest 3 diary entries before touching V7. This prevents repeated rediscovery and protects the working baseline.

## Status

```text
Testing phase
```

V7 is not yet the stable production baseline. V5 remains the stable comparison reference.

Current V7 purpose:

1. Keep V5 stable and untouched.
2. Place each application into its own folder.
3. Make application boundaries visible.
4. Modularise one app at a time.
5. Preserve working behaviour while improving maintainability.
6. Create a disciplined workspace for future GridBot controlled changes.

## Current recovery note

On 260522 at approximately 01:15 AM, V7 was rolled back after a failed feature expansion involving Energy Users, mobile filter controls, key layout changes and overlapping map controls.

The trusted rollback target recorded in the diary is:

```text
14379fa93ab8d9b772c8cc904f55f465b8be9ff9
```

That commit is titled:

```text
Add V7 GIS SLD asset status dropdown filters
```

It is treated as the safer working point because it preserves the useful asset status dropdown, Min MW, Max MW and Apply controls while removing later unstable Energy Users and mobile control stack changes.

Before continuing V7 work, confirm the rollback has deployed and browser testing has passed.

Suggested cache buster test URL:

```text
https://globalgrid2050.com/solar-bess-topology-v7/gis-sld-financial-sandbox/index.html?v=rollback-2150
```

Expected state after rollback:

```text
Energy assets dropdown present
Status dropdown present
Min MW present
Max MW present
Apply button present
No Energy Users dropdown
No FILTERS ON/OFF button
No unstable mobile control stack changes
```

## Governing doctrine

Before making any significant change, read:

```text
/diary-notes-log/   latest 3 entries
/PHILOSOPHY.md
solar-bess-topology-v7/docs/ARCHITECTURE.md
solar-bess-topology-v7/docs/V5_CHANGELOG_AND_ROADMAP.md
```

When in doubt, follow the docs, the diary notes and the repo philosophy.

The standing rule is:

```text
Protect working truth. Make small changes. Preserve physics. Keep state clear. Use controlled workflows. Let Vikram approve what becomes part of the system.
```

The engineering doctrine is:

```text
Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.
```

## V7 change control doctrine

V7 changes must be controlled, small and reversible.

For serious changes, use this pattern:

```text
scripts/feature_name.py
scripts/test_feature_name.py
.github/workflows/feature-name.yml
gridbot_reports/feature_name.md
```

The Python script must:

1. Read target files as UTF 8.
2. Patch by stable anchors such as IDs, function names or section comments.
3. Be idempotent.
4. Fail clearly if anchors are missing.
5. Avoid broad rewrites.
6. Write a GridBot report.

The test script must:

1. Confirm required HTML IDs exist.
2. Confirm duplicate controls were not created.
3. Confirm required JavaScript functions exist.
4. Confirm required layer IDs exist.
5. Confirm required boot wiring exists.
6. Confirm removed wording is absent.
7. Confirm source paths are proven rather than guessed.

The workflow must:

1. Use `workflow_dispatch`.
2. Use `GRIDBOT_PAT`.
3. Run the Python patch.
4. Run the test.
5. Commit exact intended files only.
6. Never use `git add .`.
7. Stop before commit if tests fail.

After any workflow succeeds, deploy GitHub Pages or Jekyll and test in the browser with a cache buster.

## Energy Users warning

Do not reintroduce Energy Users as a combined feature.

The failed Energy Users sequence attempted too many changes at once:

```text
EV Rapid 100 kW plus
Data Centres
Major Industrial Sites
Energy Users dropdown
Filter collapse
Mobile key repair
Mobile overlay repair
Tool spacing repair
Legend changes
Popup logic
Atlas V8 path guesses
```

That broke the app.

If Energy Users are ever reintroduced, do it one layer at a time:

1. Read Atlas V8 first.
2. Confirm the exact data path.
3. Add Data Centres only.
4. Make the layer visible by default for testing.
5. Confirm the browser Network tab shows no 404.
6. Confirm points render.
7. Add popup.
8. Add dropdown.
9. Repeat only after each layer works.

Do not guess data paths. Do not use the term `All energy users`.

## Folder structure

```text
solar-bess-topology-v7/
  index.html
  README.md
  gis-sld-financial-sandbox/
  module-layout/
  dc-ac-lv-topology-review/
  cable-geometry-visualiser/
  docs/
  tools/
```

## Application map

```text
index.html
```

V7 launcher page. It links to the separated applications.

```text
gis-sld-financial-sandbox/
```

Main GIS SLD Financial Sandbox. It remains close to the V5 GIS SLD app and still uses legacy `gis-sld-v5` file names inside the V7 folder. That is intentional for now because the first V7 objective is separation, not wholesale renaming.

```text
module-layout/
```

Physical solar module layout app. It tests module footprint, row count, pitch, orientation, map drawing and physical layout behaviour separately from the main GIS finance app.

```text
dc-ac-lv-topology-review/
```

DC AC LV topology review app. It reviews solar PV string, inverter, combiner, skid and cable topology assumptions separately from the main GIS finance app.

```text
cable-geometry-visualiser/
```

Cable geometry visualiser. This is now modularised in V7 phase 1.

Current files:

```text
index.html
style.css
data.js
calculations.js
rendering.js
export.js
ui.js
```

The modularisation report is here:

```text
gridbot_reports/v6_cable_geometry_modularisation_phase_1.md
```

The report confirms that the extracted V7 CSS and JavaScript rebuild exactly to the original V7 inline logic and match the original V5 baseline.

## V7 URLs to test

```text
https://globalgrid2050.com/solar-bess-topology-v7/
https://globalgrid2050.com/solar-bess-topology-v7/gis-sld-financial-sandbox/
https://globalgrid2050.com/solar-bess-topology-v7/module-layout/
https://globalgrid2050.com/solar-bess-topology-v7/dc-ac-lv-topology-review/
https://globalgrid2050.com/solar-bess-topology-v7/cable-geometry-visualiser/
```

V5 comparison references:

```text
https://globalgrid2050.com/solar-bess-topology-v5/indexforgis-sld-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/module-layout-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/dc-ac-lv-topology-review-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/cable-geometry-visualiser-v5.html
```

## Safe work rules

1. Read the latest 3 diary entries before touching V7.
2. Do not edit V5 when working on V7.
3. Do not mix scripts between apps unless a shared folder is deliberately designed later.
4. Keep each app independently loadable from its own folder.
5. Use small workflows and small commits.
6. Every change must be traceable through GitHub history.
7. Prefer deterministic Python or GridBot workflows over manual bulk edits.
8. Do not mass refactor for cosmetic reasons.
9. Do not rename legacy `v5` internal files unless that is the specific approved feature.
10. Do not change calculations without checking physical, electrical and financial consequences.
11. Do not patch CSS repeatedly over broken JavaScript.
12. Do not add data layers until their source paths are verified.
13. If unsure, stop and refer to `/PHILOSOPHY.md`, the V7 docs folder and `/diary-notes-log/`.

## Current architecture position

V7 has passed the first structural objective:

```text
Separate the applications from the V5 flat folder structure.
```

V7 has also passed the first modularisation objective:

```text
Extract the cable geometry visualiser into external CSS and JavaScript modules without changing its runtime logic.
```

The next correct work should remain controlled and narrow.

Recommended next candidates:

```text
1. Confirm rollback browser state.
2. Confirm the V7 GIS SLD app works again.
3. Only then add very small features.
4. Do not reintroduce Energy Users until proven source paths are known.
5. Leave GIS SLD finance logic untouched unless the requested feature specifically requires it.
```

## Human summary

V7 is the workshop.

V5 is the stable baseline.

The diary is now part of the V7 doctrine. Future AI threads must read the last 3 diary notes before modifying anything.

The priority is reliability first, feature expansion second.

## Project Maturity and Tool Validation

### Purpose

This training module focuses on the gap between perceived project maturity and actual engineering definition, and how real-world datasets stress-test the V7 tool's assumptions.

### Relevant V7 Apps

* `solar-bess-topology-v7/gis-sld-financial-sandbox/`
* `solar-bess-topology-v7/cable-geometry-visualiser/`
* `solar-bess-topology-v7/commercial-engineering-interface/`

---

### Assessing Engineering Maturity

Early-stage projects often present indicators of maturity that do not equate to a bankable engineering design.

* Projects frequently supply a consented layout, an environmental assessment and a redacted grid offer.


* Foundational engineering bases are often missing, such as ground investigations, detailed system specifications and protection philosophies.


* An SLD without validated studies represents concept maturity dressed as a further stage of development.


* Recognizing this gap clarifies whether a project requires foundational engineering definition rather than just design checking.


### Validating V7 Sandbox Assumptions

Real-world project datasets provide the necessary framework to validate the tool against genuine scenarios.

* Complex projects serve as a validation case to stress-test the tool against real-world datasets.


* Physical parameters like medium-voltage connections, battery energy capacities, and export distances map directly to inputs the tool models.


* Testing real projects through the sandbox checks if capital cost, revenue, and loss outputs remain realistic when measured against genuine grid offers and route lengths.


* Engineering-definition frameworks supply a cost-and-hours backbone that connects topology and route assumptions to the scale of effort a compliant design requires.



### Cable Geometry and Electrical Risk

Practical studies demonstrate exactly which variables the V7 route-assumption modules must track.

* A fully worked cable-sizing study illustrates the specific assumptions that must be made visible.


* Critical tracking parameters include installation methods, soil thermal resistivity, grouping, parallel circuits, and fault withstand.


* Applying these studies validates the "geometry first, assumptions second" methodology to ensure the tool points at the correct risks.


