# Grids (layer pack)

Grid layers for our 3D worlds. The pack draws overhead lines with catenary sag and conductor bundles by voltage class,
towers standing on the measured ground, substations as fenced compounds, underground cable routes, and a load-flow
colouring hook. It is one self-contained ES module that meets the world layer pack contract `world.pack.v1`
(`kind: layer`, lazy, hash-pinned).

**Illustrative.** Tower shapes and heights, insulator lengths, bundle sizes, compound sizes and the sag are typical
values proportioned by eye. They are not surveyed and they are not a design of any real line. A clearance is a
distance at the assumed sag and is never a pass or fail against any rule. Loadings are whatever the flow data says,
because this pack draws a load flow and does not solve one. The world adds `(illustrative)` to every HUD line from this pack.

## How this helps our 3D worlds

- **The grid in place.** A viewer walking, driving or flying through a world sees the lines, towers, compounds and cable
  routes where they stand, drawn on the same ground as everything else, with the lowest conductor height shown.
- **Voltage classes kept apart.** The classes are 400, 275, 220, 132, 66, 33 and 11 kV. Each one has its own
  structures, bundle and colour. A kV maps to the nearest class on a log scale, so 400 and 275 never merge, and
  33 and 11 never merge either. Each class can be shown or hidden alone (`grids show 400 132`, `grids hide 11`).
- **The same colours as the map.** Line colours follow the grid map palette: 400 blue, 275 red, 220 orange,
  132 green, 66 purple and 11 magenta. The map has no 33 kV line colour, so 33 kV uses cyan, which is this pack's choice.
  The world's built-in grid layer uses softer colours and puts 132 kV in amber. Deciding which palette wins is
  left to the owner.
- **Load flow on the lines.** `grids flow on` (or `Shift+g`) recolours conductors and cables by loading, from green
  through amber at 80 % to red at 100 % and over. A line with no loading is grey. Loadings come from the world's single-line
  diagram through the `world/flow` event, from a hashed flow file, or from the command line.
- **Walkers and vehicles are blocked.** Towers and compounds are solids, so nobody walks, drives or flies through them.
- **Cheap to carry.** Only the area within 5 km of the viewer is built (`grids radius`). Bundles and full lattice
  are drawn within 1.5 km and single wires beyond. Geometry is rebuilt only when the data, the ground, the settings or
  the viewer's 250 m cell change. The pack never asks for frames, so a still world draws at 0 fps.

## Commands and keys

| Typed | Does |
|---|---|
| `grids` or `grids info` | What is loaded |
| `grids demo` | Loads an anonymous demo network on open test land, with one line of each class, compounds, a cable and demo loadings |
| `grids show <kV...>` / `grids hide <kV...>` / `grids show all` | Shows or hides voltage classes |
| `grids flow on` / `off` / `toggle` / `clear` | Load-flow colours |
| `grids flow <id> <percent>` | Sets one line's or cable's loading |
| `grids sag <percent>` / `grids sag class` | Assumed mid-span sag as a share of span, from 1 to 8 for every class, or each class's own (the default: 3.5 % at 220 kV and above, 2.5 % below) |
| `grids radius <m>` | The drawing radius, 500 to 20000 m |
| `grids clear` | Removes the network |
| `Shift+g` | `grids flow toggle` |

## Configuration (the world's pin `config`)

```json
{ "network": { "path": "data/grid-network.json", "sha256": "<64 hex>" },
  "flow":    { "path": "data/grid-flow.json",    "sha256": "<64 hex>" },
  "show": [400, 275, 132], "sagPercent": 3.5, "radius": 5000, "flowOn": false }
```

`inline` (a network object) or `demo: true` can stand in for `network`. Files are fetched only through the world's
hash check (`api.fetchJSON`).

### Network file, `grids.network.v1`

```json
{ "format": "grids.network.v1", "crs": "local", "licence": "...", "attribution": "...",
  "lines":       [{ "id": "L1", "kv": 400, "towers": [[x, y], ...], "circuits": 2, "bundle": 4, "sagPercent": 3.5 }],
  "substations": [{ "id": "S1", "kv": 132, "at": [x, y], "size": [90, 60] }],
  "cables":      [{ "id": "C1", "kv": 132, "points": [[x, y], ...] }] }
```

`crs` is `local` (metres from the site origin) or `national` (grid metres, turned into local metres with
`api.origin()` and rebuilt when the world sends `world/origin`). Unusable entries are skipped and named in the log.

### Flow data, `grids.flow.v1`

```json
{ "format": "grids.flow.v1", "lines": [{ "id": "L1", "loading": 0.82 }, { "id": "L2", "percent": 95 }, { "id": "C1", "mw": 120, "ratingMW": 160 }] }
```

The same payload can arrive as the world event `world/flow`. That event is proposed for pack api 1.1 and is not in
1.0. Until the world emits it, a flow file or the command line carries the loadings.

## Events

| Event | Payload |
|---|---|
| `grids/summary` (emits) | `{ lines, towers, substations, cables, classes }` when a network loads |
| `grids/overload` (emits) | `{ id, loading }` once when a line or cable reaches 100 % of its rating (illustrative) |
| `world/origin`, `world/flow` (hears) | Rebuild on a new origin; new loadings |

## How it works

- **Sag.** Each span is a catenary with parameter `a = H / w`. It is solved so that the equivalent level span sags
  the assumed share of its length, and it passes exactly through both attachment points, however unequal their
  heights. The tests compare it with the exact level-span formula and with the parabolic approximation `L² / 8a`.
- **Towers on measured ground.** Every lattice leg's foot is placed at the world's ground height under that foot, and
  the body is built from the ground under the tower's centre. Poles stand at the ground under them.
- **Clearance.** The lowest sub-conductor is sampled every 2 m along each span and compared with the ground beneath it.
  On flat ground at the demo spans, the default sag leaves between about 6 and 9.5 m, depending on class. That is
  a result of the assumed shapes and sag, not a statement about any real line.

## Files

| Path | What it is |
|---|---|
| `pack.json` | The contract |
| `src/grids.mjs` | The entry, one self-contained module with no imports |
| `tests/grids.test.mjs` | Conformance, and checks of the maths and behaviour |
| `tests/_testkit/` | The vendored test kit |
| `catalogue.json` | This pack's entry for the shared catalogue |

## Run the tests

```
node tests/_testkit/stamp.mjs . --check
node --test
```

## Licence

Apache-2.0. The pack holds no third-party data. The demo network is invented.
