# MODEL.md — the essence for GLOBALGRID2050 modelling

Sector Star, testcode/202609150125. Every figure here is read from `data/sectors.json`,
`data/geography.json` or `data/provenance.json`; the JSON field is named after each statement so a
model can take the number from the file rather than from this page. No company is named or
identifiable anywhere in this folder.

## 1. How many real-economy companies there are

The population is every active England and Wales company whose latest filed accounts show profit,
balance sheet net worth **or** cash of £1,000,000 or more: **135,064** companies
(`provenance.json → counts.rows_read_from_source`, `sectors.json → population`).

By sector category (`sectors.json → categories[]`):

| category | companies | share | rule |
|---|---:|---:|---|
| Farmers and growers | 3,868 | 2.9% | SIC 2007 divisions 01 and 03 |
| Manufacturers | 11,487 | 8.5% | SIC 2007 divisions 10–33 |
| Other high energy users | 27,569 | 20.4% | 05–09, 35, 36–39, 41–43, 49–53, 55–56, 86, 93, group 63.1 |
| Rest of the population | 92,140 | 68.2% | every other division, including 02 forestry |

The "rest" is large because the qualifying rule catches balance sheets as well as trade: real estate
(division 68, 25,322) and financial services (division 64, 13,892) together are nearly 29% of the
population. A behind-the-meter demand model should use the three named categories, not the total.

## 2. Where they are

By region (`geography.json → regions[]`; England regions are approximated from postcode area
letters, Wales from the postcodes.io country field — see `region_basis`):

London 38,819 · South East 19,578 · North West 14,598 · East of England 13,644 ·
West Midlands 11,123 · South West 11,085 · Yorkshire and The Humber 10,241 ·
East Midlands 8,140 · Wales 4,164 · North East 3,358.

2,137 postcode districts are published (`geography.json → districts[]`); 326 companies sit in
districts holding fewer than 5 and are withheld (`districts_withheld_n_lt_5`), and one district of
124 companies is withdrawn from publication at the author's request (`districts_removed`).

**Where farmers cluster** (counts only, `districts[].categories.farmers`): TA1 47, YO25 43, PE12 31,
ME13 28, SO23 26, SG8 24. The pattern is Somerset, the East Riding, the Fens, north Kent and the
Hampshire/Cambridgeshire arable belt — none of it inside London.

**Where manufacturers cluster** (`districts[].categories.manufacturers`): LE4 55, S9 52, BB1 40,
B98 37, NW10 34, ST4 32 — Leicester, Sheffield, Blackburn, Redditch, Park Royal and Stoke.

**Other high energy users** are concentrated where the head offices are: W1W 146, N3 142, SE1 140,
HA1 116, EC2A 109. This is a registered-office effect, not a site-load effect, and a model must not
read those London counts as London demand.

## 3. What the filed energy data says

Only **23** of 135,064 companies have a Streamlined Energy and Carbon Reporting energy figure in the
accounts this build read, and 17 have a carbon figure (`provenance.json → counts.filing_secr_energy`,
`counts.filing_co2`). The overall median is **5,310,792 kWh**
(`sectors.json → secr_overall_median_kwh`).

This is a **filed subset, not the population**. At category level only "rest" clears the n ≥ 5 bar
(median 3,657,096 kWh); farmers file none, manufacturers 2, other high energy users 4, so every one
of those cells is withheld. No total kWh or tCO2e passes the sum rule anywhere. The honest reading
is: SECR coverage in this working set is too thin to estimate sector energy, and the medians must
not be multiplied by the counts.

## 4. The picture within 100 miles of London Central

By straight-line distance from the WC2N outcode centroid — London Central, Charing Cross
(`geography.json → distance_bands[]`):

| band | companies | farmers | manufacturers | other high energy |
|---|---:|---:|---:|---:|
| 0–25 miles | 44,862 | 33 | 1,123 | 8,038 |
| 25–50 miles | 15,130 | 256 | 1,070 | 3,027 |
| 50–100 miles | 23,113 | 845 | 2,165 | 4,527 |
| over 100 miles | 51,459 | 1,239 | 5,000 | 10,571 |

