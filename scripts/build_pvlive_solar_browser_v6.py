#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "data" / "confirmed" / "pvlive_solar_daily_candidate.json"
OUTPUT = ROOT / "uk_energy_tracking_v6" / "generation_history" / "pvlive_solar_daily_browser.json"
MANIFEST = ROOT / "uk_energy_tracking_v6" / "generation_history" / "manifests" / "pvlive_solar_daily_browser.manifest.json"
REPORT_MD = ROOT / "data_science_protocol" / "audit_reports" / "PVLIVE_SOLAR_BROWSER_LATEST.md"
REPORT_JSON = ROOT / "data_science_protocol" / "audit_reports" / "json" / "PVLIVE_SOLAR_BROWSER_LATEST.json"
KEEP = ("date", "technology", "averageMW", "highMW", "lowMW", "sampleCount", "source", "methodState", "status")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_rows() -> list[dict[str, Any]]:
    if not INPUT.exists():
        raise FileNotFoundError(f"Missing input: {INPUT.relative_to(ROOT)}")
    payload = json.loads(INPUT.read_text(encoding="utf-8"))
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        raise ValueError("Input rows must be a list")
    return [row for row in rows if isinstance(row, dict)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-bytes", type=int, default=500000)
    args = ap.parse_args()
    rows = []
    seen = set()
    for row in load_rows():
        out = {k: row[k] for k in KEEP if k in row}
        if out.get("technology") != "Solar":
            continue
        if not out.get("date") or "averageMW" not in out:
            continue
        key = out["date"]
        if key in seen:
            raise ValueError(f"Duplicate solar browser date: {key}")
        seen.add(key)
        rows.append(out)
    rows.sort(key=lambda r: r["date"])
    if not rows:
        raise SystemExit("No solar rows available for browser file")
    payload = {
        "schemaVersion": "0.1.0-pvlive-solar-browser",
        "title": "PVLive solar daily browser file",
        "timezone": "UTC",
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "rows": rows,
    }
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    if len(text.encode("utf-8")) > args.max_bytes:
        raise SystemExit(f"Browser solar file exceeds max bytes: {len(text.encode('utf-8'))}")
    write_text(OUTPUT, text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    report = {
        "inputPath": str(INPUT.relative_to(ROOT)),
        "outputPath": str(OUTPUT.relative_to(ROOT)),
        "rows": len(rows),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha,
        "firstDate": rows[0]["date"],
        "lastDate": rows[-1]["date"],
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
    }
    write_text(MANIFEST, json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    write_text(REPORT_JSON, json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    write_text(REPORT_MD, "\n".join([
        "# PVLive Solar Browser Build Audit",
        "",
        f"Input path: `{report['inputPath']}`",
        f"Output path: `{report['outputPath']}`",
        f"Rows: `{report['rows']}`",
        f"Bytes: `{report['bytes']}`",
        f"SHA 256: `{report['sha256']}`",
        f"Date range: `{report['firstDate']}` to `{report['lastDate']}`",
        "",
        "This file is the browser safe solar output layer. It is separate from FUELHH transmission metered history.",
    ]) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
