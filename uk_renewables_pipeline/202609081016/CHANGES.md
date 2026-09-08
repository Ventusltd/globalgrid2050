# 202609081016

Parent: `202609071221` (tree `36e30da9…`). One feature: **the MAP button on an
offshore wind row says what it opens on, and what it opens on is the offshore cable
engine.**

## What changed in the Atlas, and why this release exists

The MAP button has pointed at the canonical GridAtlas receiver since 202608312037,
read from the engine's published contract, so every row already arrives on whatever
the Atlas root serves. This release is cut against GridAtlas generation
`202609080850` (v9.154), the first composition in which an offshore wind arrival
is answered by a separate engine:

- The onshore engine measures to the nearest mapped substations within 40 km. For an
  array 60 km out at sea that returned another company's offshore platform - Berwick
  Bank was told Neart na Gaoithe's, Hornsea 3 was told Sheringham Shoal's - which is
  an answer to the wrong question, and no radius fixes a wrong question.
- The offshore engine reads NESO's Transmission Entry Capacity and Embedded
  registers, binds the project to the substation it is contracted to connect at,
  draws that connection in gold at whatever distance it is, and frames both ends.
  Hornsea 3 lands on Norwich Main at 123.7 km; Berwick Bank on Branxton at 80.6 km.
- Of the 97 offshore wind rows in the DESNZ register, 38 have a declared substation
  the Atlas can place and draw; 40 have a named site it cannot yet place, mostly
  substations not yet built; 19 are in neither register.

## What this release changes, one file at a time

- `index.html` - states its own identity and loads the v9.9 app.
- `scripts/app-v9-9.js` - the parent's entry, importing the v9.9 projects plugin.
- `scripts/plugins/projects-v9-9.js` - derived from `projects-v9-8.js`, which is left
  byte-identical. One addition: an offshore wind row's MAP cell carries a note saying
  the button opens on the offshore cable engine and what that engine does. No version
  number is printed; the route is read from the engine's contract and a number typed
  here would drift the day the engine moves.
- `tests/run_v9_9.sh` - the runner: pins the parent by tree, proves every inherited
  file byte-identical, rebuilds the interconnector product and requires it not to
  move, checks every REPD MAP href, and parses every script.
- `tests/check_v9_9.mjs` - derived from `check_v9_8.mjs`, which is inherited
  byte-identical; the interconnector proofs are the same and only the release
  identity it asserts moves to this stamp and the v9.9 app.
- `CHANGES.md`, `README.md`.

Everything else - the REPD spine, the v9.8 interconnector product and its pinned
fixtures, every inherited module and style - is the parent's, byte for byte, and
`tests/run_v9_9.sh` fails if any of it moves.
