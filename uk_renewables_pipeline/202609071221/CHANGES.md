# 202609071221

Parent: `202609061329` (tree `42f0ebde…`). One feature: **INTERCONNECTORS is a tab.**

## What the tab is, and what it is not

The REPD is a register of generation and storage planning applications. An
interconnector is in it nowhere - it is not a generator, it has two ends, and its
connection is already known: the thing at the other end of its own cable. So the
sixteen GB interconnectors are **not added to the REPD spine.** ALL TECH is still
the DESNZ register - 7,680 records, 356,474.09 MW - pinned by contract and by every
gate in this release, and the v9.1 spine manifest is byte-identical to the parent's.

The interconnectors are their own pinned data product, `data/v9.8/`, behind their
own tab. The count line on that tab reads *"16 of 16 interconnector records
(outside the REPD spine)"* so a reader never mistakes them for REPD rows.

## The data, pinned

Three inputs, copied into `fixtures/v9.8/` as git-blob bytes and never fetched:

| input | from | what it gives |
| --- | --- | --- |
| `interconnector_cables.csv` | `Ventusltd/data-interconnectors` @ `1e00d0e` | BMRS code, country, name, capacity, status, target year: 10 operational, 6 future |
| `interconnector-endpoints.json` | `Ventusltd/gridatlas` @ `7910d92` | GB converter for all 10 operational links from our own substation payload; far converter from OpenStreetMap for 2 |
| `interconnectors.geojson` | `Ventusltd/gridatlas` @ `7910d92` | the two drawable straight lines and the nodes the Atlas draws |

`scripts/build/interconnectors-v9-8.mjs` builds the product deterministically -
no timestamps - and the runner rebuilds it and requires `git diff` to be empty.

    16 records · 17,950 MW · 10 operational · 6 future
    geometry: 2 both converters · 8 GB converter only · 6 none held

## What a coordinate means on this tab

- **Both converters known** (BritNed 234.9 km, ElecLink 59.93 km): the record
  carries the node the Atlas draws at the middle of the line. That is a **label
  anchor, not a location** - a BritNed midpoint is in the North Sea - and the
  record says so (`anchor_kind: MIDPOINT_LABEL_ANCHOR`). Measured while building:
  the drawn node is the planar mean of the converter coordinates and sits 1.44 km
  from the great-circle midpoint on BritNed; both are recorded, the drawn one is
  used, so the link and the map agree.
- **GB converter only** (8 links): the record carries the GB converter and says
  the far end is not yet held.
- **Nothing held** (6 future links): no coordinate, `NO MAP` with the reason in
  the row - the same discipline as the 28 REPD rows without a coordinate.

## The MAP link

An interconnector has no REPD reference, so its link carries the link's own
identity and never `repd_ref`:

    https://ventusltd.github.io/gridatlas/atlas/?interconnector=INTNED&technology=interconnector
      &project=BritNed&capacity_mw=1000&anchor=midpoint&latitude=51.69895&longitude=2.36873&zoom=7

Same canonical receiver as every REPD row, from the same compiled deep-link
contract; no second route. The Atlas's interconnector module reads
`interconnector=` and fires its span model at both converters -
`40km <- Grain --[ BritNed 234.9 km ]-- Maasvlakte -> 40km` - rather than measuring
from the sea. That receiver behaviour ships in gridatlas v9.146; the live route
runs whatever `atlas/current.json` names, which is the owner's promotion.

## Gates

- `tests/check_v9_8.mjs`: the product is what the fixtures build (rebuilt in memory
  and compared record for record); every MAP link built with the page's own
  function carries the BMRS code, the technology, THIS record's coordinate only
  when it holds one, and no `repd_ref`; the REPD spine is 7,680 and untouched;
  the page carries the tab and loads the v9.8 app.
- `tests/browser_smoke_v9_8.mjs`: everything v9.7 asserted, plus: click the tab,
  16 rows, `data-total` 16, gauges 17,950 / 16 / 2,000, ten MAP links and six
  honest NO MAPs, then back to ALL TECH and 7,680 again.
- `tests/run_v9_8.sh`: parent tree pinned; `data/` and `fixtures/` byte-identical
  to the parent except `v9.8`; every inherited module byte-identical, including
  `projects-v9-5-1.js` - v9.8 derives `projects-v9-8.js` from it and leaves the
  original untouched.

## Not claimed

No operator is named for any interconnector: the reference list does not carry
one and nothing here invents one. Eight far-end converters are not yet located.
The rows carry no news signal, because news signals are REPD-bound by contract.
