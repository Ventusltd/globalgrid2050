# Body: walk, run and jump (layer pack)

How the viewer moves on foot in a 3D world: walk, run with Shift held, jump with Space, stand and land on solids,
and an optional footstep camera bob. It is one self-contained module that meets the world layer pack contract,
`world.pack.v1` (kind `body`). The movement model is **illustrative**: it is a simple and plausible model of a person
moving, not a biomechanical simulation.

## How this helps our 3D worlds

Every world gets the same feet. A site can be walked at a real walking pace, crossed at a run, and explored by
jumping onto a table top or a low wall, with the same numbers in every world. The pack is pinned by hash, loads only
when switched on, draws nothing, and needs frames only while the body moves, so a still viewer still costs 0 fps.
Other packs, such as a lens, a drone or a vehicle, can follow the viewer by listening for `body/pose` events. Every key action can also be typed (`jump`, `run on`, `body move 1`).

## What it does

| Action | Input | Numbers |
|---|---|---|
| Walk | move axes (`ctx.input.forward`, `strafe`) or `body move 1` | 1.4 m/s, a preferred adult walking speed in published gait studies (for example J. Appl. Physiol. 100, 2006) |
| Run | Shift held (`ctx.input.run`) or `run on` | the wanted speed builds from 3.5 m/s (a jog) to 6.0 m/s along `1 - exp(-t / 2 s)` |
| Speed up and slow down | automatic | `v(t) = v_want (1 - exp(-t / tau))`, the exponential form measured for sprint starts (Proc. R. Soc. Lond. B 102, 1927); tau 0.6 s up and 0.3 s down are chosen values, not measured |
| Jump | Space (`ctx.input.jump`) or `jump` | gravity 9.81 m/s², take-off 3.0 m/s: apex 0.459 m, 0.612 s in the air; momentum carried, no steering in the air |
| Higher jump | Space held past 0.1 s, or `jump high` | the legs push on until the predicted apex reaches 0.60 m (about 0.22 s of hold) |
| Coyote time | automatic | a jump still starts up to 0.1 s after walking off an edge |
| Press buffer | automatic | a press up to 0.1 s before touchdown jumps again on landing |
| Land on solids | `ctx.solids` boxes | the feet stand on a box top that is at most 5 cm above them; a jump lands on higher tops; sides block and slide |
| Landing dip | automatic | the eye dips about 1.4 cm per m/s of impact (cap 6 cm), critically damped at 45 rad/s |
| Footstep bob | `body bob on` (off by default) | the eye dips up to 2 cm walking and 4 cm running, once per step of 0.7 m to 1.4 m (chosen values) |
| Place | `body at 10 20` | local metres from the site origin |

Coyote time, the press buffer and the hold are choices that make the controls feel fair. They are not physics.

## How a world drives it

The world calls `host.step(dt, ctx)` as usual. The pack reads:

- `ctx.pos`: the world's viewer. The pack starts there, and starts again there when the world moves the viewer more than
  5 m in one step (a Find or a tour).
- `ctx.dir`: the view direction. The body walks where the viewer looks.
- `ctx.heightAt(x, y)`: the measured ground.
- `ctx.solids` (optional): boxes `[{ min, max }]` that the body stands on and cannot pass through.
- `ctx.input` (optional): the held keys `{ forward, strafe, run, jump }`, with move axes from -1 to 1. Without it, the
  typed commands drive the body.

The pack emits `body/pose` `{ pos, yaw, speed, gait, airborne }` whenever the eye moves, plus `body/jumped` and
`body/landed` `{ airTime, apex, vi, onSolid, feet }`. The world moves its camera to `pos`, which is the eye in local
metres.

The contract's keys run a command when a key is pressed. They have no key-up, so "Shift held" and "Space held" reach the
pack through `ctx.input`. This is an addition to the frame context proposed for pack api 1.1. It is optional: a world
on api 1.0 still gets walking by `body move`, running by `run on` and jumping by Space.

## Files

| Path | What it is |
|---|---|
| `pack.json` | The contract: id, kind, entry, hash, commands, keys, events, budget |
| `src/body.mjs` | The entry: one self-contained module. It also exports `createBody` and the constants for tests and tools |
| `tests/` | `node --test`: the conformance check and the pack's own tests against the figures above |
| `catalogue.json` | This pack's entry for the shared catalogue |

## Run the tests

```
node tests/_testkit/stamp.mjs . --check
node --test
```

## Licence

Apache-2.0. The pack holds no third-party data.
