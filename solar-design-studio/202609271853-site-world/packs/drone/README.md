# Drone (layer pack)

Drone flight for our 3D worlds, as one `world.pack.v1` pack of kind `vehicle`. It includes:

- a light multirotor model with thrust, quadratic drag and wind as a parameter
- hover hold at a set height above the world's ground model
- speed limits
- a legal-height note
- go-to, orbit and lawnmower survey modes, with front and side overlap
- the camera footprint drawn on the ground

The world's own aerial view becomes the pack's `view` mode. In that mode the viewer is the drone, and the pack reports the height above the ground, the height note and the footprint under the viewer.

The flight model is **illustrative**. It does not model any particular aircraft. It is not flight planning and it is not legal advice.

## How this helps our 3D worlds

- **Fly a site the way a survey drone would.** Type `drone launch`, then `drone survey x y x y x y ...` around a boundary. The world draws the lanes, shows the drone flying them and puts its camera footprint on the real ground. The command answers with the number of lanes, the lane spacing, the photo count, the distance and a time estimate.
- **Check height against the ground, not against sea level.** The height hold follows the world's ground model (from LiDAR where the world has it), so the drone climbs with a slope. The HUD flags any height above the 120 m note.
- **See what the wind does.** Set `drone wind 12 270`. The drone tilts into the wind to hold station. Above its top speed it cannot hold, and the HUD says so.
- **Keep the world still when nothing moves.** The pack asks for frames only while a simulated drone is airborne. In view mode the world moves the camera and the pack draws only the height line and the footprint.
- **Stay separate.** The pack is one self-contained module, pinned by hash and loaded only when used. It talks to the world and other packs only through events: `drone/pose`, `drone/survey` and `drone/view`.

## Commands and keys

| Command | What it does |
|---|---|
| `drone launch [x y]` | Takes off where you stand, or at the given point in local metres, and climbs to the hold height (default 30 m) |
| `drone hold <m>` | Sets the height above the ground. Anything above the height note (120 m) or below 2 m is refused |
| `drone hover` | Holds the current position |
| `drone goto <x> <y>` | Flies to a point and stops there |
| `drone speed <m/s>` | Sets the horizontal speed limit, capped at the configured maximum and at the model's top speed |
| `drone wind <m/s> <from deg>` | Sets the wind by speed and the bearing it blows from: 0 is north (+y) and 90 is east (+x) |
| `drone orbit <x> <y> <r> [m/s]` | Circles a point |
| `drone overlap <front %> <side %>` | Sets the survey overlap (default 75/65) |
| `drone survey x1 y1 x2 y2 x3 y3 ...` | Plans and flies a lawnmower survey over the boundary |
| `drone view` | Switches to aerial view as the drone, and switches back when typed again |
| `drone land`, `drone status` | Lands the drone, or reports its state |

| Key | Command |
|---|---|
| `Shift+d` | `drone launch` |
| `Shift+v` | `drone view` |

## The model and what the tests check

**The flight model.** The drone is a point mass with mass *m*. Its thrust vector is limited by a maximum tilt and by a maximum thrust-to-weight ratio. Drag is 0.5 ρ CdA |v−w| (v−w), where *w* is the wind and ρ = 1.225 kg/m³ (the sea-level value of the ISO 2533 standard atmosphere). A PI velocity controller drives the thrust, and its integral term learns the wind. Height is held above the world's ground model. The model steps with semi-implicit Euler at the world's fixed 1/60 s step. It uses no clock and no random numbers, so the same steps always give the same flight.

**Defaults.** These are assumptions for a small multirotor, and each one can be set in the world's pin config:

| Setting | Default |
|---|---|
| Mass | 1.2 kg |
| CdA | 0.03 m² |
| Thrust-to-weight | 2 |
| Maximum tilt | 35° |
| Horizontal speed limit | 15 m/s |
| Climb | 5 m/s |
| Descent | 3 m/s |
| Camera | 73.7° × 53.1° field of view, 5472 px across |

**Pin config.** The keys are `mass`, `cda`, `thrustRatio`, `maxTilt`, `maxSpeed`, `climb`, `descent`, `hold`, `ceiling`, `skids`, `wind: [m/s, from deg]`, `camera: { hfov, vfov, px }`, `overlap: { front, side }` and `launch: [x, y]`. The `ceiling` can be lowered but never raised above 120 m.

**Height note.** The UK drone code for the open category keeps flights below 120 m (400 ft) above the surface. The pack cites this as a note only. Check the current rules before any real flight. The pack does not model visual line of sight, airspace restrictions or distance from people.

**What the tests check.** The tests (`node --test`) compare the simulation with closed-form mechanics and geometry, not with measured flight data:

| Check | Result |
|---|---|
| Hover thrust | Equals the weight *m g* within 0.1% |
| Height hold over a sloping plane | Within 0.05 m |
| Top speed in still air | Within 1% of √(2 m g tan θ / (ρ CdA)): 21.18 m/s and 35° tilt for the defaults |
| Commanded speed limit | Never exceeded by more than 2% |
| Station keeping in a 10 m/s wind | Within 0.1 m, with the tilt equal to atan(drag / weight) within 0.2° |
| Station keeping in a 30 m/s wind | Lost, as it should be |
| Camera footprint | 2 h tan(fov/2) |
| Survey lane spacing | Footprint width × (1 − side overlap) |
| Photo spacing | Footprint length × (1 − front overlap) |
| Survey flight | Flown to its last waypoint |
| Orbit | Radius held within 1 m |

The tests also run the contract check from the test kit. This checks the hash, that the entry is self-contained, the budget, determinism over 240 fixed steps, the HUD labels, the commands, dispose, and that no local paths appear.

These checks show that the model matches its own equations. They do not show that it matches a real aircraft. That would need logged flight data, which this pack does not hold.

**Footprint.** The footprint is sized from the height above the ground directly below the drone, with the camera pointing straight down. Its corners are then placed on the real ground. Over steep ground the true footprint differs.

## Files

| Path | What it is |
|---|---|
| `pack.json` | The contract |
| `src/drone.mjs` | The entry: one self-contained module. It also exports `createDrone`, `planSurvey`, `footprint`, `terminalSpeed` and `windVector` for tests and tools |
| `tests/drone.test.mjs` | The pack's own tests |
| `tests/_testkit/` | The vendored test kit |
| `catalogue.json` | This pack's entry for the shared catalogue |
| `.github/workflows/ci.yml` | CI on CPU only, with 3 jobs (Node 20, 22 and 24) |

## Run the tests

```
node tests/_testkit/stamp.mjs . --check
node --test
```

## Licence

The code is licensed under Apache-2.0. The pack holds no third-party data.
