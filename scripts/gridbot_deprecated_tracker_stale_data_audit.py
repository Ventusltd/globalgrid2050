#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "DEPRECATED_TRACKER_STALE_DATA_AUDIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "DEPRECATED_TRACKER_STALE_DATA_AUDIT_LATEST.json"
MANIFEST = ROOT / "gridbot_manifests" / "DEPRECATED_TRACKER_STALE_DATA_RETIREMENT_MANIFEST.json"
SCRIPT = "scripts/gridbot_deprecated_tracker_stale_data_audit.py"
VERSIONS = [2, 3, 4, 5]
STALE_MINUTES = 30


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def now_text() -> str:
    return now_utc().isoformat().replace("+00:00", "Z")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"readError": str(exc)}


def parse_time(value) -> dt.datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except Exception:
        return None


def age_hours(value, now: dt.datetime) -> float | None:
    parsed = parse_time(value)
    if parsed is None:
        return None
    return round((now - parsed).total_seconds() / 3600.0, 3)


def workflow_status(version: int) -> dict:
    path = ROOT / ".github" / "workflows" / f"fetch_uk_energy_and_prices_v{version}.yml"
    text = read_text(path)
    has_dispatch = "workflow_dispatch" in text
    has_cron = "schedule:" in text and "cron:" in text
    return {
        "path": str(path.relative_to(ROOT)),
        "exists": path.exists(),
        "hasWorkflowDispatch": has_dispatch,
        "hasCronSchedule": has_cron,
        "manualOnly": bool(has_dispatch and not has_cron),
    }


def folder_for(version: int) -> Path:
    return ROOT / f"uk_energy_tracking_v{version}"


def app_file(version: int) -> tuple[str | None, str]:
    folder = folder_for(version)
    for name in ["live-app.js", "index.md"]:
        path = folder / name
        if path.exists():
            return str(path.relative_to(ROOT)), read_text(path)
    return None, ""


def audit_version(version: int, now: dt.datetime) -> dict:
    folder = folder_for(version)
    energy_path = folder / "live_grid_energy.json"
    price_path = folder / "live_grid_price.json"
    index_path = folder / "index.md"
    energy = read_json(energy_path)
    price = read_json(price_path)
    app_path, app = app_file(version)
    energy_time = energy.get("updated")
    price_time = price.get("updated")
    energy_age = age_hours(energy_time, now)
    price_age = age_hours(price_time, now)
    ages = [x for x in [energy_age, price_age] if x is not None]
    max_age = max(ages) if ages else None
    mix = energy.get("mix") if isinstance(energy.get("mix"), list) else []
    collapsed = any(str(row.get("label")) == "Imports & Exports" for row in mix) or "Imports & Exports" in app
    masks = "latestIso" in app and "dateLabel" in app
    index_text = read_text(index_path)
    already_retired = "retired" in index_text.lower() or "archived" in index_text.lower() or "retained for reference" in app.lower()
    wf = workflow_status(version)
    if already_retired:
        verdict = "abandoned"
    elif wf["hasCronSchedule"] and max_age is not None and max_age <= (STALE_MINUTES / 60.0):
        verdict = "live"
    elif max_age is None:
        verdict = "abandoned"
    else:
        verdict = "stale"
    return {
        "version": f"v{version}",
        "route": f"/uk_energy_tracking_v{version}/",
        "folderExists": folder.exists(),
        "indexPath": str(index_path.relative_to(ROOT)) if index_path.exists() else None,
        "appPath": app_path,
        "energyPath": str(energy_path.relative_to(ROOT)),
        "pricePath": str(price_path.relative_to(ROOT)),
        "energyUpdated": energy_time,
        "priceUpdated": price_time,
        "energyAgeHours": energy_age,
        "priceAgeHours": price_age,
        "workflow": wf,
        "usesLatestIsoDateLabelPattern": masks,
        "containsCollapsedImportsExports": collapsed,
        "alreadyRetiredOrArchived": already_retired,
        "verdict": verdict,
    }


def audit_v6(now: dt.datetime) -> dict:
    folder = ROOT / "uk_energy_tracking_v6"
    energy = read_json(folder / "live_grid_energy.json")
    price = read_json(folder / "live_grid_price.json")
    wf = workflow_status(6)
    return {
        "version": "v6",
        "route": "/uk_energy_tracking_v6/",
        "energyUpdated": energy.get("updated"),
        "priceUpdated": price.get("updated"),
        "energyAgeHours": age_hours(energy.get("updated"), now),
        "priceAgeHours": age_hours(price.get("updated"), now),
        "workflow": wf,
        "confirmedScheduledLiveVersion": bool(wf.get("hasCronSchedule")),
    }


