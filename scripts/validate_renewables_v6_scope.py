#!/usr/bin/env python3
"""End-to-end V6 release gate, including immutable V1–V5 regression controls."""
from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "uk_renewables_pipeline"
DIST = ROOT / "dist"
REPORT = DIST / "renewables_v6_integrity.json"

FILES = {
    "v1": PIPE / "dashboard.html",
    "v2": PIPE / "dashboard_v2_2026-08-22.html",
    "v3": PIPE / "dashboard_v3_live_2026-08-22.html",
    "v4": PIPE / "dashboard_v4_live.html",
    "v5": PIPE / "dashboard_v5_live.html",
    "v6": PIPE / "dashboard_v6_live.html",
}
BASELINE_BLOBS = {
    "v1": "e2d99e37d6388d3f498a79696773238ad689574b",
    "v2": "cb953a67332d3d29355945fb58a513e30c681013",
    "v3": "911921e7aa254f0bfdecc122d975cc0e3af130c7",
    "v4": "f356b37b1c6202150f3a5bb404a57ee329212f70",
    "v5": "ac33daf67dba8951527b06761ab587003a19f60e",
}

EXPECTED_ROWS = 14657
EXPECTED_SOLAR = 3445
EXPECTED_BESS = 269
EXPECTED_PROJECTS = EXPECTED_SOLAR + EXPECTED_BESS
EXPECTED_CSV_SHA = "84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035"
EXPECTED_XLSX_SHA = "624a0a9712c58a7a93716e51f2bf054eec8b1af7170f6f9516cc10cd248e2657"
MIN_CONFIDENCE = 68
PRIORITY_SOURCES = {
    "DESNZ / GOV.UK",
    "Planning Inspectorate",
    "BBC",
    "Solar Power Portal",
    "Energy-Storage.News",
    "PV Magazine",
}
FOREIGN_PHRASES = {
    "new jersey", "california", "texas", "australia", "new south wales", "queensland",
    "canada", "alberta", "ontario canada", "germany", "italy", "spain", "india", "china",
    "south africa", "new zealand", "republic of ireland", "irish republic", "united states",
    "u s roundup", "new york", "arizona", "nevada", "florida", "ohio", "virginia",
    "massachusetts", "pennsylvania", "colorado",
}
KNOWN_BAD = {
    "forest healthcare", "evolution mining", "new jersey board of public utilities",
}


def clean(value):
    return str(value or "").strip()


def norm(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(value).lower())).strip()


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except Exception:
        return None


