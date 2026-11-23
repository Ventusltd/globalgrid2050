# V9.75 native REPD integration contract

Product: Pipeline News REPD official register / Operator MW / Status MW / Region MW.
Canonical original source: V9.74 immutable `uk_renewables_pipeline/202611231400/`.
Accepted successor: `uk_renewables_pipeline/202611231600/`; 344 inherited files preserved,
only 7 reviewed modifications and 1 added browser test. No original CSS/REPD data/MAP/A4/PDF/VICINITY modifications.

Single source of truth: `state.filtered` from original `projects-v9-8.js`
supplies all three gauges, project table, source CSV and report rows. Native status
buttons and all official status, operator and region dropdown selectors coordinate
and persist URL state. Report group button filters original table and gauges.

Operator grouping: exact reviewed spellings only, in `operator-aliases.mjs`.
`Low Carbon`, `Low Carbon Ltd`, `Low Carbon Limited` present under displayed
`Low Carbon`; never rewrite source REPD strings, infer legal ownership, merge
different source REPD references or conflate source solar MWp with other MW.

Source code is composed by fail-closed Python `build_v975.py`, checked by
`verify_v975.py`; 7,775-source Node reconciliations and six Chromium/WebKit
viewport matrices; old MAP/A4/PDF/VICINITY/expanded regressions. Release must
not replace published V9.74/73, and homepage ownership is independent.

Neural coordination: https://github.com/Ventusltd/neural-link-between-agents/issues/83
Functional source PR: https://github.com/Ventusltd/globalgrid2050/pull/232
Colour/SCADA Lane B PR #228 is separate, no cross-merge.
Python/browser check: https://github.com/Ventusltd/globalgrid2050/actions/runs/45215406100
Exact bot source commit: 9ef75ea538c95e4501d80854cfaace0cd297d765.
