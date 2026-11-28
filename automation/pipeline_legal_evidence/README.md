# Pipeline News legal evidence

The current Pipeline News release uses `legalEvidenceURL` in the individual project A4 report and its PDF. The URL carries the canonical REPD reference, source edition and available project context. Interconnector reference rows have no legal action.

Run `node uk_renewables_pipeline/202611280922/tests/a4-legal-model.mjs` to check every REPD identity. Run `python uk_renewables_pipeline/202611280922/tests/a4-legal-evidence.py` with Playwright, Chromium and pypdf for the normal and expanded register, A4 preview, printed sheet and PDF download. Set `CHROME_BIN` to use an installed Chromium. Add `--origin https://globalgrid2050.com --open-reader` to exercise the published route and reader.

The original row renderer, installer and preview are retained for reproducing V9.77.