def git_blob_sha(path):
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def json_sha(value):
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def main():
    errors, checks = [], []

    def check(condition, gate, detail=""):
        passed = bool(condition)
        checks.append({"gate": gate, "pass": passed, "detail": detail})
        if not passed:
            errors.append(f"{gate}: {detail}" if detail else gate)

    def load(path):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"cannot load {path.relative_to(ROOT)}: {exc}")
            return {}

    # Immutable lineage and semantic frontend structure.
    texts = {}
    for version, path in FILES.items():
        check(path.exists(), f"{version} exists", str(path.relative_to(ROOT)))
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        texts[version] = text
        check("</html>" in text.lower(), f"{version} closes HTML")
        if version in BASELINE_BLOBS:
            actual = git_blob_sha(path)
            check(actual == BASELINE_BLOBS[version], f"{version} immutable blob", actual)

    v6 = texts.get("v6", "")
    required_frontend = {
        "same-origin project snapshot": "../dist/major_projects_v6.json",
        "same-origin news snapshot": "../dist/major_project_news_v6.json",
        "Chart.js": "cdn.jsdelivr.net/npm/chart.js",
        "newspaper": "ENERGY DAILY",
        "news filters": 'data-mode="FINANCE"',
        "news search": 'id="newsSearch"',
        "three gauges": 'id="g3"',
        "asset filters": 'id="tech"',
        "status filter": 'id="state"',
        "geography filter": 'id="county"',
        "asset search": 'id="assetSearch"',
        "project table": 'id="tbody"',
        "CSV export": 'id="export"',
        "mobile CSV export": 'id="exportMobile"',
        "GlobalGrid project ID": "GLOBALGRID PROJECT ID",
        "GlobalGrid development ID": "GLOBALGRID DEVELOPMENT ID",
        "REPD Ref": "REPD REF",
        "REPD record update": "REPD UPDATED",
        "official status": "REPD STATUS",
        "separate news signal": "NEWS SIGNAL",
        "official missing date": "not supplied by REPD",
        "mobile layout": "@media(max-width:768px)",
        "official portal": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
    }
    for label, token in required_frontend.items():
        check(token in v6, f"V6 frontend: {label}", token)
    for version_path in (
        "dashboard.html", "dashboard_v2_2026-08-22.html", "dashboard_v3_live_2026-08-22.html",
        "dashboard_v4_live.html", "dashboard_v5_live.html",
    ):
        check(version_path in v6, "V6 version lineage", version_path)
    lower_v6 = v6.lower()
    check("<iframe" not in lower_v6, "V6 is standalone")
    check("papaparse" not in lower_v6 and "papa.parse" not in lower_v6, "no browser CSV parser")
    check("assets.publishing.service.gov.uk" not in lower_v6, "no government asset runtime dependency")
    check("../dist/repd_master.json" not in v6, "no shared V1–V5 master loader")
    check("../dist/major_project_news_v5.json" not in v6, "no V5 news fallback")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    check(
        "LIVE · DESNZ Q2 2026 validated snapshot · solar >1MW · BESS >100MW · canonical GlobalGrid/REPD IDs" in homepage,
        "homepage V6 snapshot wording",
    )

    manifest = load(DIST / "manifest_v6.json")
    source = load(DIST / "repd_source_reconciliation_v6.json")
    identity_integrity = load(DIST / "project_identity_v6_integrity.json")
    source_metrics = source.get("metrics") or {}
    source_hashes = source.get("source_hashes") or {}
    check(manifest.get("schema") == "globalgrid2050.repd-manifest.v6" and manifest.get("status") == "VALIDATED", "validated V6 manifest")
    check(source.get("pass") is True and source_metrics.get("material_mismatches") == 0, "CSV/XLSX reconciliation passed")
    check(source_metrics.get("csv_rows") == EXPECTED_ROWS == source_metrics.get("xlsx_rows"), "official source row counts exact")
    check(source_metrics.get("csv_unique_refs") == EXPECTED_ROWS == source_metrics.get("xlsx_unique_refs"), "official unique Ref counts exact")
    check(source_metrics.get("canonical_solar_gt1") == EXPECTED_SOLAR, "canonical solar count exact")
    check(source_metrics.get("canonical_bess_gt100") == EXPECTED_BESS, "canonical BESS count exact")
    check(source_hashes.get("csv_sha256") == EXPECTED_CSV_SHA, "official Q2 CSV hash exact")
    check(source_hashes.get("xlsx_sha256") == EXPECTED_XLSX_SHA, "official Q2 XLSX hash exact")
    check(manifest.get("source_hashes") == source_hashes, "manifest/source hashes agree")
    check(identity_integrity.get("pass") is True, "identity integrity report passed", str(identity_integrity.get("errors") or []))

    projects = load(DIST / "major_projects_v6.json")
    rows = projects.get("projects") or []
    check(projects.get("schema") == "globalgrid2050.major-projects.v6", "V6 public project schema")
    check(projects.get("repd_bound") is True and projects.get("globalgrid_id_required") is True, "V6 canonical identity policy")
    check(projects.get("csv_xlsx_reconciled") is True, "V6 snapshot declares source reconciliation")
    check(projects.get("source_record_count") == EXPECTED_ROWS == projects.get("source_unique_ref_count"), "V6 source metadata exact")
    check(projects.get("project_count") == EXPECTED_PROJECTS == projects.get("count") == len(rows), "V6 project quantity exact", f"metadata={projects.get('project_count')} rows={len(rows)}")
    check(projects.get("solar_count") == EXPECTED_SOLAR, "V6 solar metadata exact")
    check(projects.get("bess_count") == EXPECTED_BESS, "V6 BESS metadata exact")
    check((projects.get("thresholds") or {}).get("solar_mw_exclusive") == 1.0, "V6 solar threshold exclusive")
    check((projects.get("thresholds") or {}).get("bess_mw_exclusive") == 100.0, "V6 BESS threshold exclusive")
    check(projects.get("source_hashes") == source_hashes, "V6 snapshot/source hashes agree")
    check(projects.get("projects_sha256") == json_sha(rows), "V6 project array SHA-256 exact")
    snapshot_meta = manifest.get("public_snapshot") or {}
    check(snapshot_meta.get("project_count") == EXPECTED_PROJECTS, "manifest public project count exact")
    check(snapshot_meta.get("projects_sha256") == projects.get("projects_sha256"), "manifest/public project hash exact")

    by_ref, gg_ids = {}, set()
    project_errors = []
    solar = bess = updates = 0
    for index, row in enumerate(rows):
        ref, gg, development = clean(row.get("repd_ref")), clean(row.get("gg_project_id")), clean(row.get("gg_development_id"))
        capacity, technology = number(row.get("capacity_mw")), clean(row.get("technology"))
        if not ref or ref in by_ref:
            project_errors.append(f"row {index} missing/duplicate REPD Ref {ref!r}")
        if gg != f"GG2050-REPD-{ref}" or gg in gg_ids:
            project_errors.append(f"row {index} invalid/duplicate GlobalGrid ID {gg!r}")
        if not development.startswith("GG2050-DEV-"):
            project_errors.append(f"row {index} missing development ID")
        if row.get("identity_status") != "REPD_BOUND":
            project_errors.append(f"row {index} is not REPD_BOUND")
        if row.get("capacity_known") is not True or capacity is None:
            project_errors.append(f"row {index} has unknown capacity in threshold universe")
        elif technology == "solar" and capacity > 1.0:
            solar += 1
        elif technology == "bess" and capacity > 100.0:
            bess += 1
        else:
            project_errors.append(f"row {index} fails its exclusive technology threshold")
        if not clean(row.get("name")) or not clean(row.get("status")):
            project_errors.append(f"row {index} lacks required official name/status")
        updated = row.get("repd_record_updated")
        if updated:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean(updated)):
                project_errors.append(f"row {index} invalid REPD update date")
            else:
                updates += 1
        for date_field in (
            "planning_application_submitted", "planning_application_withdrawn", "planning_permission_refused",
            "planning_permission_granted", "planning_permission_expired", "under_construction", "operational",
        ):
            value = row.get(date_field)
            if value and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean(value)):
                project_errors.append(f"row {index} invalid official date {date_field}")
        by_ref[ref], _ = row, gg_ids.add(gg)
    check(not project_errors, "every V6 project is canonical and threshold-qualified", "; ".join(project_errors[:10]))
    check(solar == EXPECTED_SOLAR and bess == EXPECTED_BESS, "V6 derived threshold counts", f"solar={solar} bess={bess}")
    check(projects.get("record_update_supplied_count") == updates, "REPD supplied-update metadata exact")
    check(projects.get("record_update_missing_count") == len(rows) - updates, "REPD missing-update metadata exact")

    news = load(DIST / "major_project_news_v6.json")
    items = news.get("items") or []
    telemetry = news.get("telemetry") or {}
    check(news.get("schema") == "globalgrid2050.major-project-news.v6", "V6 news schema")
    check(news.get("repd_bound") is True and news.get("globalgrid_id_required") is True, "V6 news canonical identity policy")
    check(news.get("eligible_projects") == EXPECTED_PROJECTS, "news eligible project count exact")
    check(news.get("eligible_solar") == EXPECTED_SOLAR and news.get("eligible_bess") == EXPECTED_BESS, "news eligible technology counts exact")
    check(news.get("headline_count") == len(items), "news headline count permits a valid zero", f"metadata={news.get('headline_count')} items={len(items)}")
    check(news.get("news_horizon_days") == 183 and news.get("lookback_days") == 183, "news horizon exact")
    check(PRIORITY_SOURCES.issubset(set(news.get("priority_sources") or [])), "priority public sources configured")
    check(telemetry.get("source_first") is True, "source-first crawl executed")
    configured = telemetry.get("queries_configured")
    check(isinstance(configured, int) and configured > 0, "news queries configured/executed", str(configured))
    for metric in (
        "queries_completed", "queries_failed_or_cancelled", "rss_candidates_returned",
        "deduplicated_article_candidates", "articles_accepted_before_limit", "articles_published",
        "articles_rejected", "articles_ambiguous", "articles_dropped_by_headline_limit",
    ):
        value = telemetry.get(metric)
        check(isinstance(value, int) and value >= 0, f"news telemetry {metric} recorded", str(value))
    check(telemetry.get("articles_published") == len(items), "telemetry accepted count exact")
    check(news.get("raw_story_count") == telemetry.get("deduplicated_article_candidates"), "candidate count exposed")
    check(news.get("rejected_candidates") == telemetry.get("articles_rejected"), "rejected count exposed")
    check(news.get("ambiguous_candidates") == telemetry.get("articles_ambiguous"), "ambiguous count exposed")
    check(telemetry.get("zero_accepted_is_valid") is True, "quiet-period policy explicit")

    # Discovery coverage must advance from persisted state, not wall-clock
    # timing.  The explicit indexes make every rotation independently auditable.
    query_plan = telemetry.get("query_plan") or {}
    selected = query_plan.get("solar_targeted_batches_selected")
    total_batches = query_plan.get("solar_targeted_batches_total")
    cursor_start = query_plan.get("solar_rotation_cursor_start")
    cursor_next = query_plan.get("solar_rotation_cursor_next")
    cursor_source = query_plan.get("solar_rotation_cursor_source")
    full_sweep_runs = query_plan.get("solar_rotation_full_sweep_runs")
    batch_indexes = query_plan.get("solar_targeted_batch_indexes")
    cursor_planned_next = query_plan.get("solar_rotation_cursor_planned_next")
    cursor_advanced = query_plan.get("solar_rotation_advance_applied")
    cursor_advance_reason = query_plan.get("solar_rotation_advance_reason")
    cursor_values_valid = all(
        isinstance(value, int) and not isinstance(value, bool)
        for value in (selected, total_batches, cursor_start, cursor_next, full_sweep_runs)
    )
    check(cursor_values_valid, "persisted solar rotation metadata typed")
    if cursor_values_valid and total_batches > 0 and selected > 0:
        expected_indexes = [(cursor_start + offset) % total_batches for offset in range(selected)]
        check(0 < selected <= total_batches, "solar rotation selects a bounded non-empty window")
        check(batch_indexes == expected_indexes, "solar rotation indexes are consecutive and auditable")
        expected_next = (cursor_start + selected) % total_batches
        check(cursor_planned_next == expected_next, "solar rotation planned cursor is deterministic")
        solar_execution = (telemetry.get("query_execution") or {}).get("solar_targeted_backstop") or {}
        all_queries_completed = (
            solar_execution.get("configured") == selected
            and solar_execution.get("completed") == selected
            and solar_execution.get("failed") == 0
        )
        check(cursor_advanced is all_queries_completed, "solar rotation advances only after a complete crawl")
        check(
            cursor_next == (expected_next if all_queries_completed else cursor_start),
            "solar rotation persists the next complete or retry window",
        )
        check(
            cursor_advance_reason
            == (
                "all_selected_solar_queries_completed"
                if all_queries_completed
                else "incomplete_solar_query_execution_retry_window"
            ),
            "solar rotation advance reason explicit",
        )
        check(full_sweep_runs == math.ceil(total_batches / selected), "solar rotation full-sweep bound exact")
    else:
        check(False, "solar rotation has a non-empty Q2 solar universe")
    check(cursor_source in {"initial_zero", "previous_v6_news_telemetry"}, "solar rotation cursor source explicit", clean(cursor_source))

    # Fresh-crawl decisions and retained-story decisions are separate.  These
    # equations prevent a rotating batch from silently replacing the newspaper.
    fresh_candidates = telemetry.get("deduplicated_article_candidates")
    fresh_accepted = telemetry.get("articles_accepted_before_limit")
    fresh_rejected = telemetry.get("articles_rejected")
    if all(isinstance(value, int) and value >= 0 for value in (fresh_candidates, fresh_accepted, fresh_rejected)):
        check(fresh_candidates == fresh_accepted + fresh_rejected, "fresh candidate accounting exact")
    previous_considered = telemetry.get("previous_articles_considered")
    previous_revalidated = telemetry.get("previous_articles_revalidated")
    previous_carried = telemetry.get("previous_articles_carried_forward")
    previous_dropped = telemetry.get("previous_articles_dropped")
    fresh_published = telemetry.get("fresh_articles_published")
    retention_counts = (previous_considered, previous_revalidated, previous_carried, previous_dropped, fresh_published)
    check(all(isinstance(value, int) and value >= 0 for value in retention_counts), "retained-story telemetry typed")
    if all(isinstance(value, int) and value >= 0 for value in retention_counts):
        check(previous_considered == previous_revalidated + previous_dropped, "previous-story revalidation accounting exact")
        check(previous_carried <= previous_revalidated, "only revalidated stories are carried forward")
        check(telemetry.get("articles_published") == fresh_published + previous_carried, "final newspaper union accounting exact")
    drop_reasons = telemetry.get("previous_article_drop_reasons")
    check(isinstance(drop_reasons, dict), "previous-story drop reasons recorded")
    if isinstance(drop_reasons, dict) and isinstance(previous_dropped, int):
        check(
            all(isinstance(value, int) and value >= 0 for value in drop_reasons.values())
            and sum(drop_reasons.values()) == previous_dropped,
            "previous-story drop reason totals exact",
        )
    retention_detail = telemetry.get("story_retention") or {}
    check(
        retention_detail.get("previous_artifact_status")
        in {"accepted_same_project_snapshot", "not_available_or_invalid", "project_snapshot_mismatch"},
        "previous news artifact is project-snapshot bound",
    )

    # Rejections remain inspectable without retaining article bodies or URLs.
    rejection_reasons = telemetry.get("rejection_reasons")
    pair_reasons = telemetry.get("pair_rejection_reasons")
    rejected_samples = telemetry.get("rejected_article_samples")
    sample_limit = telemetry.get("rejected_article_sample_limit")
    check(isinstance(rejection_reasons, dict), "article rejection reasons recorded")
    if isinstance(rejection_reasons, dict) and isinstance(fresh_rejected, int):
        check(
            all(isinstance(value, int) and value >= 0 for value in rejection_reasons.values())
            and sum(rejection_reasons.values()) == fresh_rejected,
            "article rejection reason totals exact",
        )
    check(isinstance(pair_reasons, dict), "project-pair rejection reasons recorded")
    if isinstance(pair_reasons, dict) and isinstance(fresh_candidates, int):
        identity_pairs = telemetry.get("identity_candidate_pairs")
        check(
            isinstance(identity_pairs, int)
            and all(isinstance(value, int) and value >= 0 for value in pair_reasons.values())
            and sum(pair_reasons.values()) + identity_pairs == fresh_candidates * EXPECTED_PROJECTS,
            "all fresh project/article pair outcomes accounted",
        )
    check(sample_limit == 50 and isinstance(rejected_samples, list), "bounded rejected-article audit samples configured")
    sample_errors = []
    allowed_sample_keys = {
        "title", "source", "published", "resolution", "identity_candidates",
        "qualified_candidates", "top_score", "pair_reasons",
    }
    if isinstance(rejected_samples, list):
        expected_sample_count = (
            min(sample_limit, fresh_rejected)
            if isinstance(sample_limit, int) and isinstance(fresh_rejected, int) and fresh_rejected >= 0
            else -1
        )
        if len(rejected_samples) != expected_sample_count:
            sample_errors.append("sample count does not equal bounded rejected count")
        for sample_index, sample in enumerate(rejected_samples):
            if not isinstance(sample, dict) or set(sample) != allowed_sample_keys:
                sample_errors.append(f"sample {sample_index} has unsafe/unexpected keys")
                continue
            if sample.get("resolution") not in (rejection_reasons or {}):
                sample_errors.append(f"sample {sample_index} resolution is not aggregated")
            sample_pair_reasons = sample.get("pair_reasons")
            valid_pair_counts = isinstance(sample_pair_reasons, dict) and all(
                isinstance(value, int) and value >= 0 for value in sample_pair_reasons.values()
            )
            if not valid_pair_counts or sum(sample_pair_reasons.values()) != EXPECTED_PROJECTS:
                sample_errors.append(f"sample {sample_index} pair outcomes are incomplete")
    check(not sample_errors, "rejected-article samples are bounded, public and complete", "; ".join(sample_errors[:10]))
    source_telemetry = {clean(row.get("name")): row for row in telemetry.get("queried_sources") or []}
    for source_name in PRIORITY_SOURCES:
        row = source_telemetry.get(source_name) or {}
        check(int(row.get("configured", 0)) > 0, f"priority source queried: {source_name}")
        check(int(row.get("completed", 0)) + int(row.get("failed", 0)) > 0, f"priority source attempt recorded: {source_name}")

    try:
        edition_time = datetime.fromisoformat(clean(news.get("updated")).replace("Z", "+00:00"))
        edition_time = edition_time if edition_time.tzinfo else edition_time.replace(tzinfo=timezone.utc)
    except Exception:
        edition_time = datetime.now(timezone.utc)
        errors.append(f"news updated timestamp invalid: {news.get('updated')!r}")
    cutoff, latest = edition_time.date() - timedelta(days=183), edition_time.date() + timedelta(days=1)
    article_ids, article_errors = set(), []
    for index, item in enumerate(items):
        ref, article_id = clean(item.get("repd_ref")), clean(item.get("gg_article_id"))
        project = by_ref.get(ref)
        if not project:
            article_errors.append(f"article {index} references ineligible REPD {ref}")
            continue
        if not article_id.startswith("GG2050-NEWS-") or article_id in article_ids:
            article_errors.append(f"article {index} invalid/duplicate article ID")
        article_ids.add(article_id)
        if item.get("role") != "PRIMARY_MATCH" or item.get("eligible_for_news_signal") is not True:
            article_errors.append(f"article {index} is not its one eligible PRIMARY_MATCH")
        if item.get("gg_project_id") != project.get("gg_project_id") or item.get("gg_development_id") != project.get("gg_development_id"):
            article_errors.append(f"article {index} canonical identity mismatch")
        if item.get("status") != project.get("status"):
            article_errors.append(f"article {index} overwrites official REPD status")
        if number(item.get("capacity_mw")) != number(project.get("capacity_mw")):
            article_errors.append(f"article {index} overwrites official REPD capacity")
        if item.get("repd_record_updated") != project.get("repd_record_updated"):
            article_errors.append(f"article {index} overwrites official REPD update date")
        if clean(item.get("technology")) != clean(project.get("technology")):
            article_errors.append(f"article {index} technology binding mismatch")
        parsed_url = urlparse(clean(item.get("url")))
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            article_errors.append(f"article {index} URL invalid")
        try:
            published = datetime.fromisoformat(clean(item.get("published"))).date()
            if not cutoff <= published <= latest:
                article_errors.append(f"article {index} outside news horizon")
        except Exception:
            article_errors.append(f"article {index} publication date invalid")
        confidence = number(item.get("confidence"))
        if confidence is None or not MIN_CONFIDENCE <= confidence <= 100:
            article_errors.append(f"article {index} confidence below threshold")
        evidence = item.get("match_evidence") or {}
        for gate in ("identity_gate_passed", "technology_gate_passed", "foreign_veto_passed", "duplicate_name_gate_passed"):
            if evidence.get(gate) is not True:
                article_errors.append(f"article {index} missing passed {gate}")
        if evidence.get("capacity_only") is not False or evidence.get("capacity_is_corroboration_only") is not True:
            article_errors.append(f"article {index} treats capacity as identity")
        anchors = set(evidence.get("anchors") or [])
        if not anchors & {"planning_reference", "exact_project_name_in_headline", "exact_project_name", "distinctive_name_variant", "distinctive_project_name_tokens"}:
            article_errors.append(f"article {index} lacks a public identity anchor")
        literal_technology = evidence.get("technology_context_hit") is True
        inferred_technology = evidence.get("technology_context_inferred") is True
        if not (literal_technology or inferred_technology):
            article_errors.append(f"article {index} has no literal or safely inferred technology context")
        if inferred_technology and "technology_context_inferred_from_source_and_identity" not in anchors:
            article_errors.append(f"article {index} omits its inferred-technology audit anchor")
        story_context = norm(" ".join((clean(item.get("headline")), clean(item.get("source")), clean(item.get("source_url")))))
        project_context = norm(" ".join(clean(project.get(key)) for key in ("name", "country", "county", "region", "planning_authority", "planning_application_reference")))
        leaked = [phrase for phrase in FOREIGN_PHRASES if phrase in story_context and phrase not in project_context]
        if leaked:
            article_errors.append(f"article {index} foreign-location leakage: {leaked}")
        bad = [phrase for phrase in KNOWN_BAD if phrase in story_context]
        if bad:
            article_errors.append(f"article {index} known false-positive class: {bad}")
    check(not article_errors, "all accepted news passes identity/technology/foreign/quality gates", "; ".join(article_errors[:10]))

    # Offline matcher fixtures guard the coverage repair while retaining the
    # V6 false-positive controls.  They use only the committed public snapshot.
    fixture_errors = []
    try:
        import major_project_news_v6 as matcher

        _fixture_snapshot, fixture_projects = matcher.load_project_snapshot()
        fixture_now = datetime.now(timezone.utc)

        def fixture_story(title, source, source_url):
            return {
                "title": title, "description": "", "source": source,
                "source_url": source_url, "link": "https://example.test/v6-fixture",
                "published": fixture_now,
            }

        positives = (
            ("DESNZ grants DCO for 150MW Dean Moor solar project in Cumbria", "GOV.UK", "https://www.gov.uk", "14550"),
            ("One Earth development consent decision announced", "GOV.UK", "https://www.gov.uk", "14806"),
            ("Longhedge solar project begins construction in Nottinghamshire", "reNEWS", "https://renews.biz", "11063"),
        )
        for title, source_name, source_url, expected_ref in positives:
            matched, resolution, _detail = matcher._resolve_story(
                fixture_story(title, source_name, source_url), fixture_projects
            )
            if matched is None or matched.get("repd_ref") != expected_ref:
                fixture_errors.append(f"true-positive fixture {expected_ref} resolved as {resolution}/{matched and matched.get('repd_ref')}")

        negatives = (
            ("New Jersey Board of Public Utilities releases 150MW BTM energy storage proposal", "Energy-Storage.News", "https://energy-storage.news"),
            ("Capital Dynamics acquires 170MW/680MWh BESS in County Kerry, Ireland", "Solar Power Portal", "https://solarpowerportal.co.uk"),
            ("The Grange celebrates Forest Healthcare's National Care Award", "BBC", "https://bbc.co.uk"),
            ("150MW battery storage project secures financing", "Energy-Storage.News", "https://energy-storage.news"),
            ("One Earth solar project announces an update", "Example News", "https://example.com"),
            ("Approval for East Yorkshire offshore wind farm substation", "BBC", "https://www.bbc.co.uk"),
        )
        for title, source_name, source_url in negatives:
            matched, resolution, _detail = matcher._resolve_story(
                fixture_story(title, source_name, source_url), fixture_projects
            )
            if matched is not None:
                fixture_errors.append(f"known false-positive fixture matched REPD {matched.get('repd_ref')}: {title}")
    except Exception as exc:
        fixture_errors.append(f"fixture replay raised {type(exc).__name__}: {exc}")
    check(not fixture_errors, "offline news matcher true/false-positive fixtures", "; ".join(fixture_errors))

    links = load(DIST / "project_news_links_v6.json")
    link_rows = links.get("links") or []
    check(links.get("schema") == "globalgrid2050.project-news-links.v6", "project-news relationship schema")
    check(links.get("article_count") == len(items), "relationship article count permits zero")
    check(links.get("link_count") == len(link_rows), "relationship link count exact")
    check(links.get("primary_link_count") == len(items), "relationship metadata has exactly one primary per article")
    check(
        links.get("related_development_link_count")
        == sum(link.get("role") == "RELATED_DEVELOPMENT" for link in link_rows),
        "relationship related-link metadata exact",
    )
    link_rules = links.get("rules") or {}
    check(
        link_rules.get("one_primary_match_per_article") is True
        and link_rules.get("primary_match_drives_news_signal") is True
        and link_rules.get("related_development_drives_news_signal") is False,
        "relationship NEWS SIGNAL policy explicit",
    )
    primary_counts, link_errors = Counter(), []
    for link in link_rows:
        article_id, ref, role = clean(link.get("gg_article_id")), clean(link.get("repd_ref")), clean(link.get("role"))
        project = by_ref.get(ref)
        if article_id not in article_ids or not project:
            link_errors.append(f"link references unknown article/project {article_id}/{ref}")
            continue
        if link.get("gg_project_id") != project.get("gg_project_id") or link.get("gg_development_id") != project.get("gg_development_id"):
            link_errors.append(f"link identity mismatch {article_id}/{ref}")
        if role == "PRIMARY_MATCH":
            primary_counts[article_id] += 1
            if link.get("eligible_for_news_signal") is not True:
                link_errors.append(f"primary link signal false {article_id}")
        elif role == "RELATED_DEVELOPMENT":
            if link.get("eligible_for_news_signal") is not False:
                link_errors.append(f"related link drives signal {article_id}/{ref}")
        else:
            link_errors.append(f"unsupported link role {role}")
    if any(primary_counts[article_id] != 1 for article_id in article_ids):
        link_errors.append("one or more articles does not have exactly one PRIMARY_MATCH")
    check(not link_errors, "all project-news relationships valid", "; ".join(link_errors[:10]))

    combined_public = json.dumps({"projects": projects, "news": news, "links": links}, ensure_ascii=False).lower()
    for forbidden in ("private_relationship", "relationship_score", "visit_priority", "commercial_priority", "personal_email"):
        check(forbidden not in combined_public, f"no private field: {forbidden}")

    report = {
        "schema": "globalgrid2050.renewables-v6-integrity.v6",
        "pass": not errors,
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "source_records": EXPECTED_ROWS,
            "source_unique_refs": EXPECTED_ROWS,
            "public_projects": len(rows),
            "solar_projects": solar,
            "bess_projects": bess,
            "record_updates_supplied": updates,
            "record_updates_missing": len(rows) - updates,
            "news_candidates": telemetry.get("deduplicated_article_candidates"),
            "news_accepted": len(items),
            "news_rejected": telemetry.get("articles_rejected"),
            "news_ambiguous": telemetry.get("articles_ambiguous"),
            "news_retained": telemetry.get("previous_articles_carried_forward"),
            "solar_rotation_cursor_next": query_plan.get("solar_rotation_cursor_next"),
            "project_news_links": len(link_rows),
        },
        "checks": checks,
        "errors": errors,
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if errors:
        print("V6 AGREED-SCOPE VALIDATION FAILED")
        for error in errors[:150]:
            print(" -", error)
        raise SystemExit(1)
    print("V6 AGREED-SCOPE VALIDATION PASS", json.dumps(report["metrics"], sort_keys=True))


if __name__ == "__main__":
    main()
