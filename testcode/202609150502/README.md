# UK Solar public project lens

An isolated solar data adapter and two registered lens modules (`ring`, `table`) using the verified Star Generator ES-module contract from `../202609142225/GRAMMAR.md` section 2 and its deviations. All 3,563 public REPD records remain selectable by `repd_ref`, including the five records with null latitude and longitude. The page does not assign geographic coordinates to those records.

## Integration and identity

The existing Generator shell is specific to code entities and has no dynamic data registration API. This page registers its modules in its own shell's `lenses` Map, supplies the documented core/view buffers, and reuses the existing `createGL` renderer. It does not change the Generator's shell or claim to inject solar records into its code universe. The renderer's numeric class 2 gives projects a round point shape; it does not turn a REPD identifier into a code-block key. The original project key stays a decimal string in the URL, table, detail panel and source link.

Grammar and runtime provenance: `1e8424f947399c67f61836c51393b6cb73995d5b`, with grammar SHA-256 `53a290e62c1f47b5d621899623b0c048a29d45d77d6f7464bfc757900eb79ecb`. `publication.json` pins the actual shared `core.js`, `gl.js` and grammar bytes under `dependencies`, as well as every file in this folder. Local and served verification checks both sets.

## Public data

`data/provenance.json` records the full source commit, URL, fetched time, byte count and SHA-256 for the three unmodified public source files. `data/sun-provenance.json` preserves the owner's upstream source ledger. The browser checks payload bytes against the snapshot manifest before creating entities. Regeneration requires an explicit full source commit:

```sh
python testcode/202609150502/proof/snapshot.py --commit FULL_PUBLIC_SOURCE_COMMIT
```

This is a pinned reproducible snapshot, not a claim of real-time data. Counts, status totals and capacity totals are computed from the loaded projects. The source total is rounded to three decimals; individual project capacities retain source precision. The sum spans planning, operational, refused and other statuses; it is not operational installed capacity. MW capacity and MWh energy remain separate quantities.

## Seed and null geometry

The default seed is the full selected-day PV Live seed from the Sun owner's `today.json`. `?lens=ring&seed=<64 lowercase hex>&repd_ref=<decimal key>` reproduces the arrangement and selection. Every valid 64-hex seed is supported; malformed values restore the pinned snapshot seed with a notice. Unknown numeric project keys remain in the URL with an explicit missing-record message; malformed keys are removed. Switching lens changes only its lens field; reloading and browser history restore selection and seed.

Positions use a deterministic per-key hash followed by mulberry32 mixing. The ring uses no frame, clock, API order or random source to position projects. It is explicitly non-geographic, including for projects with known coordinates. Null geometry is retained unchanged in data and exposed in the detail panel and the `Coordinates missing` filter. The full record table pages in groups of 40 and is searchable by key or name. Taps with nearly equal nearby candidates show a chooser instead of silently guessing.

Status colours are categorical muted hues, not verdicts. Diameter uses `clamp(3.2 + 0.35 × sqrt(MW), 2, 14)` CSS pixels, enlarged 1.5 times for selection. Missing and zero capacity use the minimum formula size. The thirteenth status uses the shared renderer's neutral slot. The ring border encodes each PV sample clockwise, starting at twelve o'clock: opacity `0.15 + 0.85 × generation / daily peak` (zero for the ratio if the peak is zero). This is a visualization of national generation, not irradiance or output measured at each project.

## Verification

```sh
node testcode/202609150502/proof/self-test.mjs
python testcode/202609150502/proof/publication.py --verify
# Serve the repository root, then run with a Puppeteer module and browser available:
node testcode/202609150502/proof/browser.mjs
python testcode/202609150502/proof/publication.py --verify --base https://globalgrid2050.com/testcode/202609150502/
```

Browser environment: `SOLAR_BASE`, `PUPPETEER_MODULE`, `CHROME_PATH` and `PROOF_DIR` are optional overrides. Browser checks use actual production modules, full data, 1440×900, 430×900 DPR 2, landscape, URL reload, identity across lens changes, all null records, 44 CSS-pixel controls, zero console/page errors, reduced motion, forced no-WebGL2 and corrupted-byte rejection. Reports are JSON with `pass` and non-zero process exit on failure. GitHub Actions preserves reports and screenshots as run artifacts.

The normal page redraws only on interaction or resize; it has no continuous animation. Its performance sample explicitly requests a redraw on each animation frame for five seconds and reports renderer, DPR, frame count, mean FPS and p95 frame duration. A desktop emulated viewport is not a physical phone benchmark; no physical phone or 1 GB device has been tested. This page provides its own Canvas2D fallback because the shared Generator shell's fallback has a separately recorded runtime defect. The shared renderer itself is not modified here.
