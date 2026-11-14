# 202611140247 (V9.19)

Parent: `202611140223` (V9.18, release candidate), tree `0edd36f51365f9f5b7cdca2927c7e78c4615e41d`.

The register, every data byte, every script in this folder and the MAP link of every row are the
parent's (all 7,775 hrefs identical). One change:

1. **Chart.js pinned.** The page loaded `https://cdn.jsdelivr.net/npm/chart.js`, which serves whatever npm
   calls latest, with no integrity check: an inherited fault noted in every version since 202609082224.
   The script tag is now the one first made in 202610290230: version 4.5.1, the exact file
   `dist/chart.umd.min.js`, with its SHA-384 as Subresource Integrity, `crossorigin="anonymous"` and
   `referrerpolicy="no-referrer"`. 4.5.1 is the version the V9 pages were built and tested with. If the
   CDN serves other bytes the browser refuses the script and the three gauges stay empty; nothing else
   depends on it.
2. **Test.** A browser probe requires the charting library to have loaded (run where the public internet
   is reachable, that is in CI).
3. **Labels and runner.** V9.19 labels; `tests/run_v9_19.sh` + `tests/check_v9_19.mjs`.

The release candidate remains 202611140223 (V9.18) until it has been checked on the live site.
