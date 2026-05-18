# V6 Cable Geometry Modularisation Phase 1

UTC created: 2026-05-18T12:22:38.856991+00:00

Target app:

`solar-bess-topology-v6/cable-geometry-visualiser/index.html`

Purpose:

Split the V6 cable geometry visualiser into external CSS and JavaScript files while preserving the original V6 runtime order and comparing the extracted logic against the original V5 visualiser.

Generated files:

- `solar-bess-topology-v6/cable-geometry-visualiser/style.css`
- `solar-bess-topology-v6/cable-geometry-visualiser/data.js`
- `solar-bess-topology-v6/cable-geometry-visualiser/calculations.js`
- `solar-bess-topology-v6/cable-geometry-visualiser/rendering.js`
- `solar-bess-topology-v6/cable-geometry-visualiser/export.js`
- `solar-bess-topology-v6/cable-geometry-visualiser/ui.js`

Checks:

- PASS: V6 CSS module exactly rebuilds original V6 inline CSS
- PASS: V6 JS modules exactly rebuild original V6 inline JS
- PASS: V6 CSS matches original V5 inline CSS
- PASS: V6 JS matches original V5 inline JS
- PASS: V6 index now loads external style.css
- PASS: V6 index now loads all 5 JavaScript modules
- PASS: V6 index no longer contains inline style block
- PASS: data.js contains expected runtime symbols
- PASS: calculations.js contains expected runtime symbols
- PASS: rendering.js contains expected runtime symbols
- PASS: export.js contains expected runtime symbols
- PASS: ui.js contains expected runtime symbols

Hashes:

- V6 inline CSS before extraction: `066531e6ea1930619945f5a0ffbefdb1b6ba589836d2ca629b20b395ea16c3d7`
- V6 rebuilt CSS from module: `066531e6ea1930619945f5a0ffbefdb1b6ba589836d2ca629b20b395ea16c3d7`
- V6 inline JS before extraction: `18831cf912670992bbd4bd48abf5e9a882a7812af60398cb4ecc988e681cad6c`
- V6 rebuilt JS from modules: `18831cf912670992bbd4bd48abf5e9a882a7812af60398cb4ecc988e681cad6c`
- V5 original inline CSS: `066531e6ea1930619945f5a0ffbefdb1b6ba589836d2ca629b20b395ea16c3d7`
- V5 original inline JS: `18831cf912670992bbd4bd48abf5e9a882a7812af60398cb4ecc988e681cad6c`

Module sizes:

- `style.css`: 336 lines
- `data.js`: 428 lines
- `calculations.js`: 166 lines
- `rendering.js`: 416 lines
- `export.js`: 28 lines
- `ui.js`: 404 lines

Instruction:

After the workflow runs, manually open the V6 cable geometry visualiser in the browser and compare the default visual output, input controls, export JSON and copy snapshot behaviour against the V5 original.
