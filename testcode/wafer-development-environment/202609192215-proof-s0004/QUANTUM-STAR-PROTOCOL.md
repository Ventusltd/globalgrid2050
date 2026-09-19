# Quantum Star Protocol

*How a dot on the wafer is tied to working code. Written 16 September 2026, CPU WORLD. Local until agreed.*

## The two twins

1. **The key.** A permanent integer, given once, in the order the line entered the estate. Never reused, never renumbered. It is the primary identity of both twins. Today: 1 to 342,795; 250,174 in use; 128,369 carried by a function family; 1,736 twin places across 35 repositories.
2. **The code.** The real line the key stands for: `repo, commit, path, line`. It exists in git. It can be read (`read <key>`), opened (the twin link), hashed (`sha1` of the stripped text).

A key without code is dust. Code without a key is not on the wafer. The pair is the star.

## The laws

- **Identity never moves.** Any arrangement (time, apps, floorplan, rings, grid, seed, fuse) is a function `key → (x, y)`. It reads the key; it never writes it. A dot can be anywhere on the screen and still be key 39885.
- **Positions are computed, never stored.** Only keys and twins are stored. A route is an ordered list of keys plus the name of the layout that placed them; that is enough to replay any flight.
- **Coupling is measured, not asserted.** `pipeline/entangle.py` fetches every twin from the local clone at its commit and hashes the line. The rate is a number. Tonight: 128,369 of 128,369. Under 95 % the script refuses to write.
- **Membership, not ownership.** A key may sit in several families and several apps. Every count says "unique" or "memberships". Nothing on the wafer says "owns".
- **A scope is a set with a rule.** app = repo with a working index and more than 20 numbered lines; die = one file; gate = one family (function); version = one timestamped surface. The rule is stored with the set.
- **Every published number comes from a script that can fail.** Keys, routes, engine calls, entanglement: each has a `FAIL` path and writes nothing on failure. A model may label and explain; it is never the source of a number.
- **Colour only when a function happens.** The wafer is black, white and its own dust. Light means something is running, chosen or broken. Pink is reserved for a broken pair.
- **The engine is the instruction set.** `run <module>.<function> {…}` calls ventus-grid-engine's pure functions; the result carries its schema and basis; the code that computed it is lit. Above 100 kW the card says a chartered engineer must sign. The page charts the truth; it is not the engineer.
- **Offline first, agreed before online.** Every version is snapshotted (`pipeline/snapshot.mjs`) with hashes. Nothing is pushed until Vikram and Claude have agreed it and Vikram says push.

## Which twin is primary (Vikram, 16 Sept 2026, 22:05)

The twins are the DNA of the wafer particles. Ironically, the numbered one, the one that carries the primary key,
is the *secondary*: the key exists to name the code, not the other way round. The quantum twin stars are never seen
directly; they are measured through the particle universe. A dot on the wafer is a measurement of a star, not the star.
So: the code is primary, the key is its permanent name, the dot is where a measurement put it, and `entangle` is the
instrument that checks the measurement still agrees with the star.

Electrons are quantum particles (spin-½ fermions with wave-particle duality), which is why the Quantum Twin Star's
language of shells, valence and spin is not decoration: the shells count real callers, and a measurement is a real
projective collapse driven by a seeded generator whose seed, state and count are all on the record.

## Linking: stars as the substrate

A link is never drawn between positions. It is drawn between keys, and each key is a star: an entangled pair
whose code end is real. So a link is a statement about code, not about a picture:

- `connect <a> <b>` (the wafer's beam): two keys, both resolvable. The beam moves with any arrangement
  because it is re-drawn from the keys each frame.
- A gate's needs: the family record carries `needs` and `uses` (which functions it calls). A link from gate
  to gate is `first key of A → first key of B`, and it is true only if both twins resolve at their commits.
- A route through the estate is a chain of links; it can be replayed on any layout and checked by `entangle`.
- No link is stored as an edge between dots. Only keys and rules are stored; the edges are computed, like positions.

So the substrate for linking code is the set of entangled stars, and a broken star breaks every link through it,
visibly, in pink.

## What is not yet true

- 121,805 numbered lines have no family, so no gate and no place on the family wafer. The Line Wafer draws them; scopes cannot reach them.
- The star index is dated 2026-09-14 19:55Z; five engine modules were never indexed, two are newer.
- The runners are not registered. The protocol's checks run on this PC by hand until they are.

## Decisions open (Vikram)

1. When a key sits in several families, which twin place is primary: newest commit, first, or all.
2. The wafer's unit: 250,174 numbered lines, or 128,369 in-function lines.
3. Rebuild the star index on every push, or freeze it and date-label the wafer.
