# 202611140223 (V9.18, release candidate)

Parent: `202611140216` (V9.17), tree `2a6faf461c0771bb8cfe5c47a4e138af710b868f`.

The register, every data byte under `data/` and the MAP link of every row are the parent's (all 7,775
hrefs identical, character for character). No data-centre content is added beyond what V9.16 introduced.
This version corrects how that content is presented, following an independent review:

1. **Attribution and licence state.** A DATA SOURCES AND LICENCES block at the foot of the page, and a short
   line in each nearest-data-centre entry: data-centre sites are © OpenStreetMap contributors (ODbL 1.0)
   and contain public sector information under the Open Government Licence v3.0; the register records
   the licence status of every source entry as unverified; shown for screening only.
   `convergence/datacentres.json` now carries, for each of the 226 sites, the register's own source
   entries (dataset, licence as recorded, licence status as recorded, attribution, link), and each entry
   on the page names its source. `convergence/manifest.json` pins the register file (sha256 87337db5...)
   and counts 258 source entries: 228 ODbL-1.0 and 30 OGL-UK-3.0, all recorded as unverified.
2. **Point precision.** 882 projects have as their nearest site one whose register point is a
   settlement-level approximation. Those entries now say so, round the distance to whole kilometres
   ("about 22 km"), and their GridAtlas link opens at a wider zoom. Exact-site points are unchanged.
3. **What the GridAtlas link is.** The link is labelled OPEN THIS LOCATION IN GRIDATLAS (or THE APPROXIMATE
   LOCATION) and states that it opens a map position only and does not open a data-centre record. The URL
   form is unchanged (latitude, longitude, zoom and the site name as the card title); GridAtlas has no
   receiver for a data-centre id, so none is claimed. A data centre is never given a REPD Ref ID.
4. **Failure is stated.** If the context files cannot be read, each PROJECT RECORD says the data-centre
   context could not be loaded, instead of showing nothing.
5. **Tests.** The version's browser probes (run in CI at desktop and phone widths) require: an exact-site
   entry (REPD 10772) with its dcuk- id, distance, source and link; a settlement-precision entry (REPD
   15347) with the approximation wording, separate IT-load and grid-connection MW and the wider link; a
   row the convergence build could not measure (REPD 13429) with no link; the attribution block; the
   register-change entry of REPD 15793; the stated failure when the context file is refused; and in each
   probed row the unchanged MAP link.
6. **Navigation.** The links to V9.14, V9.15 and V9.16 are replaced by the single ALL VERSIONS link; those
   versions remain published and listed there.
7. **Labels and runner.** V9.18 release-candidate labels; `tests/run_v9_18.sh` + `tests/check_v9_18.mjs`.

Known limits: licence status is unverified at source, so this content is shown with attribution and for
screening only; the live behaviour of GridAtlas on the location link and on the MAP link has not been
checked from the build workspace; one nearest site per project.
