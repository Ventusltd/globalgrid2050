# GlobalGrid2050 V6

V6 is a separated application workspace copied from the stable V5 folder.

Purpose:

1. Keep V5 stable.
2. Place each application in its own folder.
3. Make it obvious which scripts belong to which app.
4. Prepare the cable geometry visualiser for modularisation without risking the GIS SLD sandbox or DC AC LV topology app.

Folder structure:

```text
solar-bess-topology-v6/
  index.html
  gis-sld-financial-sandbox/
  module-layout/
  dc-ac-lv-topology-review/
  cable-geometry-visualiser/
  docs/
  tools/
```

Rules for future AI or human work:

1. Do not edit V5 when working on V6.
2. Do not mix scripts between apps unless they are deliberately placed in a shared folder later.
3. Keep each app working independently inside its own folder.
4. Use small workflows and small commits.
5. For the cable geometry visualiser, split only after the copied V6 app is confirmed working.

Next planned work:

Modularise `cable-geometry-visualiser/index.html` into separate CSS, data, calculation, rendering, UI and export files.
