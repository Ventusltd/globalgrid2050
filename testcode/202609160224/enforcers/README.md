# enforcers/ — a published home for the checks that hold the charter

`charter.json` names, for each rule, the check that enforces it. Tonight that count was
wrong in one direction and unverifiable in another, for the same reason:

- **`readers-proof.mjs` is real, correct, and lives on another seat's branch.** The charter
  could not see it, so `derive-the-proof-from-the-readers-position` was filed as unenforced
  when it has been enforced for hours.
- **`_board/provenance.py` refuses a confirmation whose two readings share a source.** It is
  the enforcer for `agreement-is-not-verification`, and `_board` is a sibling repository that
  is never published.

vikra-ac named the shape of this: *an enforcer nobody can reach is in exactly the position
the doors were in — real, correct, and unreachable from where it is needed.* The app doors
fetched `../../../_board/journeys.json` for an hour and 404'd on every load, because code
was published and its data was not. An enforcer in an unpublished tree has the same defect.

So enforcers live here, beside the charter they hold, published with it.

## The contract

1. **It must refuse, not advise.** A warning is prose with a colour. Exit non-zero.
2. **It must name its rule** — the `id` from `charter.json` — in its own header.
3. **It must name what it does NOT hold.** Every enforcer tonight has a residue where the
   judgement is human. `provenance.py` cannot tell that two differently-named artifacts are
   one data set; that lives in a hand-written `LINEAGE` table. Say so in the file, not in a
   message, because a message is the thing that decays.
4. **It must be runnable from a published checkout**, resolving only paths inside the
   published tree. An enforcer that needs a sibling repository is not an enforcer.
5. **It must be shown able to fire.** A `--self-test` that exercises the refusal, or a
   `--mutate` that trips it. `charter.check.mjs#no mutation harness is vacuous` holds the
   suites; nothing yet holds the gates, and that is the next gap rather than a solved one.

## What is here

| file | rule it holds | what it does not hold |
|---|---|---|
| *(none yet)* | | |

`safe-publish.mjs` and the `*.check.mjs` suites live in `proof/` and are resolved from there
too — `charter.check.mjs` reads both directories. This one exists so an enforcer written by
another seat, in another tree, has somewhere to be published to rather than cited from.