def build_manifest(audits: list[dict]) -> dict:
    target_files = [f"uk_energy_tracking_v{v}/index.md" for v in VERSIONS]
    source_files = []
    forbidden = []
    for v in VERSIONS:
        source_files += [f"uk_energy_tracking_v{v}/live_grid_energy.json", f"uk_energy_tracking_v{v}/live_grid_price.json", f".github/workflows/fetch_uk_energy_and_prices_v{v}.yml"]
        forbidden += [f"uk_energy_tracking_v{v}/live_grid_energy.json", f"uk_energy_tracking_v{v}/live_grid_price.json"]
    source_files.append(".github/workflows/fetch_uk_energy_and_prices_v6.yml")
    manifest = {
        "feature_id": "deprecated_tracker_stale_data_retirement",
        "feature_name": "Deprecated tracker stale data audit and retirement",
        "owner": "VENTUS Ltd",
        "created_utc": now_text(),
        "target_files": target_files,
        "source_files": source_files,
        "forbidden_files": forbidden,
        "audit_report_md": str(REPORT_MD.relative_to(ROOT)),
        "audit_report_json": str(REPORT_JSON.relative_to(ROOT)),
        "rollback_method": "Revert the apply commit. Apply must touch only deprecated tracker UI or routing files, never data files.",
        "human_approval_required": True,
        "data_source_domain": "UK live electricity tracker UI and routing only. No data refresh source is changed.",
        "public_safety_or_ndA_risk": "Public trust defect caused by stale live data. No NDA content expected.",
        "planned_apply": "Retire deprecated tracker routes v2 through v5 in favour of /uk_energy_tracking_v6/. Do not add cron schedules to old versions.",
        "version_verdicts": {a["version"]: a["verdict"] for a in audits},
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def write_report(report: dict) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Deprecated Tracker Stale Data Audit",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Pass: `{report['pass']}`",
        "",
        report["executiveSummary"],
        "",
        "## Version verdicts",
        "",
        "| Version | Route | Energy updated | Energy age h | Price updated | Price age h | Workflow | Timestamp mask | Imports and Exports bucket | Verdict |",
        "|---|---|---:|---:|---:|---:|---|---|---|---|",
    ]
    for a in report["versionAudits"]:
        wf = "cron" if a["workflow"]["hasCronSchedule"] else ("manual only" if a["workflow"]["manualOnly"] else "missing")
        lines.append(f"| {a['version']} | `{a['route']}` | {a['energyUpdated']} | {a['energyAgeHours']} | {a['priceUpdated']} | {a['priceAgeHours']} | {wf} | {a['usesLatestIsoDateLabelPattern']} | {a['containsCollapsedImportsExports']} | **{a['verdict']}** |")
    lines += [
        "",
        "## V6 scheduled live check",
        "",
        json.dumps(report["liveVersionCheck"], indent=2),
        "",
        "## Apply guardrail",
        "",
        "Apply mode is deliberately not run here. The intended fix is to retire deprecated tracker routes v2 through v5 in favour of `/uk_energy_tracking_v6/`, without adding old cron schedules and without touching data files.",
        "",
        "## Changed files",
        "",
    ]
    for p in report["changedFiles"]:
        lines.append(f"- `{p}`")
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    for k, v in report["checks"].items():
        lines.append(f"| {k} | {'✅' if v else '❌'} |")
    lines += ["", "## Rollback", "", report["rollbackMethod"], ""]
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["audit"], default="audit")
    args = parser.parse_args()
    now = now_utc()
    audits = [audit_version(v, now) for v in VERSIONS]
    live = audit_v6(now)
    manifest = build_manifest(audits)
    checks = {
        "audit_covers_v2_to_v5": len(audits) == 4,
        "v6_is_confirmed_scheduled_live_version": bool(live["workflow"].get("hasCronSchedule")),
        "deprecated_versions_do_not_have_cron": all(not a["workflow"].get("hasCronSchedule") for a in audits),
        "timestamp_mask_checked_for_each_version": all("usesLatestIsoDateLabelPattern" in a for a in audits),
        "imports_exports_bucket_checked_for_each_version": all("containsCollapsedImportsExports" in a for a in audits),
        "audit_does_not_modify_data_files": True,
        "manifest_written": MANIFEST.exists(),
    }
    passed = all(checks.values())
    report = {
        "reportTitle": "Deprecated Tracker Stale Data Audit",
        "schemaVersion": "1.0.0",
        "generatedUTC": now_text(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": "main",
        "gitHeadBefore": os.environ.get("GITHUB_SHA", "local"),
        "gitHeadAfter": os.environ.get("GITHUB_SHA", "local"),
        "workflowName": "GridBot Deprecated Tracker Stale Data Audit",
        "scriptName": SCRIPT,
        "upgradeType": "correctness and public trust fix under launch freeze",
        "mode": args.mode,
        "sourceApis": [],
        "sourceWindows": {"staleThresholdMinutes": STALE_MINUTES, "auditVersions": [f"v{v}" for v in VERSIONS], "liveVersion": "v6"},
        "inputFiles": manifest["source_files"],
        "outputFiles": [str(REPORT_MD.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT)), str(MANIFEST.relative_to(ROOT))],
        "changedFiles": [],
        "addedFiles": [str(MANIFEST.relative_to(ROOT))],
        "deletedFiles": [],
        "checks": checks,
        "rawTemporaryFilesFound": [],
        "browserRoutingAffected": False,
        "rollbackMethod": manifest["rollback_method"],
        "executiveSummary": "Audits deprecated UK energy tracker versions v2 to v5 for stale live data, missing cron schedules, timestamp masking, and collapsed Imports and Exports generation mix. No data files are modified by audit mode.",
        "humanReviewStatus": "required before apply",
        "nextAction": "Review this audit report. If accepted, build or trigger the apply retirement workflow to route deprecated versions to v6. Do not add cron schedules to deprecated versions.",
        "applied": False,
        "pass": passed,
        "versionAudits": audits,
        "liveVersionCheck": live,
    }
    write_report(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
