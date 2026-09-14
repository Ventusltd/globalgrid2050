# GLOBALGRID2050 Spider universe: ten local versions (shared spec)

Requested by Vikram, 2026-09-14 13:36 UTC: "release at least 10 local versions for me to see of the Spider universe
within globalgrid2050.com that charts the entire unique code via function blocks."

Each version is ONE self-contained `index.html` in its own folder here. It opens by double-click (file://) or from
any static server, and reads LIVE data over https. No build step, no install. External scripts only from
https://cdnjs.cloudflare.com (pinned exact versions) if a version needs a library, such as d3; plain JS is preferred.

## Live data (all served with Access-Control-Allow-Origin: *; measured 13:36 UTC)

| What | URL | Shape |
|---|---|---|
| Blocks (207) | https://ventusltd.github.io/stars/blocks/blocks.json | `{blocks:[{symbol, number, title, category, description, functions, named_functions, depends_on, used_by, repos, files, state, kind}]}` (inspect; some fields are lists of objects) |
| Block → families | https://ventusltd.github.io/stars/blocks/families.json | `{"Si":[5166, 5167, …], …}` |
| Family index | https://ventusltd.github.io/stars/code/index.json | `{families:10811, bucket_size:500, buckets:159, lines:247856}` |
| Family records | https://ventusltd.github.io/stars/code/f/<bucket>.json, where bucket = floor(n / 500) | `{"<n>": {n, names[], kind, standalone, needs[], lines[] (permanent line numbers, in order), uses[{family,name}], used_by[{family,name}], places[{repo, commit, path, first, last, name, live}], repos[], files, versions, first_written}}`. Each bucket is about 200–850 KB; fetch it only when opened, then cache it. |
| Name search | https://ventusltd.github.io/stars/code/names.json | `{"effectiveGap":[2, 9, 1241], …}` |
| Line text | https://raw.githubusercontent.com/<repo>/<commit>/<path> | take lines `first..last` of the first place; the i-th source line pairs with `lines[i]`, its permanent number |
| Block page | https://ventusltd.github.io/stars/table.html?block=<Sym> | |
| Function page | https://ventusltd.github.io/stars/code.html?family=<n> | |
| File at commit | https://github.com/<repo>/blob/<commit>/<path>#L<first>-L<last> | |
| Live page | `places[].live` when non-null | never guess a URL |

Check each shape against the live file before relying on it, and fail visibly with a plain sentence if a fetch fails.

## Every version must

1. **Chart the whole unique code by function blocks.** The top view shows all 207 blocks grouped by category, with
   arrows for block depends-on block. The total counts (207 blocks, 10,811 families, 247,856 lines) are on screen,
   read from the data.
2. **The 360-degree journey, all by clicks:** block → its families → a family's numbered lines (text fetched when
   opened) → arrows to the families it uses and that use it, and to other families sharing a line number when that is
   cheap to compute → their blocks → the live page or file at commit → back. A breadcrumb or back control is
   always visible.
3. **Arrows that say what they are:** contains, depends on, uses, used by, shared line. Each type has its own colour,
   and a legend is shown.
4. **Not overload the page:** never render more than about 400 labelled elements at once. Everything below the
   block level is loaded lazily.
5. Work at 430 px wide (phone) and on desktop, with mouse and touch.
6. Look like the Spider dashboard: dark ground #0b0d12, text #d8dee9, accent #00e5ff, monospace, the heading
   "GLOBALGRID2050". Plain business English. No names of people.
7. A footer line: version id, UTC build time, the data URLs used.
8. Search box: type a function name → jump to its family (names.json).

## The ten versions (one visual idea each)

| id | idea |
|---|---|
| v01-spider-drill | the dashboard's own idiom: focus card in the centre, dependencies left, dependents right, drill in by tap |
| v02-radial-sunburst | categories → blocks → families as rings; click a segment to zoom; lines open in a side panel |
| v03-particle-universe | canvas: blocks as stars sized by family count, families as orbiting particles when a block is opened; arrows as light threads |
| v04-periodic-arrows | the periodic table grid of 207 tiles with depends-on arrows overlaid on hover or tap; tile → families → lines |
| v05-chord-dependencies | chord diagram of block-to-block dependencies by category; click a block arc to drill in |
| v06-treemap-lines | treemap of categories → blocks → families, sized by numbered line count; click to zoom; lines at the leaf |
| v07-flow-repos | flow (Sankey-style) from repositories → blocks → families; click a band to follow it |
| v08-ring-journey | the 360-degree ring: blocks around a circle with arrows across it; open a block and its families form an inner ring; lines form the core |
| v09-line-river | a family's numbered lines as a vertical river, with arcs to other families sharing lines and to uses and used-by; the block overview is a compact grid |
| v10-ide-search | search-first IDE: a code pane with numbered lines, a relationship pane (uses, used by, shared lines, block), and a block navigator |

Also write `index.html` in this folder: a launcher that lists all ten, each with a one-line description and a link.
