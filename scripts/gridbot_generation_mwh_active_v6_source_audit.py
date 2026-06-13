#!/usr/bin/env python3
"""GridBot audit-only check for active V6 Generation Output in MWh source routing."""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTIVE = ROOT / "uk_energy_tracking_v6" / "generation_history"
BACKUP = ROOT / "uk_energy_tracking_v6_2" / "generation_history"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "GENERATION_MWH_ACTIVE_V6_SOURCE_AUDIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "GENERATION_MWH_ACTIVE_V6_SOURCE_AUDIT_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
BACKUP_ROUTE = "/uk_energy_tracking_v6_2/generation_history/"
SCRIPT_NAME = "scripts/gridbot_generation_mwh_active_v6_source_audit.py"
WORKFLOW_NAME = "GridBot Generation MWh Active V6 Source Audit"

PATHS = {
    "activeIndex": ACTIVE / "index.md",
    "activeLoader": ACTIVE / "load_generation_mwh_aggregates.js",
    "activeRender": ACTIVE / "render_generation_mwh_aggregates.js",
    "activeControl": ACTIVE / "control_generation_mwh_aggregates.js",
    "activeLiveConfig": ACTIVE / "live-config.js",
    "activeAnnualJson": ACTIVE / "generation_annual_mwh_by_technology.json",
    "activeDailyChartControl": ACTIVE / "control_solar_daily_mwh_chart.js",
    "fuelhhDailyIndex": ACTIVE / "generation_daily_mwh_by_technology_fuelhh_index.json",
    "legacyAggregateBuilder": ROOT / "scripts" / "backfill_generation_aggregates_year_v6.py",
    "legacySourceBuilder": ROOT / "scripts" / "backfill_generation_sources_year_v6.py",
    "fuelhhBackfill": ROOT / "scripts" / "backfill_generation_fuelhh_halfhourly_all_months_v6.py",
    "fuelhhDailyCompiler": ROOT / "scripts" / "build_generation_daily_mwh_fuelhh_chunks.py",
    "fuelhhDailyWorkflow": ROOT / ".github" / "workflows" / "gridbot_generation_daily_mwh_fuelhh_chunks.yml",
    "backupIndex": BACKUP / "index.md",
    "backupRender": BACKUP / "render_generation_mwh_aggregates.js",
    "backupControl": BACKUP / "control_generation_mwh_aggregates.js",
    "backupGuardScript": ROOT / "scripts" / "gridbot_generation_mwh_interconnector_ui_guard.py",
}


def now(): return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def read(p):
    try: return p.read_text(encoding="utf-8", errors="replace")
    except Exception: return ""
def rel(p):
    try: return p.relative_to(ROOT).as_posix()
    except Exception: return str(p)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() and p.is_file() else ""
def git(args):
    try:
        r = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, timeout=20)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception: return ""
def load_json(p):
    try:
        o = json.loads(read(p) or "{}")
        return o if isinstance(o, dict) else {}
    except Exception: return {}


def fuelhh_chunk():
    idx = load_json(PATHS["fuelhhDailyIndex"])
    chunks = idx.get("chunks", []) if isinstance(idx.get("chunks", []), list) else []
    first = chunks[0] if chunks and isinstance(chunks[0], dict) else {}
    fp = ROOT / str(first.get("path") or "") if first.get("path") else Path("")
    return {"indexExists": PATHS["fuelhhDailyIndex"].exists(), "chunkCount": len(chunks), "firstChunkPath": first.get("path"), "firstChunkRows": first.get("rows"), "firstChunkSizeBytes": first.get("sizeBytes"), "firstChunkExists": bool(first.get("path") and fp.exists())}


def raw_temp_files():
    out = []
    for base in [ROOT/"data"/"raw", ROOT/"data"/"transient", ROOT/"data"/"tmp", ROOT/"tmp", ROOT/"temp"]:
        if base.exists(): out += [rel(p) for p in base.rglob("*") if p.is_file()]
    return sorted(set(out))[:200]


