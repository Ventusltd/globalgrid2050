#!/usr/bin/env python3
"""Prototype: the data-centre context sidecar a future Pipeline News release folder could vendor.

Reads the convergence outputs (repd_datacentre_proximity_{solar,battery,wind}.json, manifest.json) and the
project partitions of a Pipeline News release folder (data/v9.1/projects/part-*.json), and writes ONE compact
file keyed by the spine's repd_ref:

  pipelinenews_datacentre_context.json   columns + rows, one row per spine project that has coordinates
  (every spine ref without coordinates is listed under no_coordinates: the page shows NO MAP / no context)

It changes nothing in the release folder; it only reads it. A release that adopts it copies the file into its
own data/<version>/ folder with the hash this writes (the v9.8 interconnector pattern), and a presentation-only
column reads it. Data centres stay a distinct category: no data-centre id is ever written as a REPD ref.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import sys
from pathlib import Path

SCHEMA = "globalgrid2050.convergence.pipelinenews-datacentre-context.v1"
PARTS = ("solar", "battery", "wind")
COLUMNS = ["repd_ref", "nearest_dc_id", "nearest_dc_name", "nearest_dc_status", "nearest_dc_km",
           "dcs_within_10km", "dcs_within_25km", "dcs_within_50km", "operational_dcs_within_25km",
           "it_load_mw_stated_within_25km", "it_load_mw_known_sites_within_25km",
           "nearest_transmission_node", "nearest_transmission_node_km"]
SRC = {"nearest_dc_id": "dc1_id", "nearest_dc_name": "dc1_name", "nearest_dc_status": "dc1_status",
       "nearest_dc_km": "dc1_km", "dcs_within_10km": "r10km_datacentres", "dcs_within_25km": "r25km_datacentres",
       "dcs_within_50km": "r50km_datacentres", "operational_dcs_within_25km": "r25km_operational",
       "it_load_mw_stated_within_25km": "r25km_it_load_mw_stated",
       "it_load_mw_known_sites_within_25km": "r25km_it_load_mw_known_sites",
       "nearest_transmission_node": "nearest_node_site_code", "nearest_transmission_node_km": "nearest_node_km"}
CAVEAT = ("Straight-line distance from the REPD point to the nearest data-centre point in the open UK data-centre "
          "pipeline; proximity is not connection, capacity or a relationship between the two. Data-centre MW is "
          "demand-side (IT load) and is never REPD installed capacity.")


def sha(b):
    return hashlib.sha256(b).hexdigest()


def build(convergence_dir, release_dir):
    cdir, rdir = Path(convergence_dir), Path(release_dir)
    proj = {}
    used = []
    for part in PARTS:
        p = cdir / ("repd_datacentre_proximity_%s.json" % part)
        b = p.read_bytes()
        used.append({"file": p.name, "sha256": sha(b)})
        d = json.loads(b)
        cols = d["columns"]
        for row in d["rows"]:
            r = dict(zip(cols, row))
            proj[str(r["ref"])] = r
    man_b = (cdir / "manifest.json").read_bytes()
    used.append({"file": "manifest.json", "sha256": sha(man_b)})
    spine_refs, spine_files = [], []
    for f in sorted(glob.glob(str(rdir / "data" / "v9.1" / "projects" / "part-*.json"))):
        b = Path(f).read_bytes()
        spine_files.append({"file": str(Path(f).relative_to(rdir)), "sha256": sha(b)})
        spine_refs.extend(str(p["repd_ref"]) for p in json.loads(b)["projects"])
    if len(set(spine_refs)) != len(spine_refs):
        raise SystemExit("spine has duplicate repd_ref values")
    rows, missing = [], []
    for ref in sorted(spine_refs, key=int):
        r = proj.get(ref)
        if r is None:
            missing.append(ref)
            continue
        rows.append([ref] + [r[SRC[c]] for c in COLUMNS[1:]])
    conv = json.loads(man_b)
    return {
        "schema": SCHEMA,
        "caveat": CAVEAT,
        "datacentre_baseline_sha256": next(i["sha256"] for i in conv["inputs"] if i["role"] == "datacentre_baseline"),
        "repd_register_sha256": next(i["sha256"] for i in conv["inputs"] if i["role"] == "repd_register"),
        "convergence_inputs": used,
        "release_spine": {"folder": rdir.name, "projects": len(spine_refs), "partitions": spine_files},
        "columns": COLUMNS,
        "rows": rows,
        "no_coordinates": missing,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--convergence", required=True, help="dist/convergence/<release> folder")
    ap.add_argument("--release", required=True, help="uk_renewables_pipeline/<stamp> folder (read only)")
    ap.add_argument("--out", required=True, help="output JSON path")
    a = ap.parse_args(argv)
    doc = build(a.convergence, a.release)
    b = (json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_bytes(b)
    print(json.dumps({"out": a.out, "rows": len(doc["rows"]), "no_coordinates": len(doc["no_coordinates"]),
                      "bytes": len(b), "sha256": sha(b)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
