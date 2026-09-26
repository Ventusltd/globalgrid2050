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

Checked 26 Sept 2026 against the official pages cited. Status: **used** means it is in the current
commit or loaded by the page now. **planned** means it is not yet used.

---

## Data

### Environment Agency: LIDAR Composite DTM 1m (used)
- **What we use:** bare-earth heights fetched over the Defra WCS
  (`environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs`). They are cut
  into `.ght` height tiles and `.slope` tiles, which are derived works. The tiles are staged locally and
  git-ignored. They are not in the repository yet.
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

### Ordnance Survey OpenData: Code-Point Open, OS Open Names, OS Open Rivers, OS Open Roads (planned)
- **Licence:** Open Government Licence v3.0 (OS OpenData).
- **Required attribution (verbatim, OS copyright acknowledgements page):**
  `Contains OS data © Crown copyright and database right [year]`
- **Code-Point Open adds:** `Contains National Statistics data © Crown copyright and database right [year]`.
  The Code-Point Open user guide also requires
  `Contains Royal Mail data © Royal Mail copyright and database right [year]`. Show all three.
- **OS display rules:** use a legible font in a conspicuous position. The same statement goes into any
  derived dataset or sub-licence.
- **Link:** https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing/copyright-acknowledgments

### OpenStreetMap-derived grid lines and substations, via GridAtlas (planned)
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
| Zevenbergen-Thorne method | slope cross-check | published method | Zevenbergen, L.W. and Thorne, C.R. (1987) "Quantitative analysis of land surface topography", *Earth Surface Processes and Landforms* 12(1), 47-56. doi:10.1002/esp.3290120107 | used |

Dependencies that are installed rather than vendored need no notice in this repository. If any of them
is vendored or bundled, copy its LICENSE file next to it.

---

## Origination

The use of Environment Agency LiDAR and of Copernicus DEM in this project was first suggested in a
conversation with Google Gemini. This is recorded here for history only. By the owner's decision, it is
not credited on screen.

---

## Flags (26 Sept 2026)

1. **Current commit (04b1c72, local, not pushed):** no licence is broken in the repository. The EA tiles
   are git-ignored. `projects.json` (REPD, OGL) is committed with no licence or attribution field, and the
   page shows no OGL line. **Before push or deploy:** show the REPD line whenever search or projects
   load, and the EA line whenever terrain or slope loads.
2. **Root `LICENSE` wording:** it says MIT applies to "newly authored web/ ... files". `web/world/data/*.json`
   and any site tiles are **excluded**, because they are third-party data under their own terms. Add
   that sentence to `LICENSE` or `NOTICE` (the licensing officer may not edit those files).
3. **Needs permission or must not be published:** the DNO, BSI and manufacturer documents themselves,
   and DCO drawings as images. Figures with citation are fine.
4. **Share-alike trap:** OSM-derived files must be ODbL and must stay in separate files. Never merge
   them into `projects.json` or any MIT-labelled file.
