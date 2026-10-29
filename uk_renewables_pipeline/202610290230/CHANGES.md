# 202610290230

Parent: `202609082224` (tree `6247a0c3…`). One change: **Chart.js is pinned to
one exact file and checked by Subresource Integrity.**

## Why

The parent loaded `https://cdn.jsdelivr.net/npm/chart.js`. With no version,
jsDelivr serves whatever npm currently calls `latest`, so a dated, frozen
release ran third-party code that could change without any commit in this
repository. It already had: npm `latest` moved from 4.5.1 to 4.6.1 on
22 October 2026, after every V9.x page had been built and tested. There was
no `integrity` attribute, so the browser would also have run any bytes the CDN
returned. Found by the privacy and supply-chain audit of 29 October 2026
(correction C2).

## What changes

The script tag is now:

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"
            integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ"
            crossorigin="anonymous" referrerpolicy="no-referrer"></script>

- **4.5.1** is what the unversioned URL served while V9.0 to V9.10 were built
  and tested, so this release keeps the tested library rather than adopting a
  week-old one. `dist/chart.umd.min.js` is the file the package's own
  `jsdelivr` field names, so the unversioned URL and this one served the same
  file.
- The hash is the SHA-384 of that file in the npm tarball, which `npm pack`
  verified against the registry integrity
  `sha512-GIjfiT9dbmHRiYi6Nl2yFCq7kkwdkp1W/lp2J99rX0yo9tgJGn3lKQATztIjb5tVtevcBtIdICNWqlq5+E8/Pw==`.
  The file contains no network calls.
- `crossorigin="anonymous"` is required for SRI on a cross-origin script.
  `referrerpolicy="no-referrer"` stops this page's address being sent to the
  CDN with the request.
- If the CDN ever serves different bytes, the browser refuses the script. The
  gauges then stay empty (both gauge plugins already handle a missing
  `Chart`), and the table, news, search, export and MAP links still work.

The page's identity lines move to V9.11 / 202610290230, and the nav gains a
link back to V9.10.

## What this release changes, one file at a time

- `index.html`: the Chart.js tag, the identity lines and one nav link.
- `tests/run_v9_11.sh`, `tests/check_v9_11.mjs`: the runner and the check.
  The check is `check_v9_10.mjs` with the parent moved to 202609082224, the
  identity assertions moved to V9.11, and the external-script assertions added.
- `CHANGES.md`, `README.md`.
- Removed: `tests/run_v9_10.sh`, `tests/check_v9_10.mjs`. They assert V9.10's
  identity and parent, so inside this folder they could only fail.

Everything else is the parent's byte for byte, and `tests/run_v9_11.sh` fails
if any of it moves or if an unnamed file appears.

## Not changed here

- The news file is still read from `raw.githubusercontent.com` on mutable
  `main` (audit correction C3). That is a separate change.
- This release is a candidate. The homepage still points at 202609082224
  until the owner accepts this one.
