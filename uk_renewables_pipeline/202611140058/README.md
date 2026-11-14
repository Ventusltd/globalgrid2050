# GlobalGrid2050 UK Renewables Pipeline 202611140058 (V9.13)

## Status

Release dated 14 November 2026. Parent `202611132345` (V9.12, the October 2026 candidate the
homepage was first pointed at) is the exact parent. **V9.13 is the same REPD October 2026
(Q3 2026) register - 7,775 records, 365,474.49 MW, byte for byte the parent's `data/v9.1` -
under a release label instead of a candidate label, with the CSV source-count fix from the
start.** The identity and coordinate fixtures are not copied: the contract
`contracts/release.v9.1.json` is the parent's, byte for byte, and binds the parent's
`fixtures/2026q3/` by path and sha256. Everything is proven by `tests/run_v9_13.sh`. See
`CHANGES.md`. The text below is the scope inherited through V9.12 and V9.10, still true.

**V9.10 bounds the ACTIONS column so a sentence cannot widen it**, and removes
the offshore sentence V9.9 printed on every offshore row. The MAP link is
unchanged: every row opens the canonical Atlas receiver, and an offshore row
still arrives on the offshore cable engine in GridAtlas 202609080850.

## One-feature scope

**INTERCONNECTORS is a tab.** Sixteen GB interconnectors - the ten with a BMRS
code and the six announced without one - appear behind their own technology
button, with the same eleven-column row, gauges, search, paging and CSV export
as every other tab.

They are **not REPD records and are not added to the REPD spine.** ALL TECH is
still the DESNZ register: 7,775 records, 365,474.49 MW (REPD Q3 2026). The interconnectors live
in `data/v9.8/`, built deterministically from three inputs pinned as git-blob
bytes in `fixtures/v9.8/` (see `CHANGES.md` for what each gives).

Their MAP link carries the link's own identity - `interconnector=INTNED`,
`technology=interconnector` - against the same canonical Atlas receiver as
every REPD row, and never a `repd_ref`. Where both converters are held the link
opens on the node the Atlas draws mid-line, which is a label anchor and not a
location; where only the GB converter is held it opens there and says so; where
nothing is held the row says NO MAP and why.

## Validate

    bash tests/run_v9_13.sh                    # parent tree, byte parity, spine + interconnector rebuild, page loader, all MAP hrefs, CSV text
    REPD_XLSX=REPD_Publication_Q3_2026.xlsx bash tests/run_v9_13.sh   # plus the coordinate fixture rebuilt from the workbook

## Inherited unchanged

The regional news pipeline and its committed ledger (V9.7), the twenty-row
window over the full pipeline, the eleven columns shown at phone width, the
compiled deep-link contract and its verification, and the 7,680-row MAP contract.
