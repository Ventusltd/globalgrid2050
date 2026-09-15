# Sector Star — testcode/202609150125

A phone-first page and three JSON files describing **prospects by sector**: the real-economy energy
users among active England and Wales companies whose latest filed accounts show profit, balance
sheet net worth or cash of £1,000,000 or more. 135,064 companies, aggregated by UK SIC 2007 sector
and by postcode district.

Open: <https://globalgrid2050.com/testcode/202609150125/>
Read the modelling summary first: [MODEL.md](MODEL.md).

## What the star is

- `data/sectors.json` — counts, shares, medians and (where allowed) sums of profit, net worth, cash,
  wages and employees for 21 SIC sections, 87 divisions and 258 groups, plus the filed SECR energy
  subset. Four sector categories are flagged: farmers and growers, manufacturers, other high energy
  users, and the rest.
- `data/geography.json` — the same population by region, county, postcode area and postcode district
  with its public centroid, by straight-line distance band from HA4, and by DNO / network region.
- `data/provenance.json` — sources and fetch times, the qualifying rule, the suppression rules and
  their tallies, counts in and out, the leak-check result, and the sha256 of each data file.
- `index.html` + `star.js` + `style.css` — three lenses (map, sector, energy) that compute every
  number from the JSON at run time.

## What the star is not

- It is **not a customer list**. No company name, registration number, address line, full postcode,
  telephone number, e-mail address or Companies House link appears in any file in this folder.
- It is **not a per-company dataset**. Only aggregates are published. There is no maximum and no
  top-N of any money figure anywhere.
- It is **not an energy survey**. 23 of 135,064 companies filed a SECR energy figure. Those medians
  describe the filers and nothing else.
- It is **not a site map**. A district count is where companies are registered, not where they draw
  power.
- Its England regions are approximated from postcode area letters, not ONS boundaries, and its
  distances are great-circle miles, not drive times.

## Suppression rules

One function, `cell()` in `proof/build.py`, applies all of them:

- any cell (a sector, a place, or a sector inside a place) with **fewer than 5 companies** is
  withheld, shown as "withheld (n < 5)", and its members are folded into "other";
- a **sum** is published only where **at least 10** companies contribute, the sum is positive, and
  the **largest single contributor is under 50%** of it; otherwise the count and median stand alone;
- a **maximum or a top-N is never published**.

This build withheld 4,347 cells and 584 sums; the exact tallies are in
`data/provenance.json → suppression.tally`.

## Deterministic techniques

Defined once, checkable by CI, Ollama, Codex or Claude without re-reading the private source:

1. the suppression rule is **one function** in `proof/build.py`; nothing else in the pipeline withholds;
2. every withheld cell is **counted**, and the counts are published in `provenance.json`;
3. every data file carries its **source, fetch time and sha256**;
4. **all counts on the page are computed from the JSON at run time** — no number is typed into the HTML;
5. **URLs carry only permanent keys**: `?lens=map|sector|energy&district=<outcode>&sector=<SIC code>`,
   for example `?district=HA4&sector=01`;
6. **no randomness at all** — neither `proof/build.py` nor `star.js` contains any random source, and
   the map lens has no jitter, so two builds of the same input give byte-identical output;
7. `publication.json` lists **bytes and sha256 for every shipped file**;
8. `proof/leak-check.py` runs over every public file in this folder and its output is committed as
   `proof/leak-check.json`; it fails the build (non-zero exit) on any hit;
9. `proof/ci-checks.json` states what the served page must and must not contain, so the
   testcode-proof workflow can re-run the same assertions on every push.

## The leak check

`python proof/leak-check.py` reads every file in this folder except its own output and asserts:

- no `LIMITED`, `LTD`, `PLC` or `LLP` as a word;
- no 8-digit number (a company registration number);
- no UK full postcode;
- no `http` outside the allowed hosts (globalgrid2050.com, ventusltd.github.io, postcodes.io,
  gov.uk and Companies House documentation);
- no `@`;
- and — the strongest test — that **no company name string from the private source appears in any
  public file**, checked against every name in the source's name column.

Its committed result is in `proof/leak-check.json`.

## Rebuilding

`python proof/build.py` reads the private Ventus Companies House working set by absolute path and
rewrites `data/`. The script is public and embeds no data. The private source is never copied here.

## Links to the sibling stars

Using the estate's relationship words, not marketing words (see `data/provenance.json → links`):
**shared line** with the Quantum Twin Star, **uses** the Star Generator's legend and count sentence,
**used by** the Sun Star's supply-side figures, **entangled** with the grid engine's relational map,
**depends on** postcodes.io for every centroid, region and county.
