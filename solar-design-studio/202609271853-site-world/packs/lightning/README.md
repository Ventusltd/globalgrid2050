# Lightning (layer pack)

An **illustrative** lightning simulation for our 3D site worlds, packaged to the world layer pack contract
(`world.pack.v1`). It draws four things:

1. **A strike map.** It starts from ground flash density Ng (flashes per km² per year). The default of 0.5 is a typical lowland UK
   value and is only an editable assumption: take the site's value from the national annex map of IEC 62305-2, or use
   Ng = 0.1 × thunderstorm days. For each object it gives the IEC 62305-2 collection area AD, the location factor CD and the
   expected flashes per year ND = Ng × AD × CD × 10⁻⁶. It also gives a sphere-model share of the flashes for each ground cell.
2. **The rolling-sphere method.** The sphere radius is set by lightning protection level, following IEC 62305-3 (I 20 m,
   II 30 m, III 45 m, IV 60 m). The sphere rolls over the terrain and over the tables, stations and towers. Blue crosses mark ground the sphere
   does not touch. Amber and red crosses mark raised points it does touch. Red vertical lines mark the sides of tall objects
   it touches.
3. **An animated strike.** A stepped leader descends, makes its final jump and is followed by the return stroke. The peak current comes from a seeded
   log-normal model, with a 50 % value of 20 kA and a 5 % value of 90 kA, which are the first negative stroke percentiles tabulated in
   IEC 62305-1 Annex A. The striking distance is r = 10 I^0.65.
4. **Equipotential rings.** These are drawn only when the strike point lies on a known earthing grid. The rings are the radii where the ground
   potential falls to 50, 25, 10 and 5 % of the grid potential rise. They use an equivalent hemisphere of the grid's resistance in uniform soil,
   and they assume the whole stroke current enters that one grid.

**This is a picture to reason with.** It is not a lightning protection design, a risk assessment or an earthing study, and it never
states that anything is protected or safe. The sphere model works on a height field, so it cannot see overhangs. Its
side touches are resolved only to the cell size. The rings use a textbook hemisphere, not the real grid geometry or layered soil. For
real work, use the standards themselves and a competent designer.

## How this helps our 3D worlds

- The pack shows *where* lightning is most likely to terminate on a site, in the same view that shows the terrain and the arrays.
  It covers tables, stations and towers. You can walk up to them and look at them from any angle.
- It switches the protection level, flash density or area with one typed command and redraws the map, so it is easy to
  compare options in a review. (`lightning lpl II`, `lightning ng 0.8`).
- It shows a strike landing where the electro-geometric model sends it, on terrain from the world's own ground,
  and shows what happens around an earthing grid when the earthing layer is present.
- It loads as a lazy, hash-pinned layer. It draws nothing until switched on, and it asks for frames only during the few
  seconds of a strike. When it is still, the world returns to 0 fps.

## Use

| Typed | Does |
|---|---|
| `lightning map [I-IV]` | Rolls the sphere over the area (a square round you, 160 m by default) and draws the map |
| `lightning lpl III` | Sets the protection level (sphere radius) |
| `lightning ng 0.5` | Sets ground flash density, flashes per km² per year |
| `lightning area 200` or `lightning area x0 y0 x1 y1` | Sets the area in local metres |
| `lightning add tower x y h` | Adds a mast or tower |
| `lightning add table x0 y0 x1 y1 h`, `lightning add station ...` | Adds a box (lower-left corner first) |
| `lightning strike [x y [kA]]` | Shows an illustrative strike. With no position, the leader position and the current come from the seeded generator |
| `lightning report` | Lists AD, CD, ND and the sphere-model share for each object |
| `lightning seed 7`, `lightning clear` | Sets the seed; clears added objects, the map and the strike |
| `Shift+l` | `lightning strike` |

Towers the world knows (`api.towers()`, national coordinates) are placed in local metres from the site origin. Their
height is assumed to be 25 m unless the world gives one, and the report says so.

### Settings in the world's pin (`config`)

`ng` or `thunderDays`, `lpl`, `seed`, `side`, `area` `{ min, max }`, `cell` (metres), `towerHeight`, `cloud` (height of
the drawn leader start above the tip, 600 m by default, shortened for viewing), `objects`
`[{ kind, name?, x, y, h } | { kind, name?, min, max, h, cd? }]`, `earthing` (as below), `map: true`, `strike: { x, y, kA }`.

### Events

| Event | Payload |
|---|---|
| emits `lightning/strike` | `{ x, y, peakKA, illustrative: true }` when the return stroke happens |
| emits `lightning/exposure` | `{ level, radius, ng, cell, cells, untouched, sideExposed }` after each map |
| emits `lightning/need-earthing` | Asked once at start, so that an earthing pack can answer |
| listens `earthing/grid` | `{ grids: [{ id, min: [x, y], max: [x, y], resistance, rho }] }` in local metres, ohms and ohm metres |

## Tests

```
node tests/_testkit/stamp.mjs . --check
node --test
```

The tests check the contract with the vendored test kit and then the physics against published or closed-form figures. They check the
IEC 62305-3 radii and their agreement with r = 10 I^0.65 at the IEC 62305-1 minimum currents, and the IEC 62305-2 collection area. They check
the current model's percentiles, and the untouched ground radius √(H(2r − H)) round a mast. They check side touches from height r on a tall
structure, and the hemisphere electrode resistance ρ/(2πa) with its 1/r potential. They also check seeded determinism and the command answers.

## Licence

Apache-2.0. The pack holds no third-party data. Standards are cited by number only.
