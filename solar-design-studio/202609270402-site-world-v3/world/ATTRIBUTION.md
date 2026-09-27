# Attribution and licences: the world

The world's own code is MIT (see `LICENSE` at the repository root, copyright Ventus Ltd). That licence
covers the code Ventus wrote. It does not cover third-party data the world reads, stores or shows. That
data keeps its own terms, and no Ventus licence can grant rights over it. This follows the GridAtlas
`NOTICE`: "A licence granted here over material that was never the licensor's to grant would be worth
nothing to the adopter who relied on it."

**On-screen rule (the GridAtlas pattern).** The page shows the required lines as small print at the
bottom of the About / help panel. It shows only the lines for layers that are actually loaded, read from
`data/attribution.json`. Each source name links to its licence. OS and OSM require the line to be
legible and in a conspicuous position, and OSM also requires it to be visible long enough to read. A
line hidden two clicks deep does not meet that. Keep the small print inside the panel, and show a
one-line credit on first arrival.

**Footer.** Along the bottom of the screen,
one line of small print credits exactly the layers loaded. `attribution.mjs` builds it:
`footerText(loadedLayerIds, attribution)` joins the required statements with " · ", deduplicated (the
shared OS line appears once), in the fixed order of `sources` in the JSON, each followed by its licence
short name unless the line already names it. `aboutList(...)` gives the longer list (full line, source,
licence and links, layers, notes) for the Controls/About panel. Layer map: `ground-grid` none;
`terrain`, `slope`, `flow`, `shade`, `contours` EA LIDAR (OGL; slope, flow, the terrain-shadow horizons and the contours are derived works; contour heights above Ordnance Datum Newlyn); `grid` OSM (ODbL);
`visibility` EA LIDAR and OS Open Roads (OGL; derived: ground seen from roads);
`land` Natural England ALC (OGL; RPA CROME 2024 credited here only until crops are drawn);
`buffers` the sources of the features it draws round: OSM grid lines (ODbL), OS Open Rivers and Open Roads (OGL), EA LIDAR hedges (OGL);
`water` OS Open Rivers (OGL); `ways` OS Open Roads and OS OpenMap - Local for rail (both OGL); `search` REPD
(OGL, exact line); `postcodes` postcodes.io (OGL, its own licence wording, shown in the Find panel while
postcode rows show); `names` OS Open Names through postcodes.io /places (OGL, shown in the Find panel while
place rows show); `terrain-live` EA LIDAR fetched live from the EA WCS (same EA line);
`terrain-fallback` Copernicus GLO-30; `ground` (off by default, credited only while on) BGS
Geology 625k bedrock and superficial, BGS Single Onshore Borehole Index, Mining Remediation Authority Development
High Risk Area and EA Source Protection Zones [Merged], all OGL, lines copied from the site's ground.json sources. Tests: `tests/attribution.test.mjs`.

**Wording added for the footer, verified 26 Sept 2026:**
- `© OpenStreetMap contributors, ODbL`: the OSMF Attribution Guidelines give "© OpenStreetMap
  contributors" as an acceptable form and say the attribution "must also make it clear that the data is
  available under the Open Database License"; openstreetmap.org/copyright says "Make clear that the data
  is available under the Open Database License." The footer adds "ODbL" and links to
  openstreetmap.org/copyright. https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OS OpenData: the copyright acknowledgements page gives "Contains OS data © Crown copyright [and
  database right] [year]" and says to insert the applicable year. `{year}` takes the source's `year`
  (set it to the release year of the file used), else the caller's year.
- OGL default statement (National Archives OGL v3.0 page): "Contains public sector information licensed
  under the Open Government Licence v3.0." The REPD line uses this, unchanged.
- Copernicus GLO-30 (CDSE collection page): licence is the ESA User License with the Copernicus
  Contributing Missions annex, a free licence. The footer's short name is "Copernicus free licence".
  Adapted-data statement as quoted below, unchanged.

Checked 26 Sept 2026 against the official pages cited. Status: **used** means it is in the current
commit or loaded by the page now. **planned** means it is not yet used.

---

## Data

