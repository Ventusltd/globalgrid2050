#!/usr/bin/env python3
"""Isolated DESNZ October 2026 (Q3) REPD intake and Q2 delta audit.

NO live files, Q2/V6 outputs, homepage files or historical releases are modified.
Outputs are staged for review and uploaded as temporary GitHub Actions artifacts.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

# Reuse the already validated Q2 parsing, identity and canonical capacity rules.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import repd_sources_v6 as q2  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("REPD_Q3_OUTPUT", ROOT / ".repd-staging" / "2026-10"))
SOURCE_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
Q3_CSV = "https://assets.publishing.service.gov.uk/media/6af42ff0a4004bdbe54e54a5/REPD_Publication_Q3_2026.csv"
Q3_XLSX = "https://assets.publishing.service.gov.uk/media/6af42ffdb83b3cae0d0a21c9/REPD_Publication_Q3_2026.xlsx"
PUBLICATION_DATE = "2026-11-13"
# Observed in the immutable October 2026 release on 13 November.
# Conflicting date cells are BLANKED in the staged candidate, with both
# official representations in the audit. This does not adjudicate the dates.
EXPECTED_Q3_DATE_CONFLICTS = {
    ("21424", "Planning Application Submitted"),
    ("21438", "Planning Application Submitted"),
    ("21456", "Planning Application Submitted"),
    ("21463", "Planning Application Submitted"),
    ("21464", "Planning Application Submitted"),
}
BASELINE_COMMIT = "73cbdec10bbd3fe2f8313b60b1acc2d22d31b517"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check(condition: bool, label: str, issues: list[str]) -> None:
    if not condition:
        issues.append(label)


def canonicalise_exact_duplicates(frame, label: str, issues: list[str]) -> tuple[pd.DataFrame, list[dict]]:
    """Quarantine only exactly equivalent repeated identity rows; never merge contradictions."""
    ref_col = "Ref ID"
    if ref_col not in frame.columns:
        raise RuntimeError(f"{label}: Ref ID column missing")
    refs = [q2.clean_ref(value) for value in frame[ref_col]]
    positions: dict[str, list[int]] = {}
    for i, ref in enumerate(refs):
        positions.setdefault(ref, []).append(i)
    quarantined = []
    for ref, indices in positions.items():
        if len(indices) == 1:
            continue
        first = tuple(q2.collapse(v) for v in frame.iloc[indices[0]].tolist())
        identical = all(tuple(q2.collapse(v) for v in frame.iloc[i].tolist()) == first for i in indices[1:])
        quarantined.append({
            "repd_ref": ref, "source_rows_1_based_including_header": [i + 2 for i in indices],
            "occurrences": len(indices), "exactly_identical": identical,
        })
        if not identical:
            issues.append(f"{label}: conflicting duplicate REPD reference {ref}; refusing canonical data")
    seen = set()
    retained = []
    for i, ref in enumerate(refs):
        if ref not in seen:
            retained.append(i)
            seen.add(ref)
    return frame.iloc[retained].copy().reset_index(drop=True), quarantined


def reconcile(csv_data: bytes, xlsx_data: bytes, old_data: bytes, baseline_name: str, baseline_is_q2: bool) -> tuple[pd.DataFrame | None, dict]:
    issues: list[str] = []
    csv_original = q2.read_csv(csv_data)
    xlsx_original, sheet = q2.read_xlsx(xlsx_data)
    current_csv, csv_duplicate_evidence = canonicalise_exact_duplicates(csv_original, "Q3 CSV", issues)
    current_xlsx, excel_duplicate_evidence = canonicalise_exact_duplicates(xlsx_original, "Q3 Excel", issues)
    previous = q2.read_csv(old_data)
    c = q2.indexed(current_csv, "Q3 CSV")
    x = q2.indexed(current_xlsx, "Q3 XLSX")
    old = q2.indexed(previous, "Q2 CSV")
    csv_ids, excel_ids, old_ids = set(c.index), set(x.index), set(old.index)
    # Fail closed against the last independently validated July/Q2 release.
    # The historical root file is not a Q2 source and must not lower this floor.
    check(len(c) >= 14657 and len(x) >= 14657,
          "Q3 unique reference count below the validated Q2 count (14,657)", issues)
    check(csv_data.endswith(b"\n"), "Q3 source CSV has no final newline", issues)
    # q2.norm_date returns an empty string for an unknown nonblank date.
    # Without this guard two different malformed dates could silently compare equal.
    invalid_dates = []
    date_fields = list(dict.fromkeys(q2.OFFICIAL_DATE_FIELDS + ["Record Last Updated (dd/mm/yyyy)"]))
    for label, frame in (("CSV", current_csv), ("XLSX", current_xlsx)):
        for field in date_fields:
            if field not in frame.columns:
                continue
            for ref, value in zip(frame["Ref ID"], frame[field]):
                raw = q2.collapse(value)
                if raw and raw.casefold() not in {"na", "n/a"} and not q2.norm_date(value):
                    invalid_dates.append({"source": label, "ref": q2.clean_ref(ref),
                                          "field": field, "raw_value": raw[:80]})
    check(not invalid_dates,
          f"Q3 has {len(invalid_dates)} nonblank unparseable date cells: {invalid_dates[:5]}", issues)
    check(csv_ids == excel_ids, "CSV and Excel REPD reference sets differ", issues)
    check({x["repd_ref"] for x in csv_duplicate_evidence} == {x["repd_ref"] for x in excel_duplicate_evidence}, "CSV/Excel duplicate identity disagreement", issues)
    check(len(c) == len(csv_ids), "Duplicate Q3 CSV references", issues)
    check(len(x) == len(excel_ids), "Duplicate Q3 XLSX references", issues)
    # A historical root CSV is suitable for continuity comparisons but not a Q2 release.
    check(len(old_ids) == len(old), "Historical baseline has duplicate references", issues)
    check("Ref ID" in c and "Ref ID" in x, "Q3 missing Ref ID", issues)
    check(set(q2.CORE_TEXT_FIELDS + q2.OFFICIAL_DATE_FIELDS).issubset(c.columns), "Q3 CSV missing required original fields", issues)
    check(set(q2.CORE_TEXT_FIELDS + q2.OFFICIAL_DATE_FIELDS).issubset(x.columns), "Q3 Excel missing required original fields", issues)

    mismatches = []
    rounding_differences = 0
    checked = 0
    fields = list(dict.fromkeys(q2.CORE_TEXT_FIELDS + q2.OFFICIAL_DATE_FIELDS))
    comparable = all(field in c and field in x for field in fields)
    if comparable:
        for ref in sorted(csv_ids & excel_ids):
            a, b = c.loc[ref], x.loc[ref]
            checked += 1
            for field in fields:
                if field == "Planning Application Reference":
                    equal = q2.planning_refs_equivalent(a[field], b[field])
                elif field in q2.OFFICIAL_DATE_FIELDS or field == "Record Last Updated (dd/mm/yyyy)":
                    equal = q2.norm_date(a[field]) == q2.norm_date(b[field])
                else:
                    equal = q2.norm_text(a[field]) == q2.norm_text(b[field])
                if not equal:
                    mismatches.append((ref, field))
            left = q2.norm_number(a.get("Installed Capacity (MWelec)"))
            right = q2.norm_number(b.get("Installed Capacity (MWelec)"))
            if left is None or right is None:
                if left != right:
                    mismatches.append((ref, "Installed Capacity (MWelec)"))
            elif abs(left - right) > q2.CAPACITY_ROUNDING_TOLERANCE_MW:
                mismatches.append((ref, "Installed Capacity (MWelec)"))
            elif left != right:
                rounding_differences += 1
    date_conflicts = []
    unexpected_mismatches = []
    for ref, field in mismatches:
        if (ref, field) in EXPECTED_Q3_DATE_CONFLICTS:
            date_conflicts.append({
                "repd_ref": ref,
                "field": field,
                "official_csv": q2.collapse(c.loc[ref, field]),
                "official_xlsx": q2.norm_date(x.loc[ref, field]),
                "candidate_value": "",
                "resolution": "QUARANTINED_PENDING_SOURCE_CORRECTION",
            })
        else:
            unexpected_mismatches.append((ref, field))
    # An official source correction must be re-reviewed, not silently treated
    # as the previously verified Q3 release.
    observed_date_conflicts = {(event["repd_ref"], event["field"]) for event in date_conflicts}
    check(observed_date_conflicts == EXPECTED_Q3_DATE_CONFLICTS,
          f"Known Q3 date conflicts changed: expected {sorted(EXPECTED_Q3_DATE_CONFLICTS)}, observed {sorted(observed_date_conflicts)}",
          issues)
    check(not unexpected_mismatches,
          f"Unexpected material CSV/Excel disagreements: {unexpected_mismatches[:10]}",
          issues)

    added, removed, retained = csv_ids - old_ids, old_ids - csv_ids, csv_ids & old_ids
    updated_status = []
    updated_capacity = []
    updated_technology = []
    for ref in retained:
        before, after = old.loc[ref], c.loc[ref]
        if q2.norm_text(before.get("Development Status (short)")) != q2.norm_text(after.get("Development Status (short)")):
            updated_status.append(ref)
        if q2.norm_text(before.get("Technology Type")) != q2.norm_text(after.get("Technology Type")):
            updated_technology.append(ref)
        if q2.norm_number(before.get("Installed Capacity (MWelec)")) != q2.norm_number(after.get("Installed Capacity (MWelec)")):
            updated_capacity.append(ref)

    canonical = q2.build_canonical(current_csv, current_xlsx) if not issues else None
    if canonical is not None:
        for event in date_conflicts:
            matches = canonical["Ref ID"].astype(str).eq(event["repd_ref"])
            if matches.sum() != 1:
                issues.append(f"Cannot quarantine date for REPD {event['repd_ref']}: identity missing or repeated")
            else:
                canonical.loc[matches, event["field"]] = ""
        solar, bess = q2.threshold_counts(canonical)
    else:
        solar, bess = 0, 0
    report = {
        "schema": "globalgrid2050.repd-q3-2026-intake.v1",
        "stage": "REJECTED" if issues else ("STAGED_WITH_OFFICIAL_DATE_CONFLICTS" if date_conflicts else "STAGED_FOR_REVIEW"),
        "validated_at": q2.utc_now(),
        "source_owner": "UK DESNZ / Barbour ABI",
        "source_page": SOURCE_PAGE,
        "publication_date": PUBLICATION_DATE,
        "baseline_commit": BASELINE_COMMIT,
        "comparison_baseline": baseline_name,
        "comparison_baseline_sha256": digest(old_data),
        "comparison_baseline_rows": len(old),
        "comparison_is_validated_q2": baseline_is_q2,
        "last_validated_q2_row_count": 14657,
        "q2_row_level_delta_available": baseline_is_q2,
        "q3_source_csv": Q3_CSV,
        "q3_source_xlsx": Q3_XLSX,
        "q3_source_sha256": {"csv": digest(csv_data), "xlsx": digest(xlsx_data)},
        "xlsx_sheet": sheet,
        "csv_rows": len(c),
        "xlsx_rows": len(x),
        "original_csv_rows": len(csv_original),
        "original_xlsx_rows": len(xlsx_original),
        "identical_source_duplicates_quarantined": {
            "csv": csv_duplicate_evidence, "xlsx": excel_duplicate_evidence,
            "source_rows_not_in_candidate": len(csv_original) - len(c)
        },
        "q3_unique_ids": len(csv_ids),
        "duplicate_handling": "Raw official files retained unchanged; only identical source duplicates eliminated from candidate; conflicting records reject data.",
        "csv_excel_id_sets_match": csv_ids == excel_ids,
        "source_columns": {"csv": len(current_csv.columns), "xlsx": len(current_xlsx.columns)},
        "material_mismatch_count": len(mismatches),
        "unparseable_nonblank_date_cells": invalid_dates,
        "material_mismatch_ref_field_examples": mismatches[:20],
        "quarantined_official_date_disagreements": date_conflicts,
        "unexpected_material_disagreements": unexpected_mismatches,
        "date_policy": "Do not choose either disputed official date. Staged canonical cell blank, both values preserved in JSON audit. Never promote without explicit resolution.",
        "capacity_rounding_differences": rounding_differences,
        "records_compared_across_csv_and_excel": checked,
        "reference_changes_vs_comparison_baseline": {
            "new_refs": len(added), "removed_refs": len(removed),
            "retained_refs": len(retained), "status_changed": len(updated_status),
            "technology_changed": len(updated_technology),
            "csv_capacity_changed": len(updated_capacity),
            "new_ref_examples": sorted(added)[:20],
            "removed_ref_examples": sorted(removed)[:20],
        },
        "candidate_threshold_counts": {"solar_gt_1mw": solar, "battery_gt_100mw": bess},
        "capacity_policy": "Reconciled official Excel precision, CSV within 0.0050001 MW rounding tolerance",
        "no_production_promotion": True,
        "failures": issues,
    }
    return canonical, report


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT / "official-sources"
    raw_dir.mkdir(exist_ok=True)
    # Preserve official Q2 inputs alongside the Git SHA and text backup log.
    old_csv = q2.fetch_bytes(q2.CSV_URL)
    old_xlsx = q2.fetch_bytes(q2.XLSX_URL)
    (raw_dir / "REPD_Publication_Q2_2026.csv").write_bytes(old_csv)
    (raw_dir / "REPD_Publication_Q2_2026.xlsx").write_bytes(old_xlsx)
    baseline_provenance = {
        "q2_csv_expected_sha256": q2.EXPECTED_CSV_SHA256,
        "q2_csv_observed_sha256": digest(old_csv),
        "q2_csv_bytes": len(old_csv),
        "q2_xlsx_expected_sha256": q2.EXPECTED_XLSX_SHA256,
        "q2_xlsx_observed_sha256": digest(old_xlsx),
        "q2_xlsx_bytes": len(old_xlsx),
    }
    (OUT / "Q2_BASELINE_SHA256_AUDIT.json").write_text(
        json.dumps(baseline_provenance, indent=2) + "\\n", encoding="utf-8"
    )
    q2_verified = digest(old_csv) == q2.EXPECTED_CSV_SHA256 and digest(old_xlsx) == q2.EXPECTED_XLSX_SHA256
    if q2_verified:
        comparison_data = old_csv
        comparison_name = "Validated July 2026 (Q2) official CSV"
    else:
        # Historical download URLs have changed contents. Never represent them as July 2026.
        comparison_data = (ROOT / "repd.csv").read_bytes()
        comparison_name = "Historical root repd.csv (January 2026 era; NOT Q2)"
    baseline_provenance.update({
        "q2_download_matches_pinned_snapshot": q2_verified,
        "q2_delta_unavailable": not q2_verified,
        "comparison_baseline": comparison_name,
        "historical_root_sha256": digest(comparison_data),
        "note": "Downloaded July-labelled sources differ from immutable Q2 fingerprints. July Q2 per-reference comparison unavailable until original official bytes are recovered." if not q2_verified else "July source fingerprints matched."
    })
    (OUT / "Q2_BASELINE_SHA256_AUDIT.json").write_text(json.dumps(baseline_provenance, indent=2) + "\n", encoding="utf-8")

    csv_raw = q2.fetch_bytes(Q3_CSV)
    excel_raw = q2.fetch_bytes(Q3_XLSX)
    (raw_dir / "REPD_Publication_Q3_2026.csv").write_bytes(csv_raw)
    (raw_dir / "REPD_Publication_Q3_2026.xlsx").write_bytes(excel_raw)
    canonical, report = reconcile(csv_raw, excel_raw, comparison_data, comparison_name, q2_verified)
    baseline_provenance["observed_q2_csv_identical_to_q3_csv"] = digest(old_csv) == digest(csv_raw)
    baseline_provenance["observed_q2_excel_identical_to_q3_excel"] = digest(old_xlsx) == digest(excel_raw)
    (OUT / "Q2_BASELINE_SHA256_AUDIT.json").write_text(json.dumps(baseline_provenance, indent=2) + "\n", encoding="utf-8")
    report["baseline_q2_provenance"] = baseline_provenance
    (OUT / "Q3_RECONCILIATION.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    with (OUT / "INGESTION-LOG.txt").open("w", encoding="utf-8") as handle:
        handle.write(f"REPD October 2026 intake: {report['stage']}\n")
        handle.write(f"Published: {PUBLICATION_DATE}; baseline commit: {BASELINE_COMMIT}\n")
        handle.write(f"CSV rows: {report['csv_rows']}; Excel rows: {report['xlsx_rows']}\n")
        handle.write(f"CSV SHA-256: {digest(csv_raw)}\nExcel SHA-256: {digest(excel_raw)}\n")
        handle.write("Comparison baseline: " + comparison_name + "\n")
        handle.write("Original Q2 bytes at historical links: " + ("verified" if q2_verified else "CHANGED; historical root used instead") + "\n")
        handle.write("Changed records: " + json.dumps(report["reference_changes_vs_comparison_baseline"], sort_keys=True) + "\n")
        handle.write("Quarantined official date differences: " + json.dumps(report["quarantined_official_date_disagreements"], sort_keys=True) + "\n")
        handle.write("Duplicate source rows: " + json.dumps(report["identical_source_duplicates_quarantined"], sort_keys=True) + "\n")
        handle.write("Failures: " + json.dumps(report["failures"]) + "\n")
        handle.write("Live published datasets: UNCHANGED\n")
    if report["failures"]:
        raise RuntimeError("Q3 intake failed validation: " + "; ".join(report["failures"]))
    assert canonical is not None
    canonical.to_csv(OUT / "Q3_CANONICAL_STAGED.csv", index=False, encoding="utf-8-sig")
    print(json.dumps({"status": report["stage"], "rows": report["csv_rows"], "comparison_baseline": comparison_name, "changes": report["reference_changes_vs_comparison_baseline"], "sha256": report["q3_source_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
