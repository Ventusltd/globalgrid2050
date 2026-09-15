#!/usr/bin/env python3
"""Build the atlas pack for testcode/202609151428 from the published V9.1 projects.

WHY A PACK. The published projects are sixteen files of about 620 KB each, ten
megabytes in total, because every row carries its full provenance: coordinate
method, identity confidence, sibling references, planning history. That is the
right shape for an archive and the wrong shape for a phone. This script reduces
those rows to the eleven fields the visualisation actually reads and writes them
as fixed-width binary columns, so the page fetches about 250 KB instead of ten
megabytes and can still draw every project on the first frame.

WHAT IT REFUSES. It drops no project and it invents nothing. A project with no
valid geometry keeps its row and is marked; a capacity that is not known would
keep its row and be marked, though in this build every row has a known capacity.
Names and operators are carried as a separate string table so the numeric
columns stay fixed-width.

PROVENANCE. The source files are hashed as git blobs, not as they sit on disk,
because the disk on Windows is not the file that ships. The manifest records the
commit, every source path with its blob hash, and the totals computed here, so
the page can state where each number came from and a checker can reproduce it.
"""
from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAMP = HERE.parent
ROOT = STAMP.parent.parent
SRC = ROOT / "uk_renewables_pipeline" / "v9.7" / "data" / "v9.1" / "projects"
OUT = STAMP / "data"

TECHS = ["solar", "wind_onshore", "wind_offshore", "bess"]
LIFECYCLES = ["OPERATIONAL", "UNDER_CONSTRUCTION", "LIVE_PRE_CONSTRUCTION", "INACTIVE", "UNKNOWN"]
EPOCH = date(2000, 1, 1)


