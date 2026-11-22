# V9.71 — Retire redundant REPD maximise control

Immutable V9.70 successor. The V9.60 top-right ↗ "Maximise REPD dashboard" control, its landscape-only rotation prompt, and its stylesheet are no longer loaded. The original old files remain archived for rollback and audit.

The newer EXPANDED REPD VIEW launcher and all of its Chromium/WebKit-tested features remain exactly as V9.70: full-screen portrait/landscape, native colours, 100 rows, sorting, MAP after Project, A4 at far right and native GridAtlas navigation. Normal REPD gauges, project table and reports are unchanged.

Browser acceptance asserts absence of `#pnRepdWideToggle` and `#pnRepdWidePrompt`, exactly one `#pnLiquidLaunch`, and inherits MAP/A4/rotation/restoration checks in both engines. No code changes to `repd-expanded.mjs`, project renderer, GridAtlas receiver or A4 modules.
