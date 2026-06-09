#!/usr/bin/env python3
"""
GridBot Generation History Solar recent heartbeat orchestrator.

Purpose: match Solar to the existing V6 recent generation process.
Audit first. Apply second. No blind app rewrites.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    import yaml
except Exception:
    yaml = None

ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
JSON_DIR = REPORT_DIR / "json"
MANIFEST_DEFAULT = ROOT / "gridbot_manifests" / "011_generation_history_solar_recent.yml"
PVLIVE_URL = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def read_json(path: Path) -> Any:
    if not path.exists():
        return {"rows": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"rows": []}


def load_manifest(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML is required")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def iso_z(value: Any) -> str:
    if value in (None, ""):
        return ""
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return ""


def parse_float(value: Any) -> float | None:
    try:
        out = float(value)
        if out == out:
            return out
    except Exception:
        return None
    return None


def http_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_rows(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def parse_pvlive_row(row: Any) -> dict[str, Any] | None:
    if isinstance(row, list):
        if len(row) < 3:
            return None
        timestamp = row[1]
        generation = row[2]
    elif isinstance(row, dict):
        timestamp = row.get("datetime_gmt") or row.get("datetime") or row.get("time") or row.get("timestamp") or row.get("periodStartUTC")
        generation = row.get("generation_mw") or row.get("generationMW") or row.get("generation") or row.get("power")
    else:
        return None
    t = iso_z(timestamp)
    mw = parse_float(generation)
    if not t or mw is None:
        return None
    return {
        "time": t,
        "technology": "Solar",
        "generationMW": round(mw, 3),
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
    }


def candidate_urls(start: dt.datetime, end: dt.datetime) -> list[str]:
    start_iso = start.isoformat().replace("+00:00", "Z")
    end_iso = end.isoformat().replace("+00:00", "Z")
    params = [
        {"start": start_iso, "end": end_iso},
        {"from": start_iso, "to": end_iso},
        {"datetime_from": start_iso, "datetime_to": end_iso},
        {"start_date": start.date().isoformat(), "end_date": end.date().isoformat()},
    ]
    return [PVLIVE_URL + "?" + urllib.parse.urlencode(p) for p in params]


def fetch_range(days: int) -> tuple[list[dict[str, Any]], str, list[str]]:
    today = dt.datetime.now(dt.timezone.utc).date()
    start = dt.datetime.combine(today - dt.timedelta(days=max(1, days)), dt.time(0, 0), tzinfo=dt.timezone.utc)
    end = dt.datetime.combine(today - dt.timedelta(days=1), dt.time(23, 59), tzinfo=dt.timezone.utc)
    errors: list[str] = []
    for url in candidate_urls(start, end):
        try:
            rows = []
            for raw in extract_rows(http_json(url)):
                parsed = parse_pvlive_row(raw)
                if parsed:
                    rows.append(parsed)
            if rows:
                rows.sort(key=lambda r: r["time"])
                return rows, url, []
        except Exception as exc:
            errors.append(str(exc))
    return [], "", errors[-5:]


def existing_recent_audit(config_path: str, loader_path: str, recent_path: str) -> dict[str, Any]:
    config = read_text(ROOT / config_path)
    loader = read_text(ROOT / loader_path)
    payload = read_json(ROOT / recent_path)
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    first = rows[0] if rows else {}
    return {
        "configPath": config_path,
        "loaderPath": loader_path,
        "recentPath": recent_path,
        "recentPathExists": (ROOT / recent_path).exists(),
        "configHasRecentHalfHourly": "recentHalfHourly" in config,
        "configHasRecentEcg": "recentEcg" in config,
        "loaderRecentTierFor30d": "'30d'].indexOf(p)>=0?'recent':'daily'" in loader,
        "loaderHasLoadRecent": "function loadRecent()" in loader,
        "recentRows": len(rows),
        "firstRowFields": sorted(first.keys()) if isinstance(first, dict) else [],
        "pass": "recentEcg" in config and "function loadRecent()" in loader,
    }


def pvlive_recent_audit(days: int) -> dict[str, Any]:
    rows, url, errors = fetch_range(min(days, 3))
    return {
        "daysChecked": min(days, 3),
        "rowsFound": len(rows),
        "expectedRowsApprox": min(days, 3) * 48,
        "workingUrl": url,
        "firstTime": rows[0]["time"] if rows else None,
        "lastTime": rows[-1]["time"] if rows else None,
        "errors": errors,
        "pass": len(rows) >= min(days, 3) * 40,
    }


def build_recent_browser(output_path: str, days: int, max_bytes: int, apply: bool) -> dict[str, Any]:
    rows, url, errors = fetch_range(days)
    seen = set()
    deduped = []
    for row in rows:
        key = (row["time"], row["technology"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    payload = {
        "schemaVersion": "0.1.0-pvlive-solar-recent-30min-browser",
        "title": "PVLive solar recent 30 minute browser file",
        "generatedUTC": utc_now(),
        "timezone": "UTC",
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "rows": deduped,
    }
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    byte_count = len(text.encode("utf-8"))
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    ok = len(deduped) >= days * 40 and byte_count <= max_bytes
    if apply and ok:
        path = ROOT / output_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return {
        "outputPath": output_path,
        "daysRequested": days,
        "rows": len(deduped),
        "expectedRowsApprox": days * 48,
        "firstTime": deduped[0]["time"] if deduped else None,
        "lastTime": deduped[-1]["time"] if deduped else None,
        "estimatedBytes": byte_count,
        "maxBytes": max_bytes,
        "sha256": sha,
        "workingUrl": url,
        "errors": errors,
        "apply": apply,
        "pass": ok,
    }


def solar_recent_ui_audit(config_path: str, loader_path: str, solar_recent_path: str) -> dict[str, Any]:
    config = read_text(ROOT / config_path)
    loader = read_text(ROOT / loader_path)
    exists = (ROOT / solar_recent_path).exists()
    return {
        "configPath": config_path,
        "loaderPath": loader_path,
        "solarRecentPath": solar_recent_path,
        "solarRecentExists": exists,
        "configHasSolarRecent": "solarRecentHalfHourly" in config,
        "loaderHasLoadSolarRecent": "loadSolarRecent" in loader,
        "loaderRoutesSolarRecent": "technology==='Solar'?loadSolarRecent():loadRecent()" in loader,
        "dailyHistoryStillFullFUELHH": "/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json" in config,
        "recentEcgStillPresent": "recentEcg" in config,
        "pass": exists and "recentEcg" in config and "/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json" in config,
    }


def wire_solar_recent(config_path: str, loader_path: str, solar_recent_path: str, apply: bool) -> dict[str, Any]:
    before = solar_recent_ui_audit(config_path, loader_path, solar_recent_path)
    if not before["solarRecentExists"]:
        return {**before, "apply": apply, "applied": False, "error": "solar recent browser file does not exist"}
    config_file = ROOT / config_path
    loader_file = ROOT / loader_path
    config = read_text(config_file)
    loader = read_text(loader_file)
    changed = []
    if "solarRecentHalfHourly" not in config:
        old = "  solarDaily:'/uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json',\n"
        new = old + f"  solarRecentHalfHourly:'/{solar_recent_path}',\n"
        if old not in config:
            return {**before, "apply": apply, "applied": False, "error": "config anchor missing"}
        config = config.replace(old, new, 1)
        changed.append(config_path)
    if "loadSolarRecent" not in loader:
        old = "function loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
        new = "function loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}\nfunction loadSolarRecent(){return loadJsonOnce('solarRecent',cfg().solarRecentHalfHourly||cfg().recentEcg||cfg().recentHalfHourly)}"
        if old not in loader:
            return {**before, "apply": apply, "applied": False, "error": "loader recent anchor missing"}
        loader = loader.replace(old, new, 1)
        changed.append(loader_path)
    if "technology==='Solar'?loadSolarRecent():loadRecent()" not in loader:
        old = "function loadHalf(meta,technology,timeMode){return loadRecent().then(function(all){var rows=all.filter(function(r){var t=new Date(r.time);if(t<meta.start||t>meta.end)return false;if(timeMode==='day'){var h=t.getUTCHours();return h>=6&&h<18}if(timeMode==='night'){var hn=t.getUTCHours();return hn>=18||hn<6}return true});rows=dedupe(sortHalf(rows),function(r){return r.time+'|'+r.technology});if(isAll(technology))return{rows:totalHalf(rows),series:seriesHalf(rows),technology:'All generation total'};var only=sortHalf(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
        new = "function loadHalf(meta,technology,timeMode){var source=technology==='Solar'?loadSolarRecent():loadRecent();return source.then(function(all){var rows=all.filter(function(r){var t=new Date(r.time);if(t<meta.start||t>meta.end)return false;if(timeMode==='day'){var h=t.getUTCHours();return h>=6&&h<18}if(timeMode==='night'){var hn=t.getUTCHours();return hn>=18||hn<6}return true});rows=dedupe(sortHalf(rows),function(r){return r.time+'|'+r.technology});if(isAll(technology))return{rows:totalHalf(rows),series:seriesHalf(rows),technology:'All generation total'};var only=sortHalf(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
        if old not in loader:
            return {**before, "apply": apply, "applied": False, "error": "loader half hour route anchor missing"}
        loader = loader.replace(old, new, 1)
        if loader_path not in changed:
            changed.append(loader_path)
    if apply and changed:
        config_file.write_text(config, encoding="utf-8")
        loader_file.write_text(loader, encoding="utf-8")
    after = solar_recent_ui_audit(config_path, loader_path, solar_recent_path)
    return {**after, "apply": apply, "applied": bool(apply and changed), "plannedOrChangedFiles": changed}


def render_report(payload: dict[str, Any]) -> str:
    lines = [
        "# GridBot Generation History Solar Recent Report",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Manifest: `{payload['manifestPath']}`",
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
        apply_phase = bool(args.apply and phase.get("applyByDefault", False))
        op = phase.get("operation")
        if op == "existing_recent_audit":
            result = existing_recent_audit(phase["configPath"], phase["loaderPath"], phase["recentPath"])
        elif op == "pvlive_recent_audit":
            result = pvlive_recent_audit(int(phase.get("days", 3)))
        elif op == "build_recent_browser":
            result = build_recent_browser(phase["outputPath"], int(phase.get("days", 30)), int(phase.get("maxBytes", 750000)), apply_phase)
        elif op == "solar_recent_ui_audit":
            result = solar_recent_ui_audit(phase["configPath"], phase["loaderPath"], phase["solarRecentPath"])
        elif op == "wire_solar_recent":
            result = wire_solar_recent(phase["configPath"], phase["loaderPath"], phase["solarRecentPath"], apply_phase)
        else:
            result = {"error": f"unknown operation {op}", "pass": False}
        phase_out = dict(phase)
        phase_out["applied"] = apply_phase
        phase_out["result"] = result
        phases_out.append(phase_out)
    payload = {
        "reportTitle": "GridBot Generation History Solar Recent Report",
        "schemaVersion": "0.1.0",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "manifestPath": manifest_path.relative_to(ROOT).as_posix() if manifest_path.exists() else str(manifest_path),
        "phases": phases_out,
        "executiveSummary": f"GridBot solar recent workflow ran {len(phases_out)} phases in {'apply' if args.apply else 'audit only'} mode. Apply only affects phases with applyByDefault true.",
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = REPORT_DIR / f"GENERATION_HISTORY_SOLAR_RECENT_{s}.md"
    js = JSON_DIR / f"GENERATION_HISTORY_SOLAR_RECENT_{s}.json"
    latest_md = REPORT_DIR / "GENERATION_HISTORY_SOLAR_RECENT_LATEST.md"
    latest_js = JSON_DIR / "GENERATION_HISTORY_SOLAR_RECENT_LATEST.json"
    md_text = render_report(payload)
    json_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in (md, latest_md):
        path.write_text(md_text, encoding="utf-8")
    for path in (js, latest_js):
        path.write_text(json_text, encoding="utf-8")
    print(payload["executiveSummary"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