### Environment Agency: LIDAR Composite DTM 1m (used)
- **What we use:** bare-earth heights fetched over the Defra WCS
  (`environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs`). They are cut
  into `.ght` height tiles and `.slope` tiles, which are derived works. The tiles are staged locally and
  git-ignored. They are not in the repository yet. Away from staged sites the page also fetches 256 m boxes
  from the same WCS live in the browser (`wcs-terrain.mjs`, layer `terrain-live`); the same line applies.
  Past a staged site's 1 m tiles the terrain layer also draws a far ring to about 4 km: 8 m and 16 m `.ght` tiles
  decimated from the EA LIDAR Composite DTM (the mean of the 1 m nodes round each node; `tools/merge-farring.mjs`,
  every tile hash-listed in the site's tiles.json). A derived work under the same line and OGL v3.0.
- **Licence:** Open Government Licence v3.0.
- **Required attribution (verbatim from the dataset page):**
  `© Environment Agency copyright and/or database right 2022. All rights reserved.`
- **Link:** https://www.data.gov.uk/dataset/01b3ee39-da3f-47b6-83da-dc98e73a461f/lidar-composite-digital-terrain-model-dtm-1m
  (publisher Environment Agency, last updated 1 Aug 2025). Licence text:
  https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
- **Notes:** OGL allows derived tiles to be published, including commercially. Every published tile set
  must carry the line above and the OGL link, and must not suggest that the EA endorses the work. The
  wording in `lidar/README.md` ("Contains Environment Agency information copyright...") is not the EA's
  statement. Use the line above.

### Environment Agency: LIDAR Composite First Return DSM 1m and DSM (last return) 1m (used)
- **What we use:** surface heights fetched over the Defra WCS
  (`environment.data.gov.uk/spatialdata/lidar-composite-digital-surface-model-first-return-dsm-1m/wcs` and
  `.../lidar-composite-digital-surface-model-last-return-dsm-1m/wcs`). Canopy height is first return minus the
  DTM; first minus last helps tell vegetation from structures. Output: `.gcn` canopy tiles and `hedges.json`
  for the canopy layer, derived works, staged locally and git-ignored like the terrain tiles.
- **Licence:** Open Government Licence v3.0; the service lists no fees and no access constraints.
- **Required attribution (verbatim from both dataset pages, checked 26 Sept 2026):**
  `© Environment Agency copyright and/or database right 2022. All rights reserved.`
- **Links:** https://www.data.gov.uk/dataset/92534f24-0b92-4b28-9986-347cf6678b39/lidar-composite-first-return-digital-surface-model-fz-dsm-1m
  (first return, register id `ea-lidar-fz-dsm-1m`) and
  https://www.data.gov.uk/dataset/cf3f1137-c12b-44a1-a835-e80fe4a60b92/lidar-composite-digital-surface-model-dsm-1m
  (last return, `ea-lidar-lz-dsm-1m`). The last-return composite also uses older time-series surveys, so its
  dates can differ from the first return (2016-2022).
- **Notes:** the footer line is the same as the DTM's, so it shows once. No building shapes or heights are
  published: cells classed as structure or uncertain carry no height and are never drawn.

### DESNZ: Renewable Energy Planning Database, REPD (used)
- **What we use:** `data/projects.json` (11,033 records: ref, name, postcode, county, technology, status,
  MW, lat/lon). It is derived from GridAtlas's `repd_browser_registry_202608290716.json`, which is
  compiled from the DESNZ REPD extract.
- **Licence:** Open Government Licence v3.0 ("All content is available under the Open Government Licence
  v3.0, except where otherwise stated", © Crown copyright). The page was last updated 3 Aug 2026.
- **Required attribution:** REPD gives no specific statement, so OGL's default applies. We add the
  source:
  `Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ Renewable Energy Planning Database.`
- **Link:** https://www.gov.uk/government/publications/renewable-energy-planning-database-monthly-extract
- **GridAtlas conditions:** none beyond REPD's own. GridAtlas code is Apache-2.0. Its `NOTICE` says the
  REPD data "keeps its own terms and is not licensed by this file". Credit the path anyway: "via GridAtlas
  (Ventus Ltd)". `projects.json` is **not** MIT, even though it sits under `web/`. It stays OGL.

### postcodes.io: Great Britain postcodes (used, live)
- **What we use:** `postcodes.mjs` asks `https://api.postcodes.io/postcodes?q=...` for the postcode typed in
  Find, in the browser, one request at a time and cached; nothing is stored in the repo.
- **Licence:** service code MIT. Per https://postcodes.io/docs/licences (read 26 Sept 2026): "Great Britain
  postcode data may be used under the terms of the OS OpenData licence" (OGL v3.0). Northern Ireland (BT)
  postcode data is non-commercial only, so BT postcodes are not searched.
- **Required attribution, as that page words it:** `Contains Ordnance Survey data © Crown copyright and
  database right 2025. Contains Royal Mail data © Royal Mail copyright and database right 2025. Contains
  National Statistics data © Crown copyright and database right 2025. Contains NRS data © Crown copyright
  and database right 2025.` The panel prefixes "Postcodes via postcodes.io."

### OS Open Names through postcodes.io /places: towns and villages (used, live)
- **What we use:** `places.mjs` asks `https://api.postcodes.io/places?q=...` for the name typed in Find, in the
  browser, one request at a time and cached; nothing is stored in the repo. Only populated places are kept
  (City, Town, Village, Hamlet, Suburban Area). No Nominatim or other rate-limited geocoder is used.
- **Licence:** OS Open Names is OS OpenData under the Open Government Licence v3.0; the service code is MIT.
- **Required attribution (shown in the Find panel while place rows show):**
  `Contains OS data © Crown copyright and database right 2026.`

### Ordnance Survey: transformation parameters and guide worked example (used, as method)
- **What we use:** `bng.mjs` implements the OSGB36 Transverse Mercator formulae, the 7-parameter Helmert
  constants and the Annex C.1 worked example (as test vectors) from *A Guide to Coordinate Systems in
  Great Britain* v3.6 (© OS 2020).
- **Licence:** the numeric constants and published formulae are facts and method. We reimplement them;
  we do not copy the guide's text, figures or tables. No OGL statement is needed for this, but the
  citation is kept.
- **Credit (docs and source only, not on screen):** `Ordnance Survey, A Guide to Coordinate Systems in Great Britain v3.6 (2020), Annexes B and C.`
- **Link:** https://docs.os.uk/more-than-maps/a-guide-to-coordinate-systems-in-great-britain
  (PDF: https://www.ordnancesurvey.co.uk/documents/resources/guide-coordinate-systems-great-britain.pdf)
- **Note:** the Helmert transform is accurate to about 3.5 m. It is not OSTN15, so do not describe it
  as "National Grid exact".

### Ordnance Survey OpenData: Code-Point Open, OS Open Names, OS Open Rivers, OS Open Roads, OS OpenMap - Local (Rivers, Roads and OpenMap - Local used)
- **Licence:** Open Government Licence v3.0 (OS OpenData).
- **Required attribution (verbatim, OS copyright acknowledgements page):**
  `Contains OS data © Crown copyright and database right [year]`
- **Code-Point Open adds:** `Contains National Statistics data © Crown copyright and database right [year]`.
  The Code-Point Open user guide also requires
  `Contains Royal Mail data © Royal Mail copyright and database right [year]`. Show all three.
- **OS display rules:** use a legible font in a conspicuous position. The same statement goes into any
  derived dataset or sub-licence.
- **Link:** https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing/copyright-acknowledgments

### Natural England Agricultural Land Classification: provisional and post-1988 (used)
- **Licence:** Open Government Licence v3.0 (checked 26 Sept 2026 on each dataset's page).
- **Required attribution:** `© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right [year].`
- **Where:** the Land grades layer (land/land.json, cut by tools/features/cut_land.py). The provisional map is about
  1:250,000 and does not split grade 3; a survey decides.

### Rural Payments Agency Crop Map of England (CROME) 2024 (used in the land report, not drawn)
- **Licence:** Open Government Licence (the data.gov.uk catalogue licence field).
- **Required attribution, quoted as published:** `© Rural Payments Agency copyright and/or database right 2024. All rights reserved.`
- **Where:** land.json carries it for the land report; `on_screen` is false until crops are drawn. CROME is a
  classifier's output, not a survey.

### OpenStreetMap-derived grid lines and substations, via GridAtlas (used)
- **Licence:** Open Database License 1.0 (ODbL). Owner: OpenStreetMap Foundation and contributors.
- **Required attribution:** `© OpenStreetMap contributors`, linked to https://www.openstreetmap.org/copyright.
  The attribution must also make clear that the data is under the ODbL. GridAtlas already uses
  `Data © OpenStreetMap contributors`.
- **What ODbL requires for a per-site extract** (such as `sites/<id>/grid.json`):
  1. It is a **Derivative Database**. If it is public, it must itself be offered under ODbL 1.0, not MIT,
     with a notice naming ODbL and linking the licence. Put `"licence": "ODbL-1.0"` and the attribution
     in the file header. Add `data/LICENCE-ODbL.txt` or a link to it.
  2. Keep it a **separate file**. Merging OSM features into the same file as REPD or Ventus data makes
     the whole merged database ODbL. Separate files form a collective database, which leaves the other
     files under their own terms.
  3. The rendered 3D view is a **Produced Work**. It needs the attribution line only, not share-alike.
     OSMF guidance for games and simulations allows credit "in the game view ... in the menu", legible
     and visible long enough to comprehend.
  4. If the extract is changed (snapped, cleaned or re-typed), the changed database or a method to
     recreate it must be available (ODbL 4.6). Publishing the file in this public repo satisfies that.
- **Links:** https://www.openstreetmap.org/copyright ,
  https://osmfoundation.org/wiki/Licence/Attribution_Guidelines ,
  https://opendatacommons.org/licenses/odbl/1-0/

### Copernicus DEM GLO-30 (planned fallback)
- **Licence:** free licence for GLO-30 under the ESA/EU Copernicus DEM licence. Redistribution is allowed
  with the notice below.
- **Required attribution, adapted data (verbatim, CDSE collection page):**
  `produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved`
- **Citation:** https://doi.org/10.5270/ESA-c5d3d65
- **Link:** https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- **Note:** GLO-30 is a surface model, not bare earth, and it is 30 m. Label it as such wherever it
  stands in for EA LIDAR. Do not use GLO-90 or EEA-10 without re-checking their terms.

### Environment Agency: Flood Map for Planning (planned)
- **Licence:** Open Government Licence.
- **Required attribution (data.gov.uk, Flood Zone 3):**
  `© Environment Agency copyright and/or database right [year]. All rights reserved. Some features of this map are based on digital spatial data from the Centre for Ecology & Hydrology, © NERC (CEH)`
- **Link:** https://environment.data.gov.uk/dataset/87446770-d465-11e4-b97a-f0def148f590
- **Note:** the separate Flood Zone 2 and 3 datasets are marked **retired**. Use the current "Flood Map
  for Planning" product, and copy its attribution statement at the time of use.

### Natural England: Sites of Special Scientific Interest (England) (planned)
- **Licence:** Open Government Licence.
- **Required attribution:**
  `© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right [year].`
- **Link:** https://naturalengland-defra.opendata.arcgis.com/datasets/Defra::sites-of-special-scientific-interest-england/about
- **Status of the wording:** it was confirmed from search results of the NE portal. Re-read the dataset
  page when the layer is built.

### UK network operator and industry figures in `data/trench-sections.json` and `data/cables.json` (used)
- **What we use:** individual figures (depths of cover, spacings, bend-radius multiples, cable ODs). Each
  is cited to its source key in `docs/trench-sources.md` and `docs/cables-sources.md`. Sources: ENWL
  ES400E5, UKPN ECS 02-0019, Northern Powergrid NSP/002 and NPS/002/023, public planning (DCO) drawings,
  cable manufacturers' published installation guides, a public utility tender specification, and the
  AEIC/ICEA training radius.
- **Position:** single numbers and short cited facts are not protected expression. Quoting them with a
  citation is fair dealing for quotation (CDPA s.30(1ZA)). This is **fine as done**. We do not
  republish the documents, tables, drawings or PDFs.
- **Must not be republished:** the PDFs themselves. Also not the whole tables transcribed from BS 6622 /
  BS 7870 (BSI copyright; quote only the single value, as now), nor the DCO drawings as images.
- **Link hygiene:** cite the publisher and document number. Do not link a third-party re-host as if it
  were the source. ENWL ES400E5 is marked DRAFT; keep saying so.
- **Credit line (docs only):** `Figures quoted with citation from UK DNO specifications and public planning documents; see docs/trench-sources.md and docs/cables-sources.md. No endorsement implied.`

---

## Code and methods

| Component | Use | Licence | Copyright / credit | Status |
|---|---|---|---|---|
| Martini RTIN (mapbox/martini) | terrain mesh simplification | ISC | Copyright (c) 2019, Mapbox; author Vladimir Agafonkin. https://github.com/mapbox/martini | planned. Keep the ISC notice in the vendored file. |
| tifffile | reads EA GeoTIFFs (lidar pipeline) | BSD-3-Clause | Copyright (c) 2008-2026, Christoph Gohlke. https://github.com/cgohlke/tifffile | used (not vendored) |
| imagecodecs | TIFF codecs (lidar pipeline) | BSD-3-Clause | Copyright (c) 2008-2026, Christoph Gohlke. https://github.com/cgohlke/imagecodecs | used (not vendored) |
| CuPy | GPU pair checks | MIT | Copyright (c) 2015 Preferred Infrastructure, Inc.; Preferred Networks, Inc. https://github.com/cupy/cupy | used (not vendored) |
| NumPy | arrays | BSD-3-Clause | Copyright (c) 2005-2025, NumPy Developers. https://numpy.org | used (not vendored) |
| Playwright | browser tests only | Apache-2.0 | Microsoft Corporation. https://github.com/microsoft/playwright | used, test only, not shipped |
| Horn slope method | slope tiles | published method | Horn, B.K.P. (1981) "Hill shading and the reflectance map", *Proc. IEEE* 69(1), 14-47. doi:10.1109/PROC.1981.11918 | used |
| NOAA solar position | sun for the terrain shadow | published method | NOAA Global Monitoring Laboratory solar calculator after Meeus, J. (1998) *Astronomical Algorithms*, 2nd ed. https://gml.noaa.gov/grad/solcalc/calcdetails.html | used |
| Horizon shadowing | terrain shadow | published method | Dozier, J. and Frew, J. (1990) "Rapid calculation of terrain parameters for radiation modeling from digital elevation data", *IEEE Trans. Geosci. Remote Sens.* 28(5), 963-969 | used |
| Viewshed methods | visibility | published method | Franklin, W.R. and Ray, C.K. (1994) "Higher isn't necessarily better: visibility algorithms and experiments", *Advances in GIS Research* (SDH 1994), 751-770 | used |
| Zevenbergen-Thorne method | slope cross-check | published method | Zevenbergen, L.W. and Thorne, C.R. (1987) "Quantitative analysis of land surface topography", *Earth Surface Processes and Landforms* 12(1), 47-56. doi:10.1002/esp.3290120107 | used |

Dependencies that are installed rather than vendored need no notice in this repository. If any of them
is vendored or bundled, copy its LICENSE file next to it.

**Imagery (26 Sept 2026, see `docs/imagery-licences.md`).** `imagery` layer: Copernicus Sentinel-2 composites
and clear dates. The credit is "Contains modified Copernicus Sentinel data [years]" (free, full and open, and
commercial use is allowed). The years come from the staged site's `imagery/index.json`. The staged images
stay local (`web/world/sites/`). No other imagery source is used: keyed or licensed basemaps are not offered.

**Construction study (27 Sept 2026).** `construction` layer, off by default: tower and crane pads, conductors at an
assumed sag, a hypothetical compound platform, access routes and stringing sites from the GPU construction study.
Tower positions are inferred from OpenStreetMap, so the file is a Derivative Database under ODbL-1.0: it is staged
as its own file (`sites/<site>/construction/construction.odbl.json`, local only) and credited on its own line
("Data © OpenStreetMap contributors, available under the Open Database License."), never merged with OGL or MIT
data. Levels come from the EA LIDAR Composite DTM 1 m (OGL v3.0), credited on the terrain line. Illustrative only.