83,105 companies — 62% of those placed — sit within 100 miles of Charing Cross, and the farmers
share of each band's farmers-plus-manufacturers mix climbs from 2.9% in the 0–25 band to 28.1% in
the 50–100 band before easing to 19.9% beyond it.

Read that table with its stated basis (`geography.json → distance_bands_basis`). The origin of the
bands moved to Charing Cross after the build, so `proof/rebase-origin.py` re-cut them from the
district centroids already published here rather than from the private source. Two consequences,
both counted rather than smoothed over: the table places the 134,564 companies that sit in a
published district, not all 135,064 — the other 500 are in districts withheld at n < 5 (326), in the
one district withdrawn from publication (124) or have no postcode (50) — and each category column sums published district cells only, so the 5,132
companies whose district category cell was withheld at n < 5 sit in `folded_into_other` instead of a
column. That falls hardest on farmers, who are thinly spread across many districts, so the farmers
column reads low against the 3,868 farmers in the population. Band medians are not derivable from
aggregates and are null until the next build. `python proof/build.py` restores the full-population
cut from the source.

Network regions (`geography.json → grid_regions`) are counts only and cover a 526-company routed
subset of the London area and its surroundings out to about 100 miles, not the population, and not
re-cut around the current origin: UKPN 227, NGED 175, National Grid transmission 62, SSEN 31.

## 5. What this data cannot say

- **No site electricity data for almost anyone.** 23 SECR filings is 0.017% of the population.
- **No customer names, no addresses.** Company names, registration numbers, address lines, full
  postcodes, telephone numbers and links are withheld from every file here. Locations are postcode
  districts and their public centroids only.
- **Registered office, not site.** A postcode district counts where a company is registered. Large
  multi-site operators appear once, at their office.
- **One SIC code per company.** Only the first SIC code is used; 22,938 companies carry a second.
- **Regions are approximate.** England regions come from postcode area letters, not ONS boundaries.
- **Distances are straight lines**, not drive times.
- **No maximum, no top-N, no per-company row** is published, so the tail cannot be reconstructed.

## 6. Modelling inputs GLOBALGRID2050 can take from this

1. **Behind-the-meter demand by district** — `geography.json → districts[].categories.{farmers,
   manufacturers,other_high_energy}` with `districts[].lat/lon`: counts per 2,137 districts, ready to
   be multiplied by a per-company load assumption per category.
2. **Distance-banded addressable set** — `geography.json → distance_bands[]`: 83,105 placed companies
   inside 100 miles of Charing Cross for a service-radius or deployment-cost model, on the coverage
   stated in `distance_bands_basis`.
3. **Sector tariff assumptions** — `sectors.json → divisions[].net_worth_gbp.median` and
   `.cash_gbp.median`: an ability-to-fund proxy per SIC division, published wherever n ≥ 5.
4. **Capital pool by sector** — `sectors.json → divisions[].net_worth_gbp.sum` where the sum rule
   allows it (1,641 sums published, 584 withheld): a ceiling on sector-level investment capacity.
5. **Payroll intensity as a site-activity proxy** — `sectors.json → divisions[].wages_gbp` and
   `.employees`: distinguishes trading operations from balance-sheet-only entities.
6. **Energy prior for a sector** — `sectors.json → sections[].secr.energy_kwh.median` with
   `n_filing_energy`: use as a weak prior only, with the n attached; never as a population mean.
7. **Network-region weighting** — `geography.json → grid_regions.dno[]`: relative DNO exposure for a
   connection-queue or curtailment model, counts only.
8. **Rural/urban split** — `geography.json → regions[].categories.farmers` against
   `.other_high_energy`: separates land-based load from office-registered load.
9. **County-level aggregation** — `geography.json → counties[]` (166 published): a coarser cell when
   district counts are too thin.
10. **Suppression-aware totals** — `provenance.json → suppression.tally`: 4,347 withheld cells and
    584 withheld sums, so a model can bound how much of the population its aggregation is missing.
