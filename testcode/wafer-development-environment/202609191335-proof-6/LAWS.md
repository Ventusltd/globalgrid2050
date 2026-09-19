# LAWS: the derivation of every number a body carries

Each law below states what is measured, how it is computed, and what would prove it wrong. A law
that cannot be falsified is not a law and does not belong here. Read [README.md](README.md) first.

Notation: `C(b)` is the ordered list of commit timestamps for body `b`, each with its UTC offset.
`gaps(b)` is the list of intervals between consecutive commits. `refs(b)` is the set of other
bodies `b` references. All logarithms are natural.

---

## L1. The shepherd is computed, never declared

```
shepherd = argmax_b ( |C(b)| / max_b |C(b)|  +  |inbound_refs(b)| / max_b |inbound_refs(b)| )
```

Both terms are normalised to [0, 1] and summed, so neither commit volume nor centrality alone can
crown a body. The shepherd is recomputed on every run and printed with the result.

**Falsified by:** a run that names a shepherd without printing both normalised terms for the top
three candidates.

---

## L2. Semi-major axis `a`: distance from the shepherd

`a` is the shortest reference path from the body to the shepherd in the federation graph, mapped to
the drawable annulus:

```
a = a_min + (a_max - a_min) * (1 - 1 / (1 + hops))
```

Bodies at `hops = 1` sit close in; unreachable bodies (`hops = ∞`) are placed at `a_max` and marked
`detached`. Bodies are never placed at a radius chosen for looks.

**Falsified by:** two bodies with equal `hops` drawn at different radii.

---

## L3. Eccentricity `e`: how erratic the work is

```
e = clamp( stdev(gaps(b)) / median(gaps(b)) , 0, 0.95 )
```

A body committed to on a perfect rhythm has `e = 0` and orbits in a circle. A body worked in bursts
separated by silence has a high `e` and a long, thin orbit, which is the true shape of an
experiment, and should look like one. Bodies with fewer than 3 commits have undefined `e` and are
drawn circular with the flag `e_undefined`, never with a guessed value.

**Falsified by:** any body drawn with an `e` and fewer than 3 commits.

---

## L4. Inclination `i`: divergence from the main line

```
i = 1 - ( |refs(b) ∩ refs(shepherd)| / |refs(b)| )      , |refs(b)| > 0
i = 1                                                    , |refs(b)| = 0
```

A body that depends on what the shepherd depends on lies flat in the plane of the work. A body that
depends on nothing the rest of the estate depends on stands out of the plane, visibly, which is
the point. High inclination is not a fault; it is information.

**Falsified by:** an `i` computed from names rather than from resolved references.

---

## L5. Mass `m`: how much there is

At repository depth, `m` is the sum of tracked file sizes in bytes. At file depth, `m` is counted
lines for text and bytes for binary, and which was used is recorded per body. Mass sets drawn size
on a log scale, `radius ∝ log(1 + m)`, so that one large body cannot hide a hundred small ones.

**Falsified by:** a body whose drawn size does not follow from its recorded `m`.

---

## L6. Resonance `p:q`: locked to the shepherd's rhythm

Let `T(b) = median(gaps(b))` and `T(s)` the same for the shepherd. Take the ratio `r = T(b) / T(s)`
and find the simplest `p/q` with `p, q ≤ 8` such that

```
| r - p/q | / (p/q) <= 0.05
```

If one exists, the body is `resonant` and carries `p:q`. If none does, it is not resonant, and the
run records *no resonance*, never the nearest ratio dressed up as one. A body publishing on the
hour against a shepherd publishing on the hour is `1:1`, and this must be re-measured every run,
because a stopped task looks exactly like a locked one until you check the timestamps.

**Falsified by:** a `p:q` recorded without its residual `| r - p/q | / (p/q)`.

---

## L7. Epoch `t`: where the body was at time *t*

Every element above is a function of the commits up to `t`. With `t` as an axis the belt becomes
space-time: rewind and bodies return to earlier orbits, resonances form and break, dim bodies light
up at the commit that gave them a destination. Positions at time `t` are computed from the commits
at or before `t` only. No interpolation from the present backwards.

**Falsified by:** a body whose position at an earlier `t` was computed using a later commit.

---

## L8. Openness: the only law that judges

A body is `open` when a destination can be resolved *and fetched*: a published page returning 200,
a runnable entry point, a document, or a dataset carrying a licence. The destination is recorded
with the body. Everything else is `dim`.

```
score = count(dim) / count(all)
```

`score` is printed with every run and written to `proof/`. It is expected to start high. A run that
does not print it is not a run.

**Falsified by:** an `open` body whose destination cannot be fetched at the time of the run.

---

## L9. Reproducibility

Two runs over the same commits, on any two machines, must produce identical coordinates for every
body. Every source of variation is therefore fixed and printed: the seed, the tolerance, the
projection, the clamp bounds, and the exact commit range. Where a layout needs randomness, the seed
is derived from the body's own key, so the same body always lands in the same place.

**Falsified by:** one differing coordinate. That is a bug in the run, never a property of the belt.

---

## L10. Reconciliation: the bond grants only what its words grant

Named for Portia's ruling. The bond entitled Shylock to a pound of flesh, and the court held that it
gave him no jot of blood, because the words expressly said flesh. A claim grants what it states. It
does not grant what follows from it by implication, by reasonableness, or by the confidence of
whoever wrote it.

When two records disagree, whether two hosts, two runs, two machines or a document and the estate it
describes, the difference is settled by pinned evidence alone. Not by the more recent record, not by
the more senior machine, not by a summary, and never by a model's judgement.

Every reconciliation returns one of four verdicts:

| verdict | meaning |
|---|---|
| `HONOURED` | the predicates that were actually evaluated were satisfied |
| `OVERREACHED` | the claim asserts more than its evidence grants; the first concrete deviation is named |
| `NOT EVALUATED` | listed, never merely counted, so the remainder becomes a queue of statements to refine |
| `DISCLOSED` | an acknowledged gap, counted separately. Not a demerit, and it never waives a contradiction |

Four rules bind the verdict:

1. `HONOURED` covers only the predicates evaluated. It never implies that surrounding prose, omitted
   runtime behaviour or unsupported physics claims were proved.
2. A layer's own summary is not independent proof of that summary. Cross-check independent
   representations, which is the lesson of the stale manifest.
3. Every result carries the claim text, the parser rule, the source pins, the denominator and the
   evaluated scope, so that any verdict can be followed to an exact field.
4. `DISCLOSED` may never waive an unissued key, a numerical contradiction, or a feature that
   violates the stated contract.

**Falsified by:** a reconciliation resolved by recency, seniority or plausibility rather than by
pinned evidence; a `HONOURED` returned where a predicate was not actually evaluated; or a
`NOT EVALUATED` that gives a count instead of the statements.
