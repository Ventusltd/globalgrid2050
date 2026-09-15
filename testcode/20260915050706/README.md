# Star Generator benchmark review

Reviewed source: `7edc6fbd7f2d19397c6106371e3ce8de0f8c8a5d`, Generator `testcode/202609142225/`.
The owner benchmark started at **2026-09-15T05:03:12.168Z**; this evidence folder was assembled at **05:07:06 UTC**.

## Result

**Full assessment fails.** All 12 lens/viewport cases, both selected-key coordination runs, and the compose recipe checks complete without console/page errors or horizontal overflow. However every 430 px case has a 96 × 32 px root breadcrumb, below the 44 px target rule. Forcing WebGL2 unavailable raises `G.setLit is not a function`; the Generator fallback is not accepted.

The actual renderer was Intel Graphics through ANGLE/D3D11 in Chrome 153.0.8010.37. The NVIDIA sampler watched a separate GPU, so its utilisation is not renderer utilisation. Viewports are 1440 × 900 at DPR1 and 430 × 900 at DPR2 with touch emulation. No physical phone was tested.

The FPS values sample requestAnimationFrame for four seconds idle and four seconds during interaction. They are not sustained device, thermal, memory-budget or phone measurements.

## Evidence and repeatability

- `proof/bench.json` and `proof/bench-table.md`: original measurements with added functional assertions. The report's `pass: true` concerns those functional assertions only.
- `supplemental.json`: post-deploy homepage check and forced WebGL2-unavailable reproduction.
- `assessment.json`: the combined verdict, **`pass: false`**, with the missing target-size and fallback requirements.
- `portable-bench.mjs`: runs the committed owner script with explicit `PUPPETEER_MODULE`, `CHROME_PATH`, `BENCH_BASE` and a new `BENCH_OUT`; never overwrites owner proof. It now includes mobile target size in its gate as well. Measurement calculations are unchanged.
- `reproduce-night.mjs`: requires `PUPPETEER_MODULE`, `CHROME_PATH`, and a new `REPRO_OUT`, with the repository already served at port 8891 for the forced fallback check.
- `assess-bench.mjs`: `node assess-bench.mjs proof/bench.json supplemental.json new-assessment.json`; exits nonzero unless every assessment check is true.

The new Night tests run [34931327051](https://github.com/Ventusltd/globalgrid2050/actions/runs/34931327051) passes 54 checks, with no warnings or skips. The earlier missing Industry Analysis label was observed at 02:03 UTC, before Pages run 34919566055 completed at 02:06:42 UTC. No homepage or test changes were needed to resolve that deployment race.
