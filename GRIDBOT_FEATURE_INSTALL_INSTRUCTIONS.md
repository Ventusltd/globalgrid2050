# GridBot Feature Install Instructions and Progress Log

## How to Use This Document

This file is the operating instruction for installing controlled features into the GlobalGrid2050 GIS SLD Financial Sandbox V2.

To proceed with a feature install:

1. Create or update the relevant folder under `feature_requests/`.
2. Ensure that folder contains a valid `manifest.yml`.
3. Place any new files under the matching `files/` path.
4. Commit the feature request to `main`.
5. Go to GitHub Actions.
6. Open `GridBot Feature Install`.
7. Press `Run workflow`.
8. Set `source` to `solar-bess-topology-v2`.
9. Set `target` to `solar-bess-topology-v2`.
10. Set `feature` to the exact feature folder name, for example `002_extract_v2_config`.
11. Leave `overwrite` unchecked or false.
12. Run the workflow.

Do not leave the feature field blank unless every earlier feature is repeat safe. A blank feature field tells GridBot to run all feature folders. A specific feature field tells GridBot to run only that one feature.

After the workflow completes:

1. Check that it is green.
2. Open `gridbot_reports/` and confirm a new install report exists.
3. Check the changed files.
4. Wait for GitHub Pages deployment to complete.
5. Open the live sandbox and confirm:
   - The page renders.
   - The map loads.
   - The substation layer loads.
   - The draw button works.
   - Finance values still update.
   - No obvious browser error has appeared.

## Why GlobalGrid2050 Is Being Modularised

The GIS SLD Financial Sandbox V2 is already a working browser based infrastructure reasoning system.

It combines:

1. GIS
2. Solar topology
3. BESS assumptions
4. Grid node selection
5. Substation reference data
6. Cable route awareness
7. Module count logic
8. CAPEX assumptions
9. Revenue assumptions
10. Electrical loss assumptions
11. GeoJSON export
12. Early stage project screening

The app began as a large working HTML file at:

```text
solar-bess-topology-v2/indexforgis-sld-v2.html
