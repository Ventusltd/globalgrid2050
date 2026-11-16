# Global data-centre sample

Twelve source-indexed records across ten countries, retrieved on 16 November
2026. This is a curated global sample, not a worldwide census or a complete
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
entity revisions, retrieval timestamp and HTTP response digests from two bounded
Wikidata API calls. It is a compact source-evidence projection, not an API dump.
The discarded raw responses are not published. The selected entity IDs are
explicitly pinned in that file; updates require review in a new release.

`build.py` is a deterministic offline furnace. Install the local pinned
`requirements.txt` (`duckdb==1.3.2`) and run it from any directory to recreate
the generation/source-partitioned ZSTD Parquet, `pipeline-audit.json`, and
`projects.json`; it performs no fetching. The browser
module loads the JSON, validates its schema, and supports text search and a
country filter. Country keys use Wikidata IDs; missing/deprecated ISO codes stay
null. Failed loads show an unavailable state. Source text is inserted with DOM
`textContent`; outbound links require HTTPS.

Capacity is split into **IT load**, **total site demand**, and **grid connection**
MW. All three are null in this sample because no reviewed measurement of those
specific quantities was imported. They are not interchangeable and are never
summed. Operator strings appear only where an explicit single P137 statement
exists; they are not company-register identity joins. `operating_status` is
`not_assessed` for every record. No source lookup produces `VERIFIED`.

Map links use only nondeprecated, unambiguous Earth P625 coordinates. Three
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
records source and Parquet digests, distinct-key count, zero quarantined rows,
compression, pinned engine, and stage verdicts. Bad rights, classification,
country identity, coordinates or duplicate source IDs fail the whole candidate
before output files change. Such failures require source review rather than
silently dropping records; absent measurements are valid nulls, not errors.

The stable source grain and schema are also available to the separately owned
evidence analytical adapter. No new collection framework or service is added.
The DC output does not join UK REPD or infer company identity. Successful
analytical readback is not verification of the underlying facts or ownership.

Validation (with the pinned DuckDB installed):
`python -m pytest -q automation/news/tests/test_global_datacentres.py`
from repository root; `node global-datacentres/test-model.cjs` from this release.
The interface agent owns tab HTML/CSS and full Playwright interaction checks.
