#!/usr/bin/env python3
"""Build a STAND-IN set of October root datasets for the page harness.

Used only when the lead's build_root.py output (auto/root_out/) is not available yet.
Reads a canonical staged REPD CSV (53 columns, UTF-8 with or without BOM) and writes,
into --out (never into the repo):

  repd.csv                              all rows, all columns
  repd-grid-batteries.csv               Technology Type == Battery and
                                        Development Status (short) in BATTERY_STATUSES
  repd-solar-operational.csv            Solar Photovoltaics, Operational, capacity > 1 MW,
                                        Mounting Type for Solar in {Ground, Roof}
                                        (column subset copied from --columns-like if given)
  repd-solar-operational-over-4mw.csv   Solar Photovoltaics, Operational, capacity > 4 MW
  dist/repd_master.json                 via scripts/repd_updater.py REPDUpdater.refine_dataset
                                        (imported from --repo, never modified)

All CSVs are written UTF-8 without BOM, LF line endings. Blank capacity is unknown and
therefore never passes a "> N MW" filter. The filters are the documented ones; on the
January 2026 root repd.csv they reproduce the January subset counts for both solar files
exactly (1209 and 924); see NOTES.md for the battery file.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

BATTERY_STATUSES = {
    "Operational", "Under Construction", "Awaiting Construction",
    "Application Submitted", "Appeal Lodged", "No Application Required",
}
SOLAR = "Solar Photovoltaics"


def norm(h: str) -> str:
    return re.sub(r"\s+", " ", h.replace("﻿", "")).strip()


def capacity(v: str):
    v = (v or "").replace(",", "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def read_rows(path: Path):
    text = path.read_bytes().decode("utf-8-sig")
    rdr = csv.reader(io.StringIO(text, newline=""))
    header = next(rdr)
    rows = [r for r in rdr if r]
    return header, rows


def write_csv(path: Path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.StringIO(newline="")
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    path.write_bytes(buf.getvalue().encode("utf-8"))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--staged", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--repo", type=Path, help="repo checkout holding scripts/repd_updater.py (for repd_master.json)")
    ap.add_argument("--columns-like", type=Path,
                    help="January repd-solar-operational.csv; its header defines that file's column subset")
    a = ap.parse_args(argv)

    header, rows = read_rows(a.staged)
    ix = {norm(h): i for i, h in enumerate(header)}
    for need in ("Technology Type", "Development Status (short)", "Installed Capacity (MWelec)", "Mounting Type for Solar"):
        if need not in ix:
            sys.exit(f"staged CSV lacks column {need!r}")
    T, S, C, M = (ix[k] for k in ("Technology Type", "Development Status (short)",
                                   "Installed Capacity (MWelec)", "Mounting Type for Solar"))
    a.out.mkdir(parents=True, exist_ok=True)
    out_header = [h.replace("﻿", "") for h in header]

    def cap(r):
        return capacity(r[C])

    bat = [r for r in rows if r[T].strip() == "Battery" and r[S].strip() in BATTERY_STATUSES]
    so = [r for r in rows if r[T].strip() == SOLAR and r[S].strip() == "Operational"
          and (cap(r) or 0) > 1 and r[M].strip() in ("Ground", "Roof")]
    so4 = [r for r in rows if r[T].strip() == SOLAR and r[S].strip() == "Operational" and (cap(r) or 0) > 4]

    write_csv(a.out / "repd.csv", out_header, rows)
    write_csv(a.out / "repd-grid-batteries.csv", out_header, bat)
    write_csv(a.out / "repd-solar-operational-over-4mw.csv", out_header, so4)
    if a.columns_like:
        jan_head = a.columns_like.read_bytes().decode("utf-8-sig").splitlines()[0]
        want = [norm(h) for h in next(csv.reader([jan_head]))]
        missing = [w for w in want if w not in ix]
        if missing:
            sys.exit(f"columns-like header has columns absent from staged CSV: {missing}")
        sel = [ix[w] for w in want]
        write_csv(a.out / "repd-solar-operational.csv", [out_header[i] for i in sel], [[r[i] for i in sel] for r in so])
    else:
        write_csv(a.out / "repd-solar-operational.csv", out_header, so)

    counts = {"repd.csv": len(rows), "repd-grid-batteries.csv": len(bat),
              "repd-solar-operational.csv": len(so), "repd-solar-operational-over-4mw.csv": len(so4)}

    if a.repo:
        sys.path.insert(0, str(a.repo / "scripts"))
        import repd_updater  # noqa: E402  (read-only import of the live writer)
        from pyproj import Transformer
        up = repd_updater.REPDUpdater.__new__(repd_updater.REPDUpdater)  # skip __init__ (it mkdirs dist/ in cwd)
        up.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)
        gj = up.refine_dataset(str(a.out / "repd.csv"))
        (a.out / "dist").mkdir(exist_ok=True)
        (a.out / "dist" / "repd_master.json").write_text(json.dumps(gj, separators=(",", ":")), encoding="utf-8")
        counts["dist/repd_master.json"] = len(gj["features"])
    (a.out / "STANDIN_COUNTS.json").write_text(json.dumps(counts, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
