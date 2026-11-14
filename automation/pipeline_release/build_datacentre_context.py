#!/usr/bin/env python3
"""Copy the REPD and data-centre proximity context into a version folder.

  build_datacentre_context.py <version folder> [<data-centre register geojson>]

With the register file (GridAtlas data/uk_datacentre_pipeline_<generation>.geojson, the convergence
build's own input) each site also carries the register's source entries: dataset, licence as recorded,
licence status as recorded, attribution and source link. Without it the sources are left out.

Writes, under <version folder>/convergence/:
  nearest_datacentre.json   byte copy of dist/convergence/2026q3/pipelinenews/pipelinenews_datacentre_context.json
                            (one row per REPD Ref ID: nearest register site, straight-line km, counts within 10/25/50 km)
  datacentres.json          the 226 register sites reduced to what the page shows: the register's own id, name,
                            status, operator, point and its precision, and the register's own MW fields
  manifest.json             sources and sha256 of both
Nothing is computed here: every figure is the convergence build's. Blank MW stays null (unknown).
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIDE = "dist/convergence/2026q3/pipelinenews/pipelinenews_datacentre_context.json"
PROX = "dist/convergence/2026q3/datacentre_proximity.json"
KEEP = ["id", "name", "status", "operator", "precision", "proximity_reliable", "lat", "lon", "it_load_mw", "grid_connection_mw", "unclassified_mw", "unclassified_mw_label"]


ATTRIBUTION = ("Data-centre sites: © OpenStreetMap contributors, ODbL 1.0; contains public sector information licensed under the Open Government Licence v3.0. "
               "Source licence status recorded as unverified in the register; shown for screening only.")
LICENCE_STATE = "shown with attribution; licence status unverified at source"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    out = Path(sys.argv[1]) / "convergence"
    out.mkdir(exist_ok=True)
    shutil.copyfile(ROOT / SIDE, out / "nearest_datacentre.json")
    prox = json.loads((ROOT / PROX).read_text())
    sites = [{k: r.get(k) for k in KEEP} for r in prox["records"]]
    register = None
    if len(sys.argv) > 2:
        raw = Path(sys.argv[2]).read_bytes()
        features = {f["id"]: f["properties"] for f in json.loads(raw)["features"]}
        assert set(features) == {s["id"] for s in sites}, "register ids and convergence ids differ"
        licences = {}
        for s in sites:
            s["sources"] = [{k: src.get(k) for k in ("id", "dataset", "licence", "licence_status", "licence_url", "attribution", "url", "retrieved")} for src in features[s["id"]].get("sources", [])]
            assert s["sources"], "site without a source entry: " + s["id"]
            for src in s["sources"]:
                key = "%s (%s)" % (src["licence"], src["licence_status"])
                licences[key] = licences.get(key, 0) + 1
        register = {"file": "data/" + Path(sys.argv[2]).name, "repository": "https://github.com/Ventusltd/gridatlas", "sha256": hashlib.sha256(raw).hexdigest(),
                    "source_entries": sum(licences.values()), "source_entries_by_licence_and_status": licences}
    doc = {"schema": "globalgrid2050.pipeline-news.datacentre-sites.v1",
           "note": "UK data-centre register sites as carried by the convergence build; ids are the register's own. MW fields are the register's and are null when not stated. A point with precision other than exact_site or settlement is not used for distance.",
           "source": PROX, "source_sha256": sha(ROOT / PROX), "register": register,
           "attribution": ATTRIBUTION, "licence_state": LICENCE_STATE, "sites": sites}
    (out / "datacentres.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
    manifest = {"schema": "globalgrid2050.pipeline-news.datacentre-context-manifest.v1",
                "caveat": "Straight-line distance between published points. Proximity is screening context only: it is not a grid connection, a capacity statement or a relationship between a project and a data centre.",
                "attribution": ATTRIBUTION, "licence_state": LICENCE_STATE, "register": register,
                "files": [{"file": "nearest_datacentre.json", "source": SIDE, "sha256": sha(out / "nearest_datacentre.json"), "rows": len(json.loads((out / "nearest_datacentre.json").read_text())["rows"])},
                          {"file": "datacentres.json", "source": PROX, "source_sha256": doc["source_sha256"], "sha256": sha(out / "datacentres.json"), "sites": len(sites)}]}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(json.dumps(manifest["files"]))


if __name__ == "__main__":
    main()
