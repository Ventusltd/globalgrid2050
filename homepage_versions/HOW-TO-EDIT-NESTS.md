# How to edit the homepage nests by hand (no AI needed)

The public homepage is `index.html`. The menu is built by the function `build()` and
**every nest is exactly one line** of that function, near lines 175-180. Each line starts:

    html += `<details class="area"><summary>NEST NAME</summary> ... </details>`;

The nests appear on the page in the order of those lines.

## Anatomy of one line

| Piece | Markup |
|---|---|
| Nest (top level, `[+] Name`) | `<details class="area"><summary>Name</summary> ROWS </details>` |
| Sub-nest inside a nest | `<details class="area nest"><summary>Name</summary> ROWS </details>` |
| Row (a link) | `<a class="current" href="URL">Title<small>one-line description</small></a>` |

Rows sit between the `<summary>` and the closing `</details>` of their nest or sub-nest.
Nothing else on the page needs to change when a nest, sub-nest or row is added or removed.

## Delete a whole nest (one line)

1. Open https://github.com/Ventusltd/globalgrid2050/blob/main/index.html and press `e`
   (or the pencil icon) to edit in the browser.
2. Press Ctrl+F and search for `<summary>Industry Analysis</summary>` (the nest's name).
   The whole nest, with all its rows, is that single line.
3. Click anywhere on the line, press Home, then Shift+Down, then Delete. The line is gone.
4. Press "Commit changes", write `homepage: remove the X nest`, commit directly to `main`.
5. GitHub Pages redeploys in about 10 minutes. Check globalgrid2050.com in a private window.

## Delete one row inside a nest

On the nest's line, select from `<a class="current" href="...URL OF THE ROW..."` up to and
including its `</a>`, and delete that. Leave the surrounding `<details>` and `</details>` alone.

## Add a row

Paste `<a class="current" href="URL">Title<small>description</small></a>` immediately before
the `</details>` that closes the nest (or sub-nest) it belongs to. Use straight quotes.

## Add a nest

Copy a whole nest line, paste it after the nest it should follow, change the name, replace the rows.

## Two things that must stay true

- The mission paragraph in `<header>` and the disclaimer in the footer are never changed.
- If `testcode/ci/checks.json` has a check whose `must_contain` names the nest you removed,
  delete that check block too (the night tests would otherwise fail on the missing words).

## Restore point

Git keeps every version: the "History" button on `index.html` shows each edit, and any
commit can be reverted. The numbered snapshots in this folder (`homepage_vNNN.html` with a
`-measurement.json`) are the convention agents follow before editing; for a one-line change
done by hand, the commit itself is the restore point.

Worked example: v116 (commit `eae901b3`, 2026-09-15) removed the Industry Analysis nest by
deleting one line; commit `75781be8` withdrew its night-test check.
