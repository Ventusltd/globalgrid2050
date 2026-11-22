# V9.70 — Expanded MAP navigation parity

This immutable successor fixes V9.69's expanded MAP mirror while retaining the exact native REPD presentation, second MAP column, far-right A4, portrait/landscape access, 100 rows, sort controls and black/cyan colours.

- Expanded MAP now resolves the latest real native link on every source change and immediately before activation, instead of preserving an early pre-enrichment URL.
- Coarse-pointer devices use the same-tab / browser Back policy of the original MAP; desktop uses the native target.
- The original far-right MAP source and A4 report remain untouched; normal REPD remains unchanged.
- WebKit and Chromium test real MAP destinations in normal and expanded view, plus late URL enrichment; no fake click-only pass.
- Earlier versions are unmodified for rollback.
