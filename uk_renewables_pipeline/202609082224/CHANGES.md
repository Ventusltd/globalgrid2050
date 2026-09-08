# 202609082224

Parent: `202609081016` (tree `f9fd82e0…`). Two changes, both to the ACTIONS
column: **the sentence under MAP is removed, and the column is bounded so no
sentence can widen it again.**

## The column was taking the table

Reported on a phone: ACTIONS had grown to most of the width of the table and
pushed every other column off-screen. A table cell is sized by its widest
content, and the notes under MAP are sentences. `.project-actions .map-note` is
`flex: 1 0 100%`, so it fills its flex row - but nothing bounded that row, so it
grew to whatever the sentence wanted and the column grew with it.

`styles/v9-10.css` bounds the cell and lets the sentence wrap inside it. The cap
sits above the width of MAP, NEWS and COPY ID side by side, so the 44 px touch
targets v9.6.1 established are untouched.

## The offshore sentence is removed

V9.9 printed, on every offshore wind row: *"Opens on the offshore cable engine…"*
It was the same sentence on every one of those rows, it was the longest thing in
the column, and it explained the Atlas's behaviour in a table about projects. The
Atlas says what it did on arrival, which is where that belongs.

Removing it makes this release's app exactly the parent-of-v9.9's: `index.html`
loads `scripts/app-v9-8.js` again, and `scripts/app-v9-9.js` and
`scripts/plugins/projects-v9-9.js` are deleted rather than left as dead files.
The inherited note that does carry information - *"REPD published no coordinate
for this record…"*, on 28 rows - stays, and now wraps inside the bounded column.

Nothing about the MAP link itself changes: every row still opens the canonical
Atlas receiver, and an offshore row still arrives on the offshore cable engine
against GridAtlas 202609080850.

## What this release changes, one file at a time

- `index.html` - states its own identity, loads `app-v9-8.js`, adds the stylesheet.
- `styles/v9-10.css` - new; the bounded ACTIONS column.
- `tests/run_v9_10.sh`, `tests/check_v9_10.mjs` - the runner and the identity check.
- `CHANGES.md`, `README.md`.
- Removed: `scripts/app-v9-9.js`, `scripts/plugins/projects-v9-9.js`,
  `tests/run_v9_9.sh`, `tests/check_v9_9.mjs`.

Everything else - the REPD spine, the interconnector product and its pinned
fixtures, every inherited module and style - is the parent's byte for byte, and
`tests/run_v9_10.sh` fails if any of it moves.