def git(*args: str) -> str:
    out = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True)
    if out.returncode:
        raise SystemExit(f"git {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout.strip()


def blob_sha(rel: str) -> str:
    """The hash of the committed bytes, which is what GitHub Pages serves."""
    return git("rev-parse", f"HEAD:{rel}")


def days(value) -> int:
    """Days since 2000-01-01, or -1 when the date is absent. Never guessed."""
    if not value:
        return -1
    try:
        return (date.fromisoformat(str(value)[:10]) - EPOCH).days
    except ValueError:
        return -1


def main() -> int:
    parts = sorted(SRC.glob("part-*.json"))
    if not parts:
        raise SystemExit(f"no project parts under {SRC}")

    rows = []
    sources = []
    for p in parts:
        rel = p.relative_to(ROOT).as_posix()
        sources.append({"path": rel, "blob_sha1": blob_sha(rel), "bytes": p.stat().st_size})
        doc = json.loads(p.read_text(encoding="utf-8"))
        rows.extend(doc if isinstance(doc, list) else (doc.get("projects") or list(doc.values())[0]))

    rows.sort(key=lambda r: r["gg_project_id"])
    n = len(rows)

    ids = set(r["gg_project_id"] for r in rows)
    if len(ids) != n:
        raise SystemExit(f"{n - len(ids)} duplicate project ids; the pack refuses to hide them")

    lat = struct.pack(f"<{n}f", *[float(r.get("latitude") or 0.0) for r in rows])
    lon = struct.pack(f"<{n}f", *[float(r.get("longitude") or 0.0) for r in rows])
    mw = struct.pack(f"<{n}f", *[float(r.get("capacity_mw") or 0.0) for r in rows])
    tech = bytes(TECHS.index(r["technology"]) if r.get("technology") in TECHS else 255 for r in rows)
    life = bytes(LIFECYCLES.index(r["lifecycle"]) if r.get("lifecycle") in LIFECYCLES else 255 for r in rows)
    flags = bytes(
        (1 if r.get("capacity_known") else 0)
        | (2 if r.get("geometry_status") == "valid" else 0)
        | (4 if r.get("operational") else 0)
        | (8 if r.get("under_construction") else 0)
        for r in rows
    )
    applied = struct.pack(f"<{n}i", *[days(r.get("planning_application_submitted")) for r in rows])
    granted = struct.pack(f"<{n}i", *[days(r.get("planning_permission_granted")) for r in rows])
    repd = struct.pack(f"<{n}I", *[int(r["repd_ref"]) if str(r.get("repd_ref", "")).isdigit() else 0 for r in rows])

    regions = sorted({(r.get("region") or "unstated") for r in rows})
    operators = sorted({(r.get("operator") or "unstated") for r in rows})
    region_col = struct.pack(f"<{n}H", *[regions.index(r.get("region") or "unstated") for r in rows])
    operator_col = struct.pack(f"<{n}H", *[operators.index(r.get("operator") or "unstated") for r in rows])

    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "lat.bin": lat, "lon.bin": lon, "mw.bin": mw,
        "tech.bin": tech, "life.bin": life, "flags.bin": flags,
        "applied.bin": applied, "granted.bin": granted, "repd.bin": repd,
        "region.bin": region_col, "operator.bin": operator_col,
    }
    for name, blob in files.items():
        (OUT / name).write_bytes(blob)

    names = [r.get("name") or "unnamed" for r in rows]
    (OUT / "names.json").write_text(json.dumps(names, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    by_tech = {t: {"count": 0, "mw": 0.0} for t in TECHS}
    by_life = {l: {"count": 0, "mw": 0.0} for l in LIFECYCLES}
    for r in rows:
        t, l = r.get("technology"), r.get("lifecycle")
        c = float(r.get("capacity_mw") or 0.0)
        if t in by_tech:
            by_tech[t]["count"] += 1
            by_tech[t]["mw"] += c
        if l in by_life:
            by_life[l]["count"] += 1
            by_life[l]["mw"] += c

    meta = {
        "schema": "globalgrid2050.atlas-pack.v1",
        "built_utc": subprocess.run(["git", "log", "-1", "--format=%cI"], capture_output=True,
                                    text=True, cwd=ROOT).stdout.strip() or None,
        "source": {
            "commit": git("rev-parse", "HEAD"),
            "release": "uk_renewables_pipeline/v9.7 data v9.1",
            "files": sources,
        },
        "projects": n,
        "order": "ascending gg_project_id; every column is in this order",
        "technologies": TECHS,
        "lifecycles": LIFECYCLES,
        "regions": regions,
        "operators_count": len(operators),
        "totals": {
            "capacity_mw": round(sum(float(r.get("capacity_mw") or 0.0) for r in rows), 3),
            "by_technology": {k: {"count": v["count"], "mw": round(v["mw"], 3)} for k, v in by_tech.items()},
            "by_lifecycle": {k: {"count": v["count"], "mw": round(v["mw"], 3)} for k, v in by_life.items()},
            "valid_geometry": sum(1 for r in rows if r.get("geometry_status") == "valid"),
            "capacity_known": sum(1 for r in rows if r.get("capacity_known")),
            "with_application_date": sum(1 for r in rows if r.get("planning_application_submitted")),
        },
        "not_claimed": [
            "A capacity in this pack is what the register records, not what is connected or generating.",
            "A lifecycle is the register's own classification on the date it was published.",
            "A coordinate is the register's, converted by a documented approximation; it is not a survey.",
            "Nothing here says a project will be built.",
        ],
        "files": {name: {"bytes": len(blob),
                         "sha256": hashlib.sha256(blob).hexdigest()} for name, blob in files.items()},
    }
    meta["files"]["names.json"] = {
        "bytes": (OUT / "names.json").stat().st_size,
        "sha256": hashlib.sha256((OUT / "names.json").read_bytes()).hexdigest(),
    }
    (OUT / "pack.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    total = sum(len(b) for b in files.values()) + meta["files"]["names.json"]["bytes"]
    print(f"atlas pack: {n} projects, {total} bytes across {len(files) + 1} files")
    for t in TECHS:
        print(f"  {t:<14} {by_tech[t]['count']:>5} projects  {by_tech[t]['mw'] / 1000:>8.2f} GW")
    print(f"  {'TOTAL':<14} {n:>5} projects  {meta['totals']['capacity_mw'] / 1000:>8.2f} GW")
    return 0


if __name__ == "__main__":
    sys.exit(main())
