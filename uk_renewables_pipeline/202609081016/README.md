# GlobalGrid2050 UK Renewables Pipeline 202609081016 (V9.9)

## Status

Candidate dated 8 September 2026. Parent `202609071221` (V9.8) is the exact frozen
parent; its REPD spine, the v9.8 interconnector product, its fixtures and every
inherited module are carried byte-for-byte and proven so by `tests/run_v9_9.sh`.

**V9.9 is cut against GridAtlas 202609080850 (v9.154), the offshore cable
engine.** An offshore wind row's MAP button opens on it and the cell says so; see
`CHANGES.md` for what the engine does and how much of the register it covers.

## One-feature scope

**INTERCONNECTORS is a tab.** Sixteen GB interconnectors - the ten with a BMRS
code and the six announced without one - appear behind their own technology
button, with the same eleven-column row, gauges, search, paging and CSV export
as every other tab.

They are **not REPD records and are not added to the REPD spine.** ALL TECH is
still the DESNZ register: 7,680 records, 356,474.09 MW. The interconnectors live
in `data/v9.8/`, built deterministically from three inputs pinned as git-blob
bytes in `fixtures/v9.8/` (see `CHANGES.md` for what each gives).

Their MAP link carries the link's own identity - `interconnector=INTNED`,
`technology=interconnector` - against the same canonical Atlas receiver as
every REPD row, and never a `repd_ref`. Where both converters are held the link
opens on the node the Atlas draws mid-line, which is a label anchor and not a
location; where only the GB converter is held it opens there and says so; where
nothing is held the row says NO MAP and why.

## Validate

    bash tests/run_v9_8.sh                     # parity, product rebuild, contract, 7,680 + 16 MAP hrefs
    V9_BROWSER_SMOKE=1 bash tests/run_v9_8.sh  # plus the browser smoke and the phone reachability gate

## Inherited unchanged

The regional news pipeline and its committed ledger (V9.7), the twenty-row
window over the full pipeline, the eleven columns shown at phone width, the
compiled deep-link contract and its verification, and the 7,680-row MAP contract.
