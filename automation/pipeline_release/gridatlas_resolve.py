#!/usr/bin/env python3
"""Which Pipeline News MAP links does a GridAtlas register resolve by REPD Ref ID?

  gridatlas_resolve.py <version folder> <register> [--composition <current.json>] [--summary] [--write <state.json>] [--require-active]

<register> is a GridAtlas browser registry (data/repd_browser_registry_<generation>.json, schema
gridatlas.browser-registry.v1), as a file path or an https URL. The MAP link itself is not
touched or tested here; this only answers, for every row of the version, whether GridAtlas
holds a record with the same REPD Ref ID, which is what lets it open the project's identity
card on arrival.

GridAtlas keeps the active register only: Operational, Under Construction, Awaiting
Construction and Application Submitted. Rows with any other REPD status are not expected to
resolve; on those the map still opens on the point the link carries. The rows that matter
are the ACTIVE ones GridAtlas does not hold yet: they are listed in full.

--composition names GridAtlas's composition manifest (atlas/current.json, path or https URL);
the generation of its project-search cartridge is recorded so a page can tell whether the
measurement still applies to what GridAtlas serves.

--require-active exits 1 unless every active row either resolves or lies outside the area
GridAtlas compiles (the re-run check once a new GridAtlas register is live). Standard library only.
"""
import hashlib
import json
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# The bounds GridAtlas's compiler keeps a point within (compiler/<generation>-compile-atlas-v9.py):
# -9 < longitude < 2.5 and 49 < latitude < 61. An active row outside them is explained, not a fault.
BOUNDS = {"lon": (-9.0, 2.5), "lat": (49.0, 61.0)}
ACTIVE = {"operational", "under construction", "awaiting construction", "application submitted"}


def main():
    args = sys.argv[1:]
    folder, source = Path(args[0]), args[1]
    read = lambda s: urllib.request.urlopen(s, timeout=60).read() if s.startswith("https://") else Path(s).read_bytes()
    raw = read(source)
    search = None
    if "--composition" in args:
        comp = json.loads(read(args[args.index("--composition") + 1]))
        cart = next(c for c in comp["cartridges"] if c["id"] == "uk-gazetteer-flyto")
        search = {"cartridge": cart["id"], "generation": str(cart["generation"]), "composition_generation": str(comp.get("generation"))}
    reg = json.loads(raw)
    assert reg.get("schema") == "gridatlas.browser-registry.v1", reg.get("schema")
    held = {str(r["repd_ref"]): r for r in reg["records"]}
    rows = []
    manifest = json.loads((folder / "data/v9.1/build_manifest.json").read_text())
    for part in manifest["project_partitions"]:
        rows += json.loads((folder / part["path"]).read_text())["projects"]

    pending, stale, counts = [], [], Counter()
    for row in rows:
        ref, active = str(row["repd_ref"]), row["status"].lower() in ACTIVE
        rec = held.get(ref)
        if rec and active:
            counts["active_resolved"] += 1
        elif rec:
            counts["not_active_but_still_held"] += 1
            stale.append({"repd_ref": ref, "name": row["name"], "repd_status": row["status"], "gridatlas_status": rec.get("status")})
        elif active:
            counts["active_not_resolved"] += 1
            lon, lat = row.get("longitude"), row.get("latitude")
            outside = row.get("geometry_status") == "valid" and not (BOUNDS["lon"][0] < lon < BOUNDS["lon"][1] and BOUNDS["lat"][0] < lat < BOUNDS["lat"][1])
            reason = ("REPD point %.4f N, %.4f E lies outside the area GridAtlas compiles (longitude -9 to 2.5, latitude 49 to 61)" % (lat, lon)) if outside else "not explained by status or position"
            counts["active_outside_bounds" if outside else "active_unexplained"] += 1
            pending.append({"repd_ref": ref, "name": row["name"], "technology": row["technology"], "repd_status": row["status"],
                            "capacity_mw": row.get("capacity_mw"), "has_map_point": row.get("geometry_status") == "valid", "reason": reason,
                            "page_note": "GRIDATLAS: MAP OPENS ON THE PROJECT POINT · NO PROJECT CARD THERE: " + ("POINT IS EAST OF THE AREA GRIDATLAS COMPILES" if outside and lon >= BOUNDS["lon"][1] else "POINT IS OUTSIDE THE AREA GRIDATLAS COMPILES" if outside else "RECORD NOT YET IN GRIDATLAS")})
        else:
            counts["not_active_not_expected"] += 1
    out = {
        "schema": "globalgrid2050.pipeline-news.gridatlas-map-link-state.v1",
        "measured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pipeline_news_version": folder.name,
        "gridatlas_register": {"generation": reg.get("generation"), "dataset": (reg.get("source") or {}).get("dataset"),
                               "records": len(reg["records"]), "sha256": hashlib.sha256(raw).hexdigest(),
                               "file": "data/repd_browser_registry_%s.json" % reg.get("generation")},
        "gridatlas_project_search": search,
        "method": "Exact REPD Ref ID match between every Pipeline News row and the GridAtlas browser registry. Offline, from the files; the live site was not opened.",
        "rows": len(rows),
        "active_rows": counts["active_resolved"] + counts["active_not_resolved"],
        "active_resolved": counts["active_resolved"],
        "active_not_resolved": counts["active_not_resolved"],
        "active_not_resolved_outside_gridatlas_area": counts["active_outside_bounds"],
        "active_not_resolved_unexplained": counts["active_unexplained"],
        "rows_resolved_total": counts["active_resolved"] + counts["not_active_but_still_held"],
        "rows_without_map_point": sum(1 for r in rows if r.get("geometry_status") != "valid"),
        "not_active_not_expected": counts["not_active_not_expected"],
        "not_active_but_still_held": counts["not_active_but_still_held"],
        "meaning": {
            "active_not_resolved": "REPD status is Operational, Under Construction, Awaiting Construction or Application Submitted, and GridAtlas holds no record with this REPD Ref ID. The MAP link still opens the map on the project's point and measures from it; the project's identity card does not open. Each row carries its reason.",
            "not_active_not_expected": "REPD status is outside the four active statuses. GridAtlas keeps the active register only, so no identity card is expected; the map still opens on the link's point.",
            "not_active_but_still_held": "GridAtlas still holds an earlier record for a project whose REPD status is no longer active; its card shows the earlier status.",
        },
        "pass": counts["active_unexplained"] == 0,
        "active_not_resolved_refs": sorted(pending, key=lambda r: int(r["repd_ref"])),
        "not_active_but_still_held_refs": sorted(stale, key=lambda r: int(r["repd_ref"])),
    }
    if "--write" in args:
        Path(args[args.index("--write") + 1]).write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    if "--summary" in args:
        out = {k: v for k, v in out.items() if not k.endswith("_refs") and k != "meaning"}
    print(json.dumps(out, indent=1, ensure_ascii=False))
    if "--require-active" in args and not out["pass"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
