# Quantum Twin — primary key to actual code flights

*testcode/202609162200 · saved 16 September 2026, before the more dangerous tests. Built on the Line Wafer (202609160207) and the Quantum Twin Star (202609142202). Local development lives in a folder called CPU WORLD.*

## What this is

Every numbered line of the estate is drawn once, in the place its own number gives it (r = √key, θ = key × 2.39996).
Each dot is a **star with two twins**:

1. **the key** — a permanent integer, given once, in the order the line entered the estate, never reused;
2. **the actual code** — the real line the key stands for: repository, commit, path, line.

Arrangements move keys around the screen; they never change them. A link is drawn between keys, never between positions.
Coupling is measured, not asserted: `pipeline/entangle.py` fetches every twin from its commit and hashes the line.
On 16 September 2026: **128,369 of 128,369** family-carried blocks reach their real line.

## Fly it

Type in the box at the bottom (a sentence or a command; every sentence shows the command it became):

| type | what happens |
|---|---|
| `block 39885` | the beam flies to line 39,885 (the most-copied line in the estate: `event.stopPropagation();`, 2,568 places) |
| `twin 39885` | its actual code: repo, commit, path, line, and a link to it on GitHub |
| `qubit 39885` | the block as a two-state atom: shells K (same file), L (same repository), M (other repositories); sin²(θ/2) = M/(K+L+M) = P(AWAY) |
| `measure 39885` | one seeded draw with the Quantum Twin Star's own generator (mulberry32 of FNV-1a hash of seed, state, count); collapses to HOME or AWAY; logged as a Born audit |
| `connect 39885 1217` | the beam joins two keys |
| `app gridatlas` / `apps` | 19 apps by the rule "repository with a working index and more than 20 numbered lines" |
| `run voltage-drop.voltageDropVolts {"currentA":120,"lengthM":250,"resistanceOhmPerKm":0.32,"powerFactor":0.95,"phases":"three"}` | real physics: the module is imported live from ventus-grid-engine's published code and answers 15.796 V; a missing power factor is refused, not guessed |
| `entangle` | the measured coupling |
| a sentence | e.g. *what is the voltage drop for 120 amps over 250 metres at 0.32 ohm per km, power factor 0.95, three phase* → the command above |

Above 100 kW every engine card says: a chartered electrical engineer must sign any real design. This page charts the truth; it is not the engineer.

## The numbers (16 September 2026)

- 250,174 numbered lines · keys 1–342,795 · 128,369 carried by a function family · 121,805 not yet
- 10,985 atoms: 143 verbatim from the Quantum Twin Star's `electron.json`, 10,842 derived from family places by the same rule (marked *derived*)
- 1,736 twin places across 35 repositories · entanglement 100 %
- GridAtlas: 10,415 unique blocks in 357 gates across its four cartridges (exact file match; a block may belong to several families)
- engine: 22 pure modules; 15 have code on the wafer; 7 are not yet in the star index
- the hundred tests, machine families 1–6 (keys, engine, routes, twin, server, planner): `HUNDRED-machine.json`

## Files

`index.html`, `app.mjs`, `lib.mjs`, `pick.mjs`, `read.mjs`, `style.css`, `line-index.json`, `proof/` — the Line Wafer, unchanged except the title and the pilot scripts.
`pilot.mjs`, `pilot-rules.js` — the box, the card, the commands, the sentence planner (rules, no model).
`keys.json` (keys, twin place and line, family), `qubit.json` (atoms), `apps.json` (apps and their first lines), `entangle.json` (the measurement).
`pipeline/` — the scripts that made the data, each of which can fail. `QUANTUM-STAR-PROTOCOL.md` — the laws.

Data is read from `../202609142202/data/` (the wafer's numbered database, built 2026-09-14 19:56 UTC).
