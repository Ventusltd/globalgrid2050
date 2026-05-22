# Diary Notes Log: 260522 01:15 AM

## GlobalGrid2050 V7 rollback, failure analysis and future working method

This note must be read before any future AI, GridBot or manual work is carried out on the V7 GIS SLD app.

The main instruction is simple:

**Before modifying V7, read this diary, the root README, the V7 README, any relevant architecture or philosophy documents and the current live files. Do not rely on memory alone. Do not assume the browser is showing the latest commit until GitHub Pages or Jekyll has deployed and a cache buster has been tested.**

## Repository and application context

Repository:

`Ventusltd/globalgrid2050`

Main active V7 app:

`solar-bess-topology-v7/gis-sld-financial-sandbox/index.html`

Core V7 files:

`solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js`

`solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js`

`solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js`

`solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-state.js`

`solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css`

Reference app for grid and asset layers:

`repd_grid_atlasv8/`

Useful reference files:

`repd_grid_atlasv8/index.html`

`repd_grid_atlasv8/ventus-corev8engine.js`

`repd_grid_atlasv8/data/`

The V7 GIS SLD app is a solar, BESS, grid, topology and financial screening workspace. It is not a final engineering design tool. It helps users see the relationship between land, grid infrastructure, voltage corridors, substations, operating assets, array layout, cable routing, topology, MWp sizing, CAPEX, revenue and early commercial assumptions.

The intended users include technical, commercial, finance, sales, procurement and development people. The app brings engineering context into early decision making, but it must not pretend to replace formal design, grid offers, grid studies, competent engineering review, legal review, investment committee due diligence or procurement validation.

## Standing doctrine

The working doctrine is:

Geometry first.

Assumptions second.

Screening third.

Formal design only when verified.

This means the app should first make physical and spatial relationships visible. Then it should make user assumptions visible. Then it should support screening. Only after that should formal engineering and investment decisions be considered outside the app.

## What happened in this development cycle

The V7 app had reached a strong working state. It contained the V7 GIS SLD workspace, voltage layers, operating renewable asset context, array tools, print tools, MWp sizing support and commercial screening logic.

Several upgrades worked well because they were controlled and narrow:

1. The root homepage was restored to a minimalist directory style after a more complex homepage was rejected.
2. V6 and V7 dashboard links were added.
3. The UK Energy Atlas V8 link was added to V6 and V7 dashboards.
4. UK renewables pipeline, price estimators, power systems studies and HV process pages were added as dashboard references.
5. Print functionality was improved in parts of the app.
6. Project X and unnecessary benchmark wording were removed.
7. The V7 GIS SLD app gained stronger grid context.
8. Voltage layers were brought in, including 66 kV, 132 kV, 275 kV and 400 kV controls.
9. Operating solar, onshore wind, offshore wind and BESS layers were brought in for spatial comparison.
10. Larger operating assets were made more visible.
11. The array could be toggled on and off.
12. Map tools such as draw, pick array, drop pins, draw route, rotation and movement were introduced into the map workflow.
13. MWp DC sizing support was introduced in principle.
14. The asset status dropdown, Min MW, Max MW and Apply controls were introduced.

The app became powerful, but the mobile overlay began to get crowded. Many controls were competing for the same map space: main map controls, voltage toggles, asset toggles, search, filters, key, tools, MWp sizing, print, site intelligence and layer controls.

## Where it started to go wrong

The failures started when too many changes were attempted in one sequence.

The intended feature was to introduce separate Energy Users layers in addition to Energy Assets. The desired Energy Users were:

EV Rapid 100 kW plus.

Data Centres.

Major Industrial Sites.

This was strategically sensible because it distinguishes energy generators and storage from energy demand. However, the implementation became unstable because it combined several separate jobs:

1. Add a new Energy Users dropdown.
2. Remove the term `All energy users`.
3. Load EV charger data.
4. Load data centre data.
5. Load major industrial site data.
6. Preserve Atlas V8 pixel sizing.
7. Add popups.
8. Add legend entries.
9. Add filter collapse controls.
10. Move Min MW and Max MW into the tools section.
11. Switch substations off by default.
12. Repair mobile key visibility.
13. Repair tool overlay spacing.
14. Repair mobile control stacking.
15. Repair overlapping layers.

This was too much at once. The scripts began to patch HTML, JavaScript and CSS simultaneously. Some scripts relied on exact text blocks that no longer existed because earlier scripts had already changed the files. Some CSS fixes fought previous CSS fixes. Some Atlas V8 paths were assumed rather than proven. The browser then showed that the Energy Users did not load and the layout was broken.

The failure was not that Python and YAML workflows are bad. The workflow method was mostly correct. The failure was that the scope became too broad and the tests were not enough to prove browser rendering.

## Rollback decision

The user tested the app and found it completely broken. The first rollback target used was too late because it still included later mobile stack work. The user clarified that the correct rollback point was approximately 9:50 PM on 21 May, when the app actually worked.

