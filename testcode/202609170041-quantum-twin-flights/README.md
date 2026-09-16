# Quantum Twin — primary key to actual code

*testcode/202609162200 · 16 September 2026. Built on the Line Wafer (202609160207) and the Quantum Twin Star (202609142202).*

## What this page is

Every numbered line of code in the estate is drawn once, as one dot, in the place its own number gives it.

Each dot is tied to two things:

1. **a key** — a number given once to that line, in order, and never reused;
2. **the code** — the real line in a real repository, at a known commit and line number.

Rearranging the dots on the screen never changes the keys. Any link drawn is a link between two keys, not between two positions.

The tie between key and code is checked, not assumed. A script fetches every line from its commit and records the result.
On 16 September 2026, 128,369 of 128,369 keys carried by a function family were found at their recorded line.

## How to use it

Type in the box at the bottom. You can type a command, or a plain sentence; the page shows the command your sentence became.

| you type | what happens |
|---|---|
| `block 39885` | the beam moves to line 39,885 and the wafer's panel shows what it is |
| `twin 39885` | the real code behind it: repository, commit, file, line, with a link |
| `state 39885` | the block's two states, HOME and AWAY, from where its callers sit: K same directory, L same repository, M other repositories; P(AWAY) = M ÷ (K+L+M) |
| `measure 39885` | one recorded draw settles the block to HOME or AWAY; the same seed, block and count always give the same result |
| `connect 39885 1217` | the beam joins two lines |
| `apps` / `app gridatlas` | the 19 apps on the wafer (a repository with a working index and more than 20 numbered lines) |
| `run voltage-drop.voltageDropVolts {"currentA":120,"lengthM":250,"resistanceOhmPerKm":0.32,"powerFactor":0.95,"phases":"three"}` | a real calculation from the published Ventus Grid Engine: 15.796 V; a missing input is refused, not guessed |
| `entangle` | the recorded key-to-code check |
| a sentence | e.g. *voltage drop for 120 A over 250 m at 0.32 ohm per km, power factor 0.95, three phase* |

Above 100 kW, every calculation card states that a chartered electrical engineer must sign any real design. This page shows figures; it is not the engineer.

## Figures on this page (16 September 2026)

- 250,174 numbered lines; keys 1 to 342,795; 128,369 carried by a function family; 121,805 not yet
- 10,985 block families with a state: 143 taken as published in the Quantum Twin Star's data; 10,842 estimated from where their copies sit, and labelled as estimates
- 1,736 code locations across 35 repositories; key-to-code check 100 %
- GridAtlas: 10,415 distinct blocks in 357 families across its four cartridge files (a block may belong to several families)
- Ventus Grid Engine: 22 modules; 15 have code on this wafer; 7 are not yet in the index
- 60 automated checks pass: `HUNDRED-machine.json`

## Files

`index.html`, `app.mjs`, `lib.mjs`, `pick.mjs`, `read.mjs`, `style.css`, `line-index.json`, `proof/` — the Line Wafer, unchanged apart from the title and two script tags.
`pilot.mjs`, `pilot-rules.js` — the command box, the cards, and the sentence rules (no language model).
`keys.json`, `qubit.json`, `apps.json`, `entangle.json` — the data behind the commands.
`pipeline/` — the scripts that produced the data; each one fails rather than writing a wrong file. `QUANTUM-STAR-PROTOCOL.md` — the rules this page follows.

Data is read from `../202609142202/data/`, built 2026-09-14 19:56 UTC.

## For teachers

Free to use, for learners of any age, one to one hundred and twenty. The wafer shows real code, real physics and real grid data; every figure traces to a script that can fail and to a line at a commit. No account, no cost, no tracking. Attribution: Ventus Ltd, GlobalGrid2050.