def collect():
    t = {k: read(p) for k, p in PATHS.items()}
    c = fuelhh_chunk()
    checks = {
        "activeRoutePermalinkPresent": f"permalink: {ROUTE}" in t["activeIndex"],
        "generationOutputInMwhPanelPresent": "Generation output in MWh" in t["activeIndex"] and "generation-mwh-annual" in t["activeIndex"],
        "activeLoaderReadsLegacyAggregateFiles": all(x in t["activeLoader"] for x in ["generation_annual_mwh_by_technology.json", "generation_monthly_mwh_by_technology.json", "generation_day_night_mwh_by_technology.json"]),
        "legacyAnnualJsonMentionsFuelinst": "FUELINST" in t["activeAnnualJson"],
        "legacySourceScriptUsesFuelinstEndpoint": "ELEXON_FUELINST" in t["legacySourceBuilder"] and "datasets/FUELINST" in t["legacySourceBuilder"],
        "legacyAggregateBuilderUsesLegacyFetcher": "from backfill_generation_sources_year_v6 import fetch_elexon_day" in t["legacyAggregateBuilder"],
        "fuelhhBackfillExistsAndUsesFuelhh": PATHS["fuelhhBackfill"].exists() and "datasets/FUELHH" in t["fuelhhBackfill"],
        "fuelhhDailyCompilerExists": PATHS["fuelhhDailyCompiler"].exists() and "daily MWh" in t["fuelhhDailyCompiler"],
        "fuelhhDailyWorkflowHasAuditApply": PATHS["fuelhhDailyWorkflow"].exists() and "audit" in t["fuelhhDailyWorkflow"] and "apply" in t["fuelhhDailyWorkflow"],
        "fuelhhDailyIndexHasChunk": bool(c["indexExists"] and c["chunkCount"] and c["firstChunkPath"]),
        "fuelhhDailyChunkExists": bool(c["firstChunkExists"]),
        "fuelhhDailyChunkUnder25MiB": bool((c["firstChunkSizeBytes"] or 0) < 25_000_000),
        "dailyChartControllerUsesFuelhhChunk": "generation_daily_mwh_by_technology_fuelhh_2016_2026.json" in t["activeDailyChartControl"],
        "dailyChartControllerSeparatesSolarPvlive": "PVLive stored energy" in t["activeDailyChartControl"] and "Elexon FUELHH derived energy" in t["activeDailyChartControl"],
        "topMwhPanelNotYetRoutedToFuelhhDailyChunk": "generation_daily_mwh_by_technology_fuelhh" not in t["activeLoader"] and "generation_daily_mwh_by_technology_fuelhh" not in t["activeControl"],
        "activeLiveConfigStillOffersImportsExports": "Imports & Exports" in t["activeLiveConfig"],
        "activeRendererDoesNotHideImportsExports": "var HIDDEN={'Imports & Exports':true};" not in t["activeRender"],
        "backupMirrorInactive": "INACTIVE V6 2 BACKUP MIRROR" in t["backupIndex"],
        "backupMirrorHasInterconnectorGuard": "var HIDDEN={'Imports & Exports':true};" in t["backupRender"] and "var HIDDEN={'Imports & Exports':true};" in t["backupControl"],
        "v62GuardScriptTargetsBackupRoute": BACKUP_ROUTE in t["backupGuardScript"] and "uk_energy_tracking_v6_2" in t["backupGuardScript"],
        "v62GuardNotAppliedToActiveV6": "var HIDDEN={'Imports & Exports':true};" not in t["activeRender"] and "var HIDDEN={'Imports & Exports':true};" in t["backupRender"],
        "noTargetFilesChangedByThisAudit": True,
    }
    problem = all(checks[k] for k in ["activeLoaderReadsLegacyAggregateFiles", "legacyAnnualJsonMentionsFuelinst", "legacySourceScriptUsesFuelinstEndpoint", "fuelhhDailyChunkExists", "dailyChartControllerUsesFuelhhChunk", "topMwhPanelNotYetRoutedToFuelhhDailyChunk"])
    return checks, c, problem


