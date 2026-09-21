# Enumeration for the Kuiper

One program. It takes every module class in the feed, sweeps the whole box of
designs around them on a graphics card, and writes only what survives.

| | |
|---|---|
| `sweep_hot_cold.py` | the sweep: the mathematics, the code, then plain English, in that order |
| `sweep_results.json` | what one run found, with its space, its coverage and its provenance flags |

    python sweep_hot_cold.py --feed <the class feed>

No path is compiled in. With no feed it refuses; a missing key in the feed also
refuses. A missing input is never a zero.

## What it enumerates

**The hot-current surface.** Voltage is assessed cold and current is assessed
hot, because cold raises open-circuit voltage and heat raises current. The sweep
also repeats the current question at the cold point, to count how many answers
that one mistake changes and in which direction.

**The bifacial current chain, per family, kept apart.** One family's document
defines the irradiance condition behind its rear-side column. The other names
the column and defines no condition for it. So the rear gains are read from each
family's own sheet and the result is reported as a band, never a point, and
never shared across families. Borrowing one family's condition for the other is
the trap this split exists to prevent.

**The series envelope.** For each class, the most modules that can stand in
series under the equipment rating at the coldest cell temperature in the box,
with the remaining margin given twice: in volts, and in degrees of further cold
that margin is worth. Degrees are the form somebody can act on.

## What one run found

Nine and a half billion cases, ten classes, in under three seconds on one card.
Zero partings.

- **Judging current at the cold point changes no verdict that rests on a limit
  printed in a document.** Not because the distinction does not matter, but
  because the only sourced current limit, the module fuse, does not fire
  anywhere in the box. Every verdict the distinction does change is decided by a
  number with no source, and every one of them moves the same way: the cold
  assessment understates the current and flatters the design.
- **Two of the four limits are one predicate written twice.** One fires when the
  current exceeds a constant; the other when twice the current exceeds twice
  that constant. The counts are equal case for case. They are not two checks.
- **One class sits under two degrees from the equipment rating** at the series
  count it can carry, where its four siblings sit eight to sixteen degrees away.
  A margin stated only in volts hides that; stated in degrees it does not.

## The rules this program does not bend

Every quantity is computed twice, along a factored route and its distributive
expansion, and the two are compared on the **verdict**, not the digits. The
kernel is compiled with `--fmad=false` and never with `--use_fast_math`, which
would let the compiler fold the two routes into one and report agreement it had
manufactured. On a disagreement the run **aborts**. It does not log the
disagreement beside the word success, because that is a disagreement nobody
reads.

A limit with no source may be enumerated. It may not be published as a finding.
Every count that rests only on such a number is reported under a name that says
so.

Evaluations live and die in registers on the card. Only the counters reach the
drive.

## The honest limit

Agreement between two routes written here proves consistency, never truth. Both
can be wrong in the same way, and a second route that inherits a mistake from
the first will confirm it forever.

Zero partings is the expected result of this arithmetic, not evidence that the
arithmetic is sound: the two routes do differ, by about one unit in the last
place of a double, and no case in this box lands close enough to a limit for
that last bit to flip an answer.

Coverage of the lattice is not coverage of the box, and coverage of the box is
not coverage of the world. Halve the step and every count changes; that is
geometry. A count of evaluations is not a count of cases covered.

Nothing here is a connection offer, a constructability assessment or a
consenting design, and no output of it is engineering. No cable, diode, machine,
tracker or wiring loss is modelled. No maker, brand, model, site, client or
project is named in this directory or in anything it writes.
