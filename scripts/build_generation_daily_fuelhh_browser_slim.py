#!/usr/bin/env python3
"""
Title: Build Generation Daily FUELHH Browser Slim File
Date UTC: 2026 06 09
Executive summary: Derives a compact browser safe daily MW payload from the canonical
FUELHH candidate spine while preserving the full provenance rich spine as the audit source.

Design rule:
The canonical file remains data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json.
The browser file is uk_energy_tracking_v6/generation_history/generation_daily_fuelhh_browser_slim.json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "data" / "confirmed" / "generation_daily_mw_spine_fuelhh_candidate.json"
DEFAULT_OUTPUT = ROOT / "uk_energy_tracking_v6" / "generation_history" / "generation_daily_fuelhh_browser_slim.json"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
MANIFEST_DIR = ROOT / "uk_energy_tracking_v6" / "generation_history" / "manifests"

KEEP_FIELDS = (
    "date",
    "technology",
    "averageMW",
    "highMW",
    "lowMW",
    "highAtUTC",
    "lowAtUTC",
)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {rel(path)}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("rows"), list):
        rows = payload["rows"]
    elif isinstance(payload, list):
        rows = payload
    else:
        raise ValueError("Input JSON must be either a list or an object with a rows list")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Every row must be a JSON object")
    return rows


def slim_row(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in KEEP_FIELDS:
        if key in row and row[key] is not None:
            out[key] = row[key]
    if "date" not in out or "technology" not in out or "averageMW" not in out:
        raise ValueError(f"Required field missing in row: {row}")
    return out


def build(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    slim = [slim_row(row) for row in rows]
    slim.sort(key=lambda row: (str(row.get("date", "")), str(row.get("technology", ""))))
    seen: set[tuple[str, str]] = set()
    duplicates: list[tuple[str, str]] = []
    for row in slim:
        key = (str(row.get("date", "")), str(row.get("technology", "")))
        if key in seen:
            duplicates.append(key)
        seen.add(key)
    if duplicates:
        raise ValueError(f"Duplicate daily technology rows found: {duplicates[:5]}")
    return slim


def write_payload(output: Path, rows: list[dict[str, Any]], source: Path) -> tuple[int, str]:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "0.1.0-fuelhh-browser-slim",
        "generatedUTC": utc_now(),
        "title": "Generation daily MW FUELHH browser slim file",
        "grain": "daily average high low MW per technology",
        "timezone": "UTC",
        "sourcePath": rel(source),
        "sourceNote": "Derived from Elexon BMRS FUELHH candidate spine. Embedded distribution generation is not added here.",
        "rows": rows,
    }
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    output.write_text(text, encoding="utf-8")
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return output.stat().st_size, sha


def write_reports(report: dict[str, Any], manifest_path: Path) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = "\n".join([
        "# GlobalGrid2050 FUELHH Browser Slim Build Report",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Input path: `{report['inputPath']}`",
        f"Output path: `{report['outputPath']}`",
        f"Input rows: `{report['inputRows']}`",
        f"Output rows: `{report['outputRows']}`",
        f"Output size bytes: `{report['outputSizeBytes']}`",
        f"SHA 256: `{report['sha256']}`",
        "",
        "## Executive summary",
        "",
        "This build creates the browser safe historic daily MW file from the full FUELHH candidate spine. The full spine remains the canonical audit file. The browser file keeps only the fields needed by the chart.",
        "",
        "## Source warning",
        "",
        "FUELHH is transmission metered generation. It must not be represented as complete national solar output until an embedded solar layer is added.",
    ]) + "\n"
    for path in (REPORT_DIR / f"FUELHH_BROWSER_SLIM_{s}.md", REPORT_DIR / "FUELHH_BROWSER_SLIM_LATEST.md"):
        path.write_text(md, encoding="utf-8")
    js = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    for path in (REPORT_JSON_DIR / f"FUELHH_BROWSER_SLIM_{s}.json", REPORT_JSON_DIR / "FUELHH_BROWSER_SLIM_LATEST.json", manifest_path):
        path.write_text(js, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--max-bytes", type=int, default=3_000_000)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    input_path = (ROOT / args.input).resolve() if not Path(args.input).is_absolute() else Path(args.input)
    output_path = (ROOT / args.output).resolve() if not Path(args.output).is_absolute() else Path(args.output)
    rows = load_rows(input_path)
    slim = build(rows)

    if args.apply:
        output_size, sha = write_payload(output_path, slim, input_path)
    else:
        text = json.dumps({"rows": slim}, separators=(",", ":"), ensure_ascii=False)
        output_size = len(text.encode("utf-8"))
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()

    if output_size > args.max_bytes:
        raise SystemExit(f"Slim browser file is too large: {output_size} bytes above {args.max_bytes}")

    report = {
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "inputPath": rel(input_path),
        "outputPath": rel(output_path),
        "inputRows": len(rows),
        "outputRows": len(slim),
        "outputSizeBytes": output_size,
        "sha256": sha,
        "maxBytes": args.max_bytes,
        "keptFields": list(KEEP_FIELDS),
    }
    manifest_path = MANIFEST_DIR / "generation_daily_fuelhh_browser_slim.manifest.json"
    write_reports(report, manifest_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
