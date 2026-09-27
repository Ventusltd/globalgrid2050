# Road build (layer pack)

A road-build simulation for our 3D worlds, packaged to the world layer pack contract `world.pack.v1`. It takes a
design road line and builds the road in stages, section by section, showing the order of work and the quantities
that line implies. **The simulation is illustrative.** The output rates, build-ups and drainage rules are typical
assumed values, so this is not a programme, a method statement or a design. A designer must confirm every value
for a real scheme.

## How this helps our 3D worlds

- **You can see the build happen where the road will be.** Switch on "Road build", type `road play`, and the fronts
  move along the line on the world's own ground: strip topsoil, cut and fill to formation, geotextile, sub-base,
  compaction, surface course, compaction again, then swales and culverts. Each stage is drawn in its own colour.
- **The quantities come from the world's own earthworks rules.** The design level follows the ground with the same
  grade points and vertical curves as the world's road cartridge. The batters use the same rule as the shared
  earthworks engine (`batterZ`), so a road in this pack and a road in the world agree on where a batter meets the ground.
- **The checks show up while you walk the site.** The HUD shows the stage, the volumes, the steepest gradient
  against its limit, the cross-fall and any length in cut too flat to drain.
- **It is a layer and nothing more.** It is pinned by hash, loaded only when switched on or typed, and kept within its
  vertex budget. When it is paused or finished it asks for no frames, so a still world draws at 0 fps.
- **Machinery packs can join in without importing anything.** At the start of each stage the pack emits
  `roads/task` with the machines that stage needs. As the front moves it emits `roads/progress` with the chainage,
  position and heading. A machinery pack can drive its excavator, trucks and rollers from these events and send
  `machinery/pace` back to speed a stage up or slow it down.

## The stages

| # | Stage | Quantity | Illustrative rate |
|---|---|---|---|
| 1 | `strip` | topsoil over the footprint plus a 0.5 m margin each side, 0.30 m deep | 60 m3/h |
| 2 | `earthworks` | cut plus fill from stripped ground to formation, batters 1 in 2 to daylight | 80 m3/h |
| 3 | `geotextile` | carriageway width x 3D length | 400 m2/h |
| 4 | `sub-base` | 0.25 m (gravel) or 0.15 m (tarmac) x width x length | 50 m3/h |
| 5 | `compact-sub-base` | area x 6 passes | 3000 m2 passes/h |
| 6 | `surface` | 0.10 m x width x length | 40 m3/h |
| 7 | `compact-surface` | area x 6 passes | 3000 m2 passes/h |
| 8 | `drainage` | swales (0.4 m deep, sides 1 in 3) along runs in cut, and 4 h for each culvert | hours |

Quantities between sections use the average end area method, with a section every 2 m by default. The carriageway
and each side are sampled separately, so the carriageway areas are exact. A batter toe is counted in whole 0.1 m
samples. Each front advances in proportion to the work done, so it moves slowly through heavy cut.

## Sources and assumed values

- Cross-fall of 2.5 % on a bound surface: DMRB CD 109. Cross-fall of 4 % on an unbound surface: assumed.
- Maximum gradient of 10 %: an assumed limit for heavy vehicles on a site access road.
- Unbound sub-base to Specification for Highway Works Series 800, clause 803. Bound mixtures are named as in BS EN 13108-1.
  The build-up thicknesses are assumed light-duty values.
- Compaction passes are assumed. SHW Series 800, Table 8/1, sets real values by roller and layer thickness.
- Topsoil depth, batters, working margin, swale shape, culvert rule, output rates, the 10-hour day and the 0.5 %
  minimum fall in cut are all assumed, for illustration.
- Known simplifications: sections are square to the segment they fall on, so bends are approximate. Topsoil is not
  put back on the batters. Geotextile laps, haul and bulking are not counted, so the volumes are bank measure.

## Commands and keys

```
road play · road pause · road toggle · road step · road reset · road speed 2
road stage earthworks        (or road stage 2)
road line 0 0 100 20 200 20  (the design line, in local metres)
road width 5 · road surface tarmac
road report · road check
```

`Shift+r` plays or pauses the build. `road step` completes the current stage and pauses.

## Settings from the world's pin

`config` may give `path`, `width`, `surface` (`gravel` or `tarmac`), `fall` (`crown`, `left` or `right`),
`crossfall`, `maxGradient`, `fillSlope`, `cutSlope`, `topsoil`, `margin`, `section`, `passes`, `hoursPerDay`,
`playSeconds` (how long a full build plays at speed 1, default 60 s), `speed`, and `play: true` to start playing.
A bad value stops the pack at start-up, and its status says which value is wrong.

## Events

| Event | Payload |
|---|---|
| `roads/stage` | `{ stage, index, title }` when a stage starts |
| `roads/task` | `{ stage, title, machines, from, to, quantity, unit, hours }` for machinery packs |
| `roads/progress` | `{ stage, chainage, x, y, z, heading, complete }` each metre the front moves |
| `roads/done` | `{ hours, length }` |
| listens `machinery/pace` | `{ stage, factor }` with a factor above 0 and at most 10, which multiplies that stage's rate |

## Files

| Path | What it is |
|---|---|
| `pack.json` | The contract: id, version, kind, entry, hash, provides, budget |
| `src/roads.mjs` | The entry, one self-contained module. `planRoad`, `frontOf` and `STAGES` are also exported for tests and tools |
| `tests/roads.test.mjs` | Conformance, closed-form volumes on flat ground, and the checks, the sequence, events, pause, budget and commands |
| `catalogue.json` | This pack's entry for the shared catalogue |

## Run the tests

```
node --test
node tests/_testkit/stamp.mjs . --check
```

## Licence

Apache-2.0. The pack holds no third-party data.