The branch was then force rolled back to:

`14379fa93ab8d9b772c8cc904f55f465b8be9ff9`

Commit title:

`Add V7 GIS SLD asset status dropdown filters`

This is now treated as the better rollback point because it predates later control stack and Energy Users work. It should contain the useful Energy Assets dropdown, Status dropdown, Min MW, Max MW and Apply state before the unstable Energy Users and mobile layout changes.

After rollback, GitHub Pages or Jekyll must be redeployed and tested with a cache buster URL such as:

`https://globalgrid2050.com/solar-bess-topology-v7/gis-sld-financial-sandbox/index.html?v=rollback-2150`

Expected restored state:

Energy assets dropdown.

Status dropdown.

Min MW.

Max MW.

Apply.

No Energy Users dropdown.

No FILTERS ON/OFF.

No later broken mobile stack changes.

## Important warning about diary notes

A previous diary file was created at:

`docs/GLOBALGRID2050_V7_DEVELOPMENT_DIARY.md`

However, because the branch was force rolled back, that file may no longer exist on `main`. This new diary note is therefore recreated under a fresh folder:

`diary-notes-log/`

Future assistants should look for this folder first.

## Required future working method

Do not manually edit large V7 files directly unless the change is tiny and obvious.

For any serious change, use the controlled workflow pattern:

1. Create a Python installer script in `scripts/`.
2. Create a static test script in `scripts/`.
3. Create a manual GitHub Actions workflow in `.github/workflows/`.
4. The workflow runs the Python patch.
5. The workflow runs the test.
6. The workflow writes a report in `gridbot_reports/`.
7. The workflow commits only exact intended files.
8. Never use `git add .`.
9. If the test fails, do not commit.
10. After success, deploy Jekyll or GitHub Pages and browser test with a cache buster.

Example structure:

`scripts/fix_feature_name.py`

`scripts/test_fix_feature_name.py`

`.github/workflows/fix-feature-name.yml`

`gridbot_reports/fix_feature_name.md`

The Python script must be idempotent. Running it twice must not duplicate controls or functions. It must search for stable anchors such as IDs, function names or clear section comments. If an anchor is missing, it should fail with a clear `SystemExit` message rather than guessing.

The YAML workflow must use `workflow_dispatch`. It must use `GRIDBOT_PAT`. It must stage only exact files. It must not commit if there are no changes. It must not hide failing tests.

## Testing rule

A static test is useful but not enough. The test must check:

HTML IDs exist.

Duplicate controls do not exist.

JavaScript function names exist.

Layer IDs exist.

Source paths exist or are intentionally external.

Boot wiring exists.

Removed wording is actually absent.

CSS classes exist only where expected.

But after that, browser testing is still required. The user must test on the live page after GitHub Pages deployment. Use a cache buster URL. Check desktop and mobile. Check the browser console and network panel if a data layer does not render.

## Energy Users future rule

Do not reintroduce Energy Users as one large feature.

If Energy Users are reintroduced, do it one layer at a time.

Correct future sequence:

1. Read Atlas V8 files first.
2. Confirm exact data file path for Data Centres.
3. Add Data Centres only.
4. Make it visible by default for testing.
5. Confirm browser loads the source without 404.
6. Confirm points render.
7. Add popup.
8. Add dropdown control.
9. Then repeat for EV Rapid 100 kW plus.
10. Then repeat for Major Industrial Sites.
11. Only after all render should mobile layout be adjusted.

Do not guess paths like `ev_chargers.geojson` or `datacentres.geojson`. Use Atlas V8 as source of truth. If the Atlas V8 app loads the layer in a specific way, copy the exact proven path and layer logic.

Do not use the term `All energy users`.

## Mobile layout future rule

Do not keep stacking absolute CSS patches. The mobile layout became fragile because several overlay systems were competing.

If mobile layout is rebuilt, use structural zones rather than repeated top offsets:

Zone 1: core map controls.

Zone 2: voltage and energy asset controls.

Zone 3: search and optional filters.

Zone 4: tools and MWp sizing.

Zone 5: compact key.

But do not do this until the rolled back app is confirmed stable again.

## What future assistants must do before touching V7

1. Read this diary note.
2. Read the root `README.md`.
3. Read the V7 README if present.
4. Inspect the current live V7 files.
5. Identify the current branch head.
6. Confirm whether the browser has deployed the latest commit.
7. Ask whether the rollback state has been tested.
8. Do not continue from memory of previous failed patches.
9. Do not reintroduce Energy Users unless explicitly requested.
10. If asked to add a feature, propose a narrow, testable workflow.

## Current final instruction

The priority is now recovery, not feature expansion.

First confirm the rollback to `14379fa93ab8d9b772c8cc904f55f465b8be9ff9` is working in the browser.

Only after that should new development resume.

The safest next feature should be small, isolated and reversible.

End of diary note.
