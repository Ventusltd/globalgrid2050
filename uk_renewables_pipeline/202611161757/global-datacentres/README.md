# V9.28 global data-centre source records

Edition `202611161757` transplants the tested successor cohort from producer
`35facd949c033dbf1915cc0f32d7e82b3b49cf22`; historical editions are untouched.
`integration-manifest.json` records exact source commits, paths, Git blobs,
original hashes and served compact hashes. Compaction changes bytes and hashes
but retains every structured source fact. The new edition's obsolete inherited
Parquet at generation `202611161630` is replaced by the freshly built
generation `202611161757`; the historical file remains in its original edition.

Three distinct grains are served, never summed into one facility count:

- `projects.json`: 100 Wikidata source-indexed leads across 22 countries.
- `official-projects.json`: three official UK/US planning-publication or
  tax-qualification records, with their dates and unknown current lifecycle.
- `project-groups.json`: six examined source entities, three provisional
  listed-group associations and three unlinked. No legal ownership, current
  operation, financial amount or site-capacity inference.

The two sidecars are semantic copies of producer `034be1d1` and `6a198894`.
Their original input/cohort hashes intentionally refer to their immutable
producer objects, not the compact served bytes; the integration manifest
provides the explicit byte/semantic bridge. No inferred name-based crosswalk
joins government records to Wikidata. Their own source/rights/review limits
remain intact. The interface owner handles their distinct presentations.

One hundred source-indexed leads across 22 countries, retrieved on 16 November
2026. This is a bounded global sample, not a worldwide census or a complete
development pipeline. It includes buildings/campuses and a research computing
centre as classified in Wikidata; it makes no claim that all records share one
facility granularity. `DC-WD-Q...` identifies a Wikidata source entity, not an
adjudicated physical facility or a UK REPD project.

The data comes from Wikidata structured statements, whose [official copyright
policy](https://www.wikidata.org/wiki/Wikidata:Copyright) releases structured
data under CC0. This permission applies to the structured facts, not linked
articles, photographs or external operator pages. No article text, photos or
third-party directory records are copied. Source attribution is visible in the
tab, and every record links its specific Wikidata revision. CC0 availability is
not an independent verification of source accuracy or present operating status.

`source-facts.json` retains the selected CC0 labels, statement IDs/ranks/values,
entity revisions, retrieval timestamp and HTTP response digests from bounded
Wikidata API calls. It is a compact source-evidence projection, not an API dump.
The discarded raw responses are not published. The selected entity IDs are
explicitly pinned in that file; updates require review in a new release.
The query found 138 English-labelled entities classified as a data centre with
a country, across 31 countries. A deterministic conservative gate retains the
original 12 IDs, then requires new candidates' English descriptions to explicitly
identify a singular data centre and exclude company/organisation/aggregate,
former or ambiguous computing-service descriptions. It retains 100 and records
38 exclusions in `selection-audit.json`. This gate deliberately has false
negatives (for example a current data centre in a former bank is held back).
It does not establish physical-site identity or present operation. English-only
labels, Wikidata omissions and site/campus granularity restrict coverage.

`build.py` is a deterministic offline furnace. Install the local pinned
`requirements.txt` (`duckdb==1.3.2`) and run it from any directory to recreate
the generation/source-partitioned ZSTD Parquet, `pipeline-audit.json`,
`selection-audit.json` and compact `projects.json`; it performs no fetching.
Sidecars are pinned producer outputs and are not rewritten by this furnace.
Country keys use Wikidata IDs; missing/deprecated ISO codes stay null. Consumer
validation and browser integration are separate from this data-build receipt.

Capacity is split into **IT load**, **total site demand**, and **grid connection**
MW. All three are null in this sample because no reviewed measurement of those
specific quantities was imported. They are not interchangeable and are never
summed. Operator strings appear only where an explicit single P137 statement
exists; they are not company-register identity joins. `operating_status` is
`not_assessed` for every record. No source lookup produces `VERIFIED`.

Map links use only nondeprecated, unambiguous Earth P625 coordinates. Sixty-one
records have no coordinates and display “Map unavailable”. The Swiss Fort Knox
source point has coarse stated precision (about 0.13 degrees); its link uses a
wider map view and is explicitly labelled approximate. Precision is retained
as a source attribute, not claimed surveyed accuracy. These are external
OpenStreetMap links; no OSM dataset is ingested or conflated with Wikidata.

## Existing owner inventory and analytical boundary

Before adding this sample, the agent inspected:

- `automation/news/datacentre_feed.py`: headline metadata with optional joins to
  the UK register; not a global project source.
- The existing `uk_renewables_pipeline/datacentres/` page and historical
  convergence output: 226 UK records; source licences recorded as unverified.
  Those records were not copied, joined or relabelled global.
- `Ventusltd/data-centres-gb` commit
  `f9f47286fae63872375c558fc89ff4b1793914e4`, particularly
  `contracts/202608281053-osm-data-centres.json`, its source manifest and
  `docs/data-sources.md`: UK-only OSM candidate, source-grain identity,
  DuckDB 1.3.2/ZSTD Parquet/deterministic readback, conservative company
  abstentions, ODbL attribution, and explicit exclusion of Data Center Map.

The DC furnace reuses that owner discipline: pinned source facts → validate or
quarantine → typed normalization → two byte-identical ZSTD Parquet compiles →
exact DuckDB schema/value/null readback → browser projection. The browser JSON
is built from the readback, not the pre-Parquet records. The successful audit
records source and Parquet digests, distinct-key count, 38 quarantined candidates,
compression, pinned engine, and stage verdicts. Bad rights, classification,
country identity, coordinates or duplicate selected IDs fail the whole candidate
before output files change. Such failures require source review rather than
silently dropping records; absent measurements are valid nulls, not errors.

The stable source grain and schema are also available to the separately owned
evidence analytical adapter. No new collection framework or service is added.
The DC output does not join UK REPD or infer company identity. Successful
analytical readback is not verification of the underlying facts or ownership.

Validation with the pinned DuckDB installed:
`python -m pytest -q automation/news/tests/test_v928_dc_data.py`
from repository root. This covers actual new-edition identities, original twelve
semantic fields, source hashes, nulls, quarantine, deterministic Parquet readback,
separate sidecar grains and edition size. The interface owner separately owns
tab HTML/CSS, model and full Playwright interaction checks.
