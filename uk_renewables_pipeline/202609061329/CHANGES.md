# 202609061329

Parent: `202609061149`. Built around the oracle, `testcode/202609051531`, and
CI-tested against all 7,680 REPD records before it was allowed to deploy.

## The seven columns come back on a phone

Measured on the parent at 393 px: COUNTY, OPERATOR, REPD REF, GLOBALGRID REF
and REPD UPDATED all computed `display:none`. `pipelinenews_intelligence/
202608312339` shows thirteen columns on the same viewport.

Cause: v7.css hides every `.hide-mobile` cell below 768 px. V9.6.1 overrode
that with `.tablewrap .hide-mobile { display: table-cell; }` and 202609051100
removed the override again - leaving only the **comment** describing it. The
rule is real again. The table scrolls sideways inside `.tablewrap`, which
already carries `overflow-x:auto`; the page itself never widens, and the smoke
asserts both at 390, 430, 440 and 768 px.

## Every MAP button fires like the oracle - all 7,680, not a sample

`tests/check_map_contract_all_rows.mjs` imports the page's own
`buildAtlasDeepLinkV9_7` - not a re-implementation - and builds the href for
every record:

    7,680 of 7,680 rows build a firing href to ventusltd.github.io/gridatlas/atlas/
    7,652 arrive on the register's own point
       28 resolve by REPD ref alone (no published coordinate; none invented)

Each href must carry exactly the row's `repd_ref` and `technology`, put THAT
row's coordinates in only when the geometry is valid, and target the canonical
receiver and nothing else. The oracle's button sends the same identity keys;
both shapes were fired at both receivers on 2026-09-06 - 20 arrivals, 20
answers - so the receiver resolves identity from `repd_ref` alone.

The browser smoke then takes a sample of MAP hrefs **from the rendered table**
and requires the grid engine to answer on each: "answer" means the card states
`Nearest <n> kV substation:`. A project name on screen proves only that a card
was built.

## Carried from the parent, unchanged

Twenty rows a page, largest first; partitions cached (`cache: "default"`);
7,680 of 7,680 records in the pipeline; the release names itself in its title.
