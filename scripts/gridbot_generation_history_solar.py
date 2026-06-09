#!/usr/bin/env python3
"""
GridBot Generation History Solar orchestrator.

Audit first, apply second. This script follows the GridBot Mega Upgrade pattern:
manifest driven phases, audit mode by default, apply only where a phase declares
applyByDefault true. It writes reports before trust and does not rewrite the app
blindly.
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
MANIFEST_DEFAULT = ROOT / "gridbot_manifests" / "010_generation_history_solar_ui.yml"
PVLIVE_URL = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def read_json(path: Path) -> Any:
    if not path.exists():
        return {"rows": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"rows": []}


def write_json(path: Path, payload: Any, compact: bool = False) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    else:
        text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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


def parse_pvlive_row(row: Any) -> tuple[str, float] | None:
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
    return t, mw


def candidate_urls(day: dt.date) -> list[str]:
    start = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    start_iso = start.isoformat().replace("+00:00", "Z")
    end_iso = end.isoformat().replace("+00:00", "Z")
    start_plain = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_plain = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    params = [
        {"start": start_iso, "end": end_iso},
        {"start": start_plain, "end": end_plain},
        {"from": start_iso, "to": end_iso},
        {"datetime_from": start_iso, "datetime_to": end_iso},
        {"start_date": day.isoformat(), "end_date": day.isoformat()},
    ]
    return [PVLIVE_URL + "?" + urllib.parse.urlencode(p) for p in params]


def fetch_day(day: dt.date) -> tuple[list[float], str, str]:
    errors: list[str] = []
    for url in candidate_urls(day):
        try:
            values: list[float] = []
            for row in extract_rows(http_json(url)):
                parsed = parse_pvlive_row(row)
                if parsed:
                    values.append(parsed[1])
            if values:
                return values, url, ""
        except Exception as exc:
            errors.append(str(exc))
    return [], "", "; ".join(errors[-3:])


def pvlive_endpoint_audit(days: int) -> dict[str, Any]:
    today = dt.datetime.now(dt.timezone.utc).date()
    checked = []
    rows_found = 0
    working_url = ""
    for offset in range(max(1, days)):
        day = today - dt.timedelta(days=1 + offset)
        values, url, err = fetch_day(day)
        checked.append({"date": day.isoformat(), "rows": len(values), "error": err[:200]})
        rows_found += len(values)
        if url and not working_url:
            working_url = url
    return {"daysChecked": days, "rowsFound": rows_found, "workingUrl": working_url, "sample": checked[:5], "pass": rows_found > 0}


def fetch_candidate(output_path: str, days: int, apply: bool) -> dict[str, Any]:
    out = ROOT / output_path
    today = dt.datetime.now(dt.timezone.utc).date()
    start_day = today - dt.timedelta(days=max(1, days))
    existing = {}
    old_payload = read_json(out)
    if isinstance(old_payload, dict):
        for row in old_payload.get("rows", []):
            if isinstance(row, dict) and row.get("date"):
                existing[row["date"]] = row
    fetched_days = 0
    failures = []
    working_url = ""
    for offset in range(max(1, days)):
        day = start_day + dt.timedelta(days=offset)
        values, url, err = fetch_day(day)
        if values:
            fetched_days += 1
            if not working_url:
                working_url = url
            existing[day.isoformat()] = {
                "date": day.isoformat(),
                "technology": "Solar",
                "averageMW": round(sum(values) / len(values), 3),
                "highMW": round(max(values), 3),
                "lowMW": round(min(values), 3),
                "sampleCount": len(values),
                "source": "Sheffield Solar PVLive",
                "methodState": "PVLIVE EMBEDDED ESTIMATE",
                "status": "candidate",
            }
        else:
            failures.append({"date": day.isoformat(), "error": err[:250] or "no rows"})
    rows = [existing[k] for k in sorted(existing)]
    payload = {
        "schemaVersion": "0.1.0-pvlive-solar-daily-candidate",
        "generatedUTC": utc_now(),
        "title": "PVLive solar daily MW candidate",
        "timezone": "UTC",
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "rows": rows,
    }
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if apply:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    return {
        "outputPath": output_path,
        "apply": apply,
        "daysRequested": days,
        "daysFetched": fetched_days,
        "rowsAfterMerge": len(rows),
        "estimatedBytes": len(text.encode("utf-8")),
        "sha256": sha,
        "workingUrl": working_url,
        "failures": failures[-10:],
        "pass": fetched_days > 0,
    }


def build_browser(input_path: str, output_path: str, max_bytes: int, apply: bool) -> dict[str, Any]:
    source = ROOT / input_path
    out = ROOT / output_path
    payload = read_json(source)
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    slim = []
    seen = set()
    keep = ("date", "technology", "averageMW", "highMW", "lowMW", "sampleCount", "source", "methodState", "status")
    for row in rows:
        if not isinstance(row, dict) or row.get("technology") != "Solar" or not row.get("date"):
            continue
        if row["date"] in seen:
            return {"inputPath": input_path, "outputPath": output_path, "error": f"duplicate date {row['date']}", "pass": False}
        seen.add(row["date"])
        slim.append({k: row[k] for k in keep if k in row})
    slim.sort(key=lambda r: r["date"])
    browser_payload = {
        "schemaVersion": "0.1.0-pvlive-solar-browser",
        "title": "PVLive solar daily browser file",
        "timezone": "UTC",
        "source": "Sheffield Solar PVLive",
        "methodState": "PVLIVE EMBEDDED ESTIMATE",
        "rows": slim,
    }
    text = json.dumps(browser_payload, separators=(",", ":"), ensure_ascii=False)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    byte_count = len(text.encode("utf-8"))
    ok = bool(slim) and byte_count <= max_bytes
    if apply and ok:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    return {
        "inputPath": input_path,
        "inputExists": source.exists(),
        "outputPath": output_path,
        "apply": apply,
        "rows": len(slim),
        "firstDate": slim[0]["date"] if slim else None,
        "lastDate": slim[-1]["date"] if slim else None,
        "estimatedBytes": byte_count,
        "maxBytes": max_bytes,
        "sha256": sha,
        "pass": ok,
    }


def ui_wire_audit(config_path: str, loader_path: str, index_path: str, solar_path: str) -> dict[str, Any]:
    config = read_text(ROOT / config_path)
    loader = read_text(ROOT / loader_path)
    index = read_text(ROOT / index_path)
    solar_exists = (ROOT / solar_path).exists()
    return {
        "configPath": config_path,
        "loaderPath": loader_path,
        "indexPath": index_path,
        "solarBrowserPath": solar_path,
        "solarBrowserExists": solar_exists,
        "configHasSolarDaily": "solarDaily" in config,
        "loaderHasSolarDailyLoader": "loadSolarDaily" in loader,
        "loaderRoutesSolarDaily": "technology==='Solar'?loadSolarDaily():loadDaily()" in loader,
        "indexMentionsPVLiveLayer": "PVLive" in index and "separate" in index,
        "recentEcgStillPresent": "recentEcg" in config,
        "dailyHistoryStillFullFUELHH": "/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json" in config,
        "pass": solar_exists and "recentEcg" in config,
    }


def wire_ui(config_path: str, loader_path: str, index_path: str, solar_path: str, apply: bool) -> dict[str, Any]:
    audit = ui_wire_audit(config_path, loader_path, index_path, solar_path)
    config_file = ROOT / config_path
    loader_file = ROOT / loader_path
    index_file = ROOT / index_path
    changed = []
    if not audit["solarBrowserExists"]:
        return {**audit, "apply": apply, "applied": False, "error": "solar browser file does not exist"}
    config = read_text(config_file)
    if "solarDaily" not in config:
        old = "  dailyHistoryFallback:'/data/generation/elexon_generation_sources_2016.json',\n"
        new = old + f"  solarDaily:'/{solar_path}',\n"
        if old not in config:
            return {**audit, "apply": apply, "applied": False, "error": "config anchor missing"}
        if apply:
            config_file.write_text(config.replace(old, new, 1), encoding="utf-8")
        changed.append(config_path)
    loader = read_text(loader_file)
    if "loadSolarDaily" not in loader:
        old = "function loadDaily(){return loadJsonOnce('daily',cfg().dailyHistory)}\nfunction loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
        new = "function loadDaily(){return loadJsonOnce('daily',cfg().dailyHistory)}\nfunction loadSolarDaily(){return loadJsonOnce('solarDaily',cfg().solarDaily||cfg().dailyHistory)}\nfunction loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}"
        if old not in loader:
            return {**audit, "apply": apply, "applied": False, "error": "loader load anchor missing"}
        loader = loader.replace(old, new, 1)
    if "technology==='Solar'?loadSolarDaily():loadDaily()" not in loader:
        old = "function loadDailyWindow(meta,technology){return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});rows=dedupe(sortDaily(rows),function(r){return r.date+'|'+r.technology});if(isAll(technology))return{rows:totalDaily(rows),series:seriesDaily(rows),technology:'All generation total'};var only=sortDaily(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
        new = "function loadDailyWindow(meta,technology){var source=technology==='Solar'?loadSolarDaily():loadDaily();return source.then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});rows=dedupe(sortDaily(rows),function(r){return r.date+'|'+r.technology});if(isAll(technology))return{rows:totalDaily(rows),series:seriesDaily(rows),technology:'All generation total'};var only=sortDaily(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}"
        if old not in loader:
            return {**audit, "apply": apply, "applied": False, "error": "loader route anchor missing"}
        loader = loader.replace(old, new, 1)
    if loader != read_text(loader_file):
        if apply:
            loader_file.write_text(loader, encoding="utf-8")
        changed.append(loader_path)
    index = read_text(index_file)
    if "PVLive candidate layer" not in index:
        old = "Embedded or national solar output will be added as a separate layer."
        new = "Embedded solar output is routed through a separate PVLive candidate layer where the solar browser file is present."
        if old in index:
            if apply:
                index_file.write_text(index.replace(old, new, 1), encoding="utf-8")
            changed.append(index_path)
    after = ui_wire_audit(config_path, loader_path, index_path, solar_path)
    return {**after, "apply": apply, "applied": bool(apply and changed), "plannedOrChangedFiles": changed}


def render_report(payload: dict[str, Any]) -> str:
    lines = [
        "# GridBot Generation History Solar Report",
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
        if op == "pvlive_endpoint_audit":
            result = pvlive_endpoint_audit(int(phase.get("days", 3)))
        elif op == "fetch_pvlive_candidate":
            result = fetch_candidate(phase["outputPath"], int(phase.get("days", 30)), apply_phase)
        elif op == "build_solar_browser":
            result = build_browser(phase["inputPath"], phase["outputPath"], int(phase.get("maxBytes", 500000)), apply_phase)
        elif op == "ui_wire_audit":
            result = ui_wire_audit(phase["configPath"], phase["loaderPath"], phase["indexPath"], phase["solarBrowserPath"])
        elif op == "wire_solar_ui":
            result = wire_ui(phase["configPath"], phase["loaderPath"], phase["indexPath"], phase["solarBrowserPath"], apply_phase)
        else:
            result = {"error": f"unknown operation {op}", "pass": False}
        phase_out = dict(phase)
        phase_out["applied"] = apply_phase
        phase_out["result"] = result
        phases_out.append(phase_out)
    payload = {
        "reportTitle": "GridBot Generation History Solar Report",
        "schemaVersion": "0.1.0",
        "generatedUTC": utc_now(),
        "mode": "apply" if args.apply else "audit only",
        "manifestPath": rel(manifest_path) if manifest_path.exists() else str(manifest_path),
        "phases": phases_out,
        "executiveSummary": f"GridBot solar workflow ran {len(phases_out)} phases in {'apply' if args.apply else 'audit only'} mode. Apply only affects phases with applyByDefault true.",
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = REPORT_DIR / f"GENERATION_HISTORY_SOLAR_{s}.md"
    js = JSON_DIR / f"GENERATION_HISTORY_SOLAR_{s}.json"
    latest_md = REPORT_DIR / "GENERATION_HISTORY_SOLAR_LATEST.md"
    latest_js = JSON_DIR / "GENERATION_HISTORY_SOLAR_LATEST.json"
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
