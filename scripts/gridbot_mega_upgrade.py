#!/usr/bin/env python3
"""
GlobalGrid2050 GridBot mega upgrade orchestrator.

Manifest driven, audit first, CI suitable. This script is designed to be run
from GitHub Actions by a human triggered workflow. It can run in audit only
mode or apply selected safe patches. It never deletes data and never rewrites
Git history.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
JSON_DIR = REPORT_DIR / "json"
MANIFEST_DEFAULT = ROOT / "gridbot_manifests" / "001_generation_data_discipline.yml"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_git(args: list[str]) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ""


def mib(size: int) -> float:
    return round(size / 1024 / 1024, 3)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"rows": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"rows": []}


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_manifest(path: Path) -> dict[str, Any]:
    if yaml is not None:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    raise RuntimeError("PyYAML is required for gridbot manifest parsing")


def repo_size_audit() -> dict[str, Any]:
    excluded = {".git", ".venv", "venv", "env", "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache"}
    review_ext = {".csv", ".json", ".geojson", ".topojson", ".parquet", ".zip", ".db", ".sqlite"}
    rows = []
    total = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        parts = path.relative_to(ROOT).parts
        if any(part in excluded for part in parts):
            continue
        size = path.stat().st_size
        total += size
        suffix = path.suffix.lower()
        if suffix not in review_ext and size < 5 * 1024 * 1024:
            continue
        rel = path.relative_to(ROOT).as_posix()
        low = rel.lower()
        if size >= 25 * 1024 * 1024:
            risk = "fail_threshold"
        elif size >= 5 * 1024 * 1024:
            risk = "warn_threshold"
        else:
            risk = "tracked"
        if suffix in {".geojson", ".topojson"}:
            kind = "gis"
        elif "archive" in low or "raw" in low or "half_hourly" in low:
            kind = "raw_or_archive_candidate"
        else:
            kind = "data_or_asset"
        if risk != "tracked" or kind in {"gis", "raw_or_archive_candidate"}:
            rows.append({"path": rel, "sizeMiB": mib(size), "risk": risk, "kind": kind})
    return {"totalWorkingTreeMiB": mib(total), "reviewFiles": sorted(rows, key=lambda r: r["sizeMiB"], reverse=True)}


def patch_gitignore(patterns: list[str], apply: bool) -> dict[str, Any]:
    path = ROOT / ".gitignore"
    existing = read_text(path)
    lines = existing.splitlines()
    present = {line.strip() for line in lines}
    additions = [p for p in patterns if p not in present]
    if apply and additions:
        if lines and lines[-1].strip():
            lines.append("")
        if "# GlobalGrid2050 generation archive discipline" not in present:
            lines.append("# GlobalGrid2050 generation archive discipline")
            lines.append("# Raw generation archives are transient CI inputs unless explicitly approved.")
        lines.extend(additions)
        path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return {"path": ".gitignore", "patternsAdded": additions, "applied": bool(apply and additions)}


def floor_to_30min(ts: datetime) -> datetime:
    minute = 0 if ts.minute < 30 else 30
    return ts.replace(minute=minute, second=0, microsecond=0)


def parse_ts(value: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def resample_recent_30min(source_path: Path, output_path: Path, apply: bool) -> dict[str, Any]:
    payload = read_json(source_path)
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    counts: defaultdict[tuple[str, str], int] = defaultdict(int)
    sums: defaultdict[tuple[str, str], float] = defaultdict(float)

    for row in rows:
        t = parse_ts(row.get("time") or row.get("ts") or row.get("periodStartUTC"))
        tech = row.get("technology")
        if t is None or not tech:
            continue
        mw = row.get("generationMW", row.get("mw"))
        try:
            mwf = float(mw)
            if not math.isfinite(mwf):
                continue
        except Exception:
            continue
        bucket_time = floor_to_30min(t).isoformat().replace("+00:00", "Z")
        key = (bucket_time, str(tech))
        sums[key] += mwf
        counts[key] += 1

    out_rows = []
    for (bucket_time, tech), total in sorted(sums.items()):
        n = counts[(bucket_time, tech)]
        out_rows.append({
            "time": bucket_time,
            "technology": tech,
            "generationMW": round(total / n, 3),
            "records": n,
            "source": "30 minute average resampled from recent generation source",
        })

    out_payload = {
        "schemaVersion": "1.0.0",
        "generatedUTC": utc_now(),
        "sourcePath": source_path.relative_to(ROOT).as_posix() if source_path.exists() else str(source_path),
        "description": "True 30 minute recent generation MW slice resampled by UTC half hour.",
        "unit": "MW",
        "rows": out_rows,
    }

    if apply:
        write_json(output_path, out_payload)

    source_size = source_path.stat().st_size if source_path.exists() else 0
    output_estimate = len(json.dumps(out_payload).encode("utf-8"))
    return {
        "sourcePath": source_path.relative_to(ROOT).as_posix() if source_path.exists() else str(source_path),
        "outputPath": output_path.relative_to(ROOT).as_posix(),
        "sourceRows": len(rows),
        "outputRows": len(out_rows),
        "sourceMiB": mib(source_size),
        "outputEstimatedMiB": mib(output_estimate),
        "applied": apply,
    }


def rewire_recent_loader(config_path: Path, old_path: str, new_path: str, apply: bool) -> dict[str, Any]:
    text = read_text(config_path)
    found_old = old_path in text
    found_new = new_path in text
    changed = False
    if apply and found_old:
        text = text.replace(old_path, new_path)
        config_path.write_text(text, encoding="utf-8")
        changed = True
    return {
        "configPath": config_path.relative_to(ROOT).as_posix() if config_path.exists() else str(config_path),
        "oldPathFound": found_old,
        "newPathAlreadyPresent": found_new,
        "applied": changed,
    }


def source_routing_audit(loader_path: Path, config_path: Path | None = None) -> dict[str, Any]:
    text = read_text(loader_path)
    cfg_text = read_text(config_path) if config_path else ""
    return {
        "loaderPath": loader_path.relative_to(ROOT).as_posix() if loader_path.exists() else str(loader_path),
        "configPath": config_path.relative_to(ROOT).as_posix() if config_path and config_path.exists() else None,
        "exists": loader_path.exists(),
        "hasTierFor": "function tierFor" in text,
        "longRangesRouteDaily": "'3m'" in text and "'10y'" in text and "daily" in text,
        "recentTierPresent": "recent" in text,
        "configStillUsesOldRecentFile": "generation_recent_halfhourly_30d.json" in cfg_text,
        "configUsesNewRecentFile": "generation_recent_30d_30min.json" in cfg_text,
    }


def non_additive_peak_audit(loader_path: Path) -> dict[str, Any]:
    text = read_text(loader_path)
    patterns = [
        r"highMW\s*\+=",
        r"lowMW\s*\+=",
        r"\.highMW\s*=\s*[^;]+\+\s*Number",
        r"\.lowMW\s*=\s*[^;]+\+\s*Number",
    ]
    hits = []
    for pat in patterns:
        if re.search(pat, text):
            hits.append(pat)
    return {"loaderPath": loader_path.relative_to(ROOT).as_posix() if loader_path.exists() else str(loader_path), "hits": hits, "riskPresent": bool(hits)}


def merge_guard_audit(script_path: Path) -> dict[str, Any]:
    text = read_text(script_path)
    danger = "for row in existing + new_rows" in text and "merged[key] = row" in text
    signals = ["should_replace_existing", "weak_row", "FAIL_ON_WEAK_OVERWRITE", "completeness", "record_count"]
    present = [s for s in signals if s in text]
    return {
        "scriptPath": script_path.relative_to(ROOT).as_posix() if script_path.exists() else str(script_path),
        "exists": script_path.exists(),
        "dangerousLastWriteWinsPatternPresent": danger,
        "guardSignalsPresent": present,
        "appearsGuarded": bool(present) and not danger,
    }


def confirmed_fact_source_audit(script_paths: list[str], data_paths: list[str]) -> dict[str, Any]:
    script_results = []
    for rel in script_paths:
        path = ROOT / rel
        text = read_text(path)
        script_results.append({
            "path": rel,
            "exists": path.exists(),
            "mentionsFUELINST": "FUELINST" in text,
            "mentionsFUELHH": "FUELHH" in text,
        })
    data_results = []
    for rel in data_paths:
        path = ROOT / rel
        payload = read_json(path)
        source_text = json.dumps({k: payload.get(k) for k in ("source", "sourceDatasets", "metadata", "description")}, ensure_ascii=False)
        data_results.append({
            "path": rel,
            "exists": path.exists(),
            "mentionsFUELINST": "FUELINST" in source_text,
            "mentionsFUELHH": "FUELHH" in source_text,
            "sourceText": source_text[:500],
        })
    return {"scripts": script_results, "dataFiles": data_results}


def confirmed_fact_schema_audit(paths: list[str], required_metadata: list[str], required_row_fields: list[str]) -> dict[str, Any]:
    results = []
    for rel in paths:
        path = ROOT / rel
        payload = read_json(path)
        rows = payload.get("rows", []) if isinstance(payload, dict) else []
        metadata = payload.get("metadata", payload if isinstance(payload, dict) else {})
        first = rows[0] if rows else {}
        missing_meta = [m for m in required_metadata if m not in metadata]
        missing_rows = [f for f in required_row_fields if f not in first]
        results.append({
            "path": rel,
            "exists": path.exists(),
            "rowCount": len(rows),
            "missingMetadata": missing_meta,
            "missingRowFields": missing_rows,
        })
    return {"files": results}


def render_report(payload: dict[str, Any]) -> str:
    lines = [
        "# GlobalGrid2050 GridBot Mega Upgrade Report",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Manifest: `{payload['manifestPath']}`",
        f"Git head: `{payload['gitHead'] or 'unknown'}`",
        "",
        "## Executive summary",
        "",
        payload["executiveSummary"],
        "",
        "## Phase results",
        "",
    ]
    for phase in payload["phases"]:
        lines.append(f"### {phase['id']}  {phase.get('title', '')}")
        lines.append("")
        lines.append(f"Operation: `{phase['operation']}`")
        lines.append(f"Applied: `{phase.get('applied', False)}`")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(phase.get("result", {}), indent=2))
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(MANIFEST_DEFAULT))
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--phase", default="all")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = load_manifest(manifest_path)
    phases_out = []

    for phase in manifest.get("phases", []):
        if not phase.get("enabled", True):
            continue
        if args.phase != "all" and phase.get("id") != args.phase:
            continue
        op = phase.get("operation")
        apply_phase = bool(args.apply and phase.get("applyByDefault", False))
        if op == "repo_size_audit":
            result = repo_size_audit()
        elif op == "patch_gitignore":
            result = patch_gitignore(phase.get("patterns", []), apply_phase)
        elif op == "resample_recent_30min":
            result = resample_recent_30min(ROOT / phase["sourcePath"], ROOT / phase["outputPath"], apply_phase)
        elif op == "rewire_recent_loader":
            result = rewire_recent_loader(ROOT / phase["configPath"], phase["oldPath"], phase["newPath"], apply_phase)
        elif op == "source_routing_audit":
            cfg = ROOT / phase["configPath"] if phase.get("configPath") else None
            result = source_routing_audit(ROOT / phase["loaderPath"], cfg)
        elif op == "non_additive_peak_audit":
            result = non_additive_peak_audit(ROOT / phase["loaderPath"])
        elif op == "merge_guard_audit":
            result = merge_guard_audit(ROOT / phase["scriptPath"])
        elif op == "confirmed_fact_source_audit":
            result = confirmed_fact_source_audit(phase.get("scriptPaths", []), phase.get("dataPaths", []))
        elif op == "confirmed_fact_schema_audit":
            result = confirmed_fact_schema_audit(phase.get("paths", []), phase.get("requiredMetadata", []), phase.get("requiredRowFields", []))
        else:
            result = {"error": f"unknown operation {op}"}
        phase_out = dict(phase)
        phase_out["applied"] = apply_phase
        phase_out["result"] = result
        phases_out.append(phase_out)

    payload = {
        "reportTitle": "GlobalGrid2050 GridBot Mega Upgrade Report",
        "schemaVersion": "1.1.0",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "manifestPath": manifest_path.relative_to(ROOT).as_posix() if manifest_path.exists() else str(manifest_path),
        "gitHead": run_git(["rev-parse", "--short", "HEAD"]),
        "phases": phases_out,
        "executiveSummary": f"GridBot ran {len(phases_out)} phases in {'apply' if args.apply else 'audit only'} mode. Apply only affects phases with applyByDefault true.",
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    st = stamp()
    md = REPORT_DIR / f"GRIDBOT_MEGA_UPGRADE_{st}.md"
    js = JSON_DIR / f"GRIDBOT_MEGA_UPGRADE_{st}.json"
    latest_md = REPORT_DIR / "GRIDBOT_MEGA_UPGRADE_LATEST.md"
    latest_js = JSON_DIR / "GRIDBOT_MEGA_UPGRADE_LATEST.json"
    md_text = render_report(payload)
    json_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    md.write_text(md_text, encoding="utf-8")
    latest_md.write_text(md_text, encoding="utf-8")
    js.write_text(json_text, encoding="utf-8")
    latest_js.write_text(json_text, encoding="utf-8")
    print(payload["executiveSummary"])
    print(f"Wrote {md.relative_to(ROOT)}")
    print(f"Wrote {js.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