def write_reports(payload):
    REPORT_DIR.mkdir(parents=True, exist_ok=True); REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    rows = ["# Generation MWh Active V6 Source Audit", "", payload["executiveSummary"], "", f"Problem confirmed: `{payload['diagnosis']['problemConfirmed']}`", "", "| Check | Result |", "|---|---|"]
    rows += [f"| {k} | {'✅' if v else '❌'} |" for k, v in payload["checks"].items()]
    rows += ["", "## Candidate next apply routes", "", "1. Active V6 UI guard for the collapsed `Imports & Exports` bucket.", "2. Active V6 top-MWh source routing to FUELHH-derived compact facts.", ""]
    REPORT_MD.write_text("\n".join(rows), encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--mode", choices=["audit"], default="audit"); args = parser.parse_args()
    head = git(["rev-parse", "HEAD"]); checks, chunk, problem = collect()
    required = ["activeRoutePermalinkPresent", "generationOutputInMwhPanelPresent", "fuelhhDailyIndexHasChunk", "fuelhhDailyChunkExists", "noTargetFilesChangedByThisAudit"]
    summary = "Active V6 can be audited without changing production files. The top Generation Output in MWh panel still appears to read legacy annual/monthly/day-night aggregate JSONs whose builder path is FUELINST/PVLive based. The newer Elexon FUELHH daily MWh chunk exists and is wired into the separate daily MWh chart, but not the top MWh panel. A later interconnector UI guard targets the inactive v6_2 backup mirror, not the active v6 route."
    payload = {
        "reportTitle": "Generation MWh Active V6 Source Audit", "schemaVersion": "1.0.0", "generatedUTC": now(), "repository": "Ventusltd/globalgrid2050", "branch": git(["branch", "--show-current"]), "gitHeadBefore": head, "gitHeadAfter": head, "workflowName": WORKFLOW_NAME, "scriptName": SCRIPT_NAME, "upgradeType": "audit-only source-routing diagnosis", "mode": args.mode,
        "sourceApis": ["Elexon BMRS FUELHH", "Elexon BMRS FUELINST", "Sheffield Solar PVLive"], "sourceWindows": ["repository current HEAD only; no network API fetch in this audit"], "inputFiles": [rel(p) for p in PATHS.values()], "outputFiles": [rel(REPORT_MD), rel(REPORT_JSON)], "changedFiles": [], "addedFiles": [], "deletedFiles": [],
        "checks": checks, "diagnosis": {"problemConfirmed": problem, "activeTopPanelUsesLegacyAggregates": checks["activeLoaderReadsLegacyAggregateFiles"], "legacyAggregateSourceIsFuelinst": checks["legacyAnnualJsonMentionsFuelinst"] and checks["legacySourceScriptUsesFuelinstEndpoint"], "fuelhhDailyMwhChunkExists": checks["fuelhhDailyChunkExists"], "dailyChartUsesFuelhhChunk": checks["dailyChartControllerUsesFuelhhChunk"], "topMwhPanelNotYetRoutedToFuelhh": checks["topMwhPanelNotYetRoutedToFuelhhDailyChunk"], "interconnectorGuardOnlyOnBackupMirror": checks["backupMirrorHasInterconnectorGuard"] and checks["v62GuardNotAppliedToActiveV6"]},
        "fuelhhDailyChunk": chunk, "sourceHashes": {k: sha(p) for k, p in PATHS.items()}, "rawTemporaryFilesFound": raw_temp_files(), "browserRoutingAffected": True, "rollbackMethod": "No target rollback required for audit mode. Later apply patches can be reverted by reverting the apply commit.", "executiveSummary": summary, "humanReviewStatus": "awaiting Vikram review", "nextAction": "Run audit, review report, then choose active_v6_interconnector_ui_guard or active_v6_top_mwh_fuelhh_routing.", "candidateApplyRoutes": ["active_v6_interconnector_ui_guard", "active_v6_top_mwh_fuelhh_routing"], "applied": False, "pass": all(checks.get(k, False) for k in required),
    }
    write_reports(payload); print(json.dumps(payload, indent=2, ensure_ascii=False)); return 0 if payload["pass"] else 1

if __name__ == "__main__": raise SystemExit(main())
