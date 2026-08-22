#!/usr/bin/env python3
"""Official DESNZ Q2 2026 source retrieval and deterministic reconciliation.

The published CSV is a two-decimal representation of several capacity values,
whereas the XLSX retains the underlying precision.  V6 therefore uses the XLSX
capacity as the canonical official value only after both publications pass the
same row/Ref-ID gates and every difference is format-equivalent.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DIST = ROOT / "dist"
CANONICAL_CSV = DATA / "latest_repd_v6_canonical.csv"
REPORT = DIST / "repd_source_reconciliation_v6.json"
MANIFEST = DIST / "manifest_v6.json"

SOURCE_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
CSV_URL = "https://assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv"
XLSX_URL = "https://assets.publishing.service.gov.uk/media/6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx"
PUBLICATION_DATE = "2026-08-03"
DATASET_TITLE = "Renewable Energy Planning Database (REPD): July 2026 (Q2 2026)"

EXPECTED_ROWS = 14657
EXPECTED_SOLAR_GT1 = 3445
EXPECTED_BESS_GT100 = 269
EXPECTED_CSV_SHA256 = "84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035"
EXPECTED_XLSX_SHA256 = "624a0a9712c58a7a93716e51f2bf054eec8b1af7170f6f9516cc10cd248e2657"
CAPACITY_ROUNDING_TOLERANCE_MW = 0.0050001

CORE_TEXT_FIELDS = [
    "Site Name",
    "Technology Type",
    "Development Status (short)",
    "Record Last Updated (dd/mm/yyyy)",
    "Operator (or Applicant)",
    "Planning Application Reference",
    "Planning Authority",
]
OFFICIAL_DATE_FIELDS = [
    "Planning Application Submitted",
    "Planning Application Withdrawn",
    "Planning Permission Refused",
    "Planning Permission Granted",
    "Planning Permission Expired",
    "Under Construction",
    "Operational",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def collapse(value) -> str:
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return ""
    text = str(value).replace("_x000D_", " ").replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def norm_text(value) -> str:
    return collapse(value).casefold()


def norm_date(value) -> str:
    if value is None or (not isinstance(value, str) and pd.isna(value)) or not str(value).strip():
        return ""
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.strftime("%Y-%m-%d")
    text = collapse(value)
    for pattern in ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def norm_number(value):
    if value is None or (not isinstance(value, str) and pd.isna(value)) or not str(value).strip():
        return None
    try:
        number = float(str(value).replace(",", ""))
        return number if math.isfinite(number) else None
    except Exception:
        return None


def clean_ref(value) -> str:
    text = collapse(value)
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text


def canonicalise_headers(frame: pd.DataFrame) -> pd.DataFrame:
    recognised = CORE_TEXT_FIELDS + OFFICIAL_DATE_FIELDS + [
        "Ref ID",
        "Old Ref ID",
        "Installed Capacity (MWelec)",
        "County",
        "Region",
        "Country",
        "Storage Co-location REPD Ref ID",
        "Are they re-applying (New REPD Ref)",
        "Are they re-applying (Old REPD Ref)",
        "Planning Permission Granted",
    ]
    aliases = {name.casefold(): name for name in recognised}
    aliases.update({
        "record last updated": "Record Last Updated (dd/mm/yyyy)",
        "record last updated (dd/mm/yyyy)": "Record Last Updated (dd/mm/yyyy)",
        "planning permission granted": "Planning Permission Granted",
    })
    renamed = {}
    seen = {}
    for source in frame.columns:
        collapsed = re.sub(r"\s+", " ", str(source).strip())
        target = aliases.get(collapsed.casefold(), collapsed)
        if target in seen:
            raise RuntimeError(f"Header canonicalisation collision: {seen[target]!r} and {source!r} -> {target!r}")
        seen[target] = source
        renamed[source] = target
    return frame.rename(columns=renamed)


def fetch_bytes(url: str) -> bytes:
    last_error = None
    for attempt in range(3):
        request = Request(url, headers={"User-Agent": "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"})
        try:
            with urlopen(request, timeout=75) as response:
                payload = response.read()
                if not payload:
                    raise RuntimeError("empty response")
                return payload
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to retrieve official source after three attempts: {url}: {last_error}")


def read_csv(raw: bytes) -> pd.DataFrame:
    last_error = None
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            frame = pd.read_csv(
                io.BytesIO(raw),
                encoding=encoding,
                dtype=str,
                keep_default_na=False,
                on_bad_lines="error",
                engine="python",
            )
            return canonicalise_headers(frame)
        except UnicodeDecodeError as exc:
            last_error = exc
    raise RuntimeError(f"Unable to decode official REPD CSV: {last_error}")


def read_xlsx(raw: bytes) -> tuple[pd.DataFrame, str]:
    book = pd.ExcelFile(io.BytesIO(raw), engine="openpyxl")
    required = {"Ref ID", "Site Name", "Technology Type", "Installed Capacity (MWelec)"}
    for sheet in book.sheet_names:
        frame = canonicalise_headers(pd.read_excel(book, sheet_name=sheet, engine="openpyxl"))
        if required.issubset(frame.columns):
            return frame, sheet
    raise RuntimeError(f"No REPD data sheet found in official XLSX; sheets={book.sheet_names}")


def indexed(frame: pd.DataFrame, label: str) -> pd.DataFrame:
    if "Ref ID" not in frame.columns:
        raise RuntimeError(f"{label} missing Ref ID")
    refs = [clean_ref(value) for value in frame["Ref ID"].tolist()]
    missing = sum(not value for value in refs)
    duplicates = len(refs) - len(set(refs))
    if missing or duplicates:
        raise RuntimeError(f"{label} invalid Ref IDs: missing={missing} duplicates={duplicates}")
    out = frame.copy()
    out["__repd_ref"] = refs
    return out.set_index("__repd_ref", drop=False)


def threshold_counts(frame: pd.DataFrame) -> tuple[int, int]:
    solar = 0
    bess = 0
    for _, row in frame.iterrows():
        capacity = norm_number(row.get("Installed Capacity (MWelec)"))
        if capacity is None:
            continue
        technology = norm_text(row.get("Technology Type"))
        if "solar photovoltaic" in technology and capacity > 1.0:
            solar += 1
        if "battery" in technology and capacity > 100.0:
            bess += 1
    return solar, bess


def planning_refs_equivalent(csv_value, xlsx_value) -> bool:
    left, right = norm_text(csv_value), norm_text(xlsx_value)
    missing = {"", "n/a", "na", "none", "not known", "unknown", "not supplied"}
    if left in missing and right in missing:
        return True
    if left == right:
        return True
    # Excel may coerce a digits-only planning reference and remove a leading zero.
    return left.isdigit() and right.isdigit() and int(left) == int(right)


def build_canonical(csv_frame: pd.DataFrame, xlsx_frame: pd.DataFrame) -> pd.DataFrame:
    csv_ix = indexed(csv_frame, "CSV")
    xlsx_ix = indexed(xlsx_frame, "XLSX")
    canonical = csv_ix.copy()

    # Sanitise control-code representation without inventing a replacement value.
    for column in canonical.columns:
        if column != "__repd_ref":
            canonical[column] = canonical[column].map(collapse)

    # The workbook is the precision-preserving official representation of capacity.
    capacities = []
    for ref in canonical.index:
        value = norm_number(xlsx_ix.at[ref, "Installed Capacity (MWelec)"])
        capacities.append("" if value is None else format(value, ".15g"))
    canonical["Installed Capacity (MWelec)"] = capacities
    # Planning references are identifiers rather than numbers. Excel's typed import
    # can expose a leading zero that the CSV serialisation omitted; keep that exact
    # official workbook representation after integer-equivalence has been validated.
    if "Planning Application Reference" in canonical.columns:
        canonical["Planning Application Reference"] = [
            collapse(xlsx_ix.at[ref, "Planning Application Reference"]) for ref in canonical.index
        ]
    canonical["Ref ID"] = [clean_ref(value) for value in canonical["Ref ID"]]
    return canonical.drop(columns=["__repd_ref"])


def reconcile(csv_raw: bytes, xlsx_raw: bytes) -> tuple[pd.DataFrame, dict, dict]:
    csv_frame = read_csv(csv_raw)
    xlsx_frame, xlsx_sheet = read_xlsx(xlsx_raw)
    csv_ix = indexed(csv_frame, "CSV")
    xlsx_ix = indexed(xlsx_frame, "XLSX")

    errors = []
    checks = []

    def check(ok, gate, detail=""):
        checks.append({"gate": gate, "pass": bool(ok), "detail": detail})
        if not ok:
            errors.append(f"{gate}: {detail}" if detail else gate)

    csv_refs, xlsx_refs = set(csv_ix.index), set(xlsx_ix.index)
    check(len(csv_ix) == EXPECTED_ROWS, "CSV row count exact", f"actual={len(csv_ix)} expected={EXPECTED_ROWS}")
    check(len(xlsx_ix) == EXPECTED_ROWS, "XLSX row count exact", f"actual={len(xlsx_ix)} expected={EXPECTED_ROWS}")
    check(len(csv_refs) == EXPECTED_ROWS, "CSV unique Ref ID count exact", f"actual={len(csv_refs)}")
    check(len(xlsx_refs) == EXPECTED_ROWS, "XLSX unique Ref ID count exact", f"actual={len(xlsx_refs)}")
    check(csv_refs == xlsx_refs, "CSV/XLSX Ref ID sets equal", f"csv_only={len(csv_refs-xlsx_refs)} xlsx_only={len(xlsx_refs-csv_refs)}")
    check(sha256(csv_raw) == EXPECTED_CSV_SHA256, "Q2 CSV immutable SHA-256", sha256(csv_raw))
    check(sha256(xlsx_raw) == EXPECTED_XLSX_SHA256, "Q2 XLSX immutable SHA-256", sha256(xlsx_raw))

    material = []
    representation = {
        "capacity_precision": 0,
        "control_code_whitespace": 0,
        "planning_reference_leading_zero": 0,
        "planning_reference_missing_marker": 0,
    }
    representation_examples = {
        "capacity_precision": [],
        "control_code_whitespace": [],
        "planning_reference_leading_zero": [],
        "planning_reference_missing_marker": [],
    }
    for ref in sorted(csv_refs & xlsx_refs, key=lambda value: (int(value) if value.isdigit() else 10**18, value)):
        left, right = csv_ix.loc[ref], xlsx_ix.loc[ref]
        for field in CORE_TEXT_FIELDS + OFFICIAL_DATE_FIELDS:
            if field not in csv_ix.columns or field not in xlsx_ix.columns:
                material.append({"repd_ref": ref, "field": field, "reason": "missing field in one publication"})
                continue
            if field == "Record Last Updated (dd/mm/yyyy)" or field in OFFICIAL_DATE_FIELDS:
                equivalent = norm_date(left.get(field)) == norm_date(right.get(field))
            elif field == "Planning Application Reference":
                equivalent = planning_refs_equivalent(left.get(field), right.get(field))
                if equivalent and norm_text(left.get(field)) != norm_text(right.get(field)):
                    missing = {"", "n/a", "na", "none", "not known", "unknown", "not supplied"}
                    key = (
                        "planning_reference_missing_marker"
                        if norm_text(left.get(field)) in missing and norm_text(right.get(field)) in missing
                        else "planning_reference_leading_zero"
                    )
                    representation[key] += 1
                    if len(representation_examples[key]) < 10:
                        representation_examples[key].append(
                            {"repd_ref": ref, "csv": collapse(left.get(field)), "xlsx": collapse(right.get(field))}
                        )
            else:
                equivalent = norm_text(left.get(field)) == norm_text(right.get(field))
                raw_left = re.sub(r"\s+", " ", str(left.get(field) or "")).strip().casefold()
                raw_right = re.sub(r"\s+", " ", str(right.get(field) or "")).strip().casefold()
                if equivalent and raw_left != raw_right:
                    representation["control_code_whitespace"] += 1
                    if len(representation_examples["control_code_whitespace"]) < 10:
                        representation_examples["control_code_whitespace"].append(
                            {"repd_ref": ref, "field": field, "csv": collapse(left.get(field)), "xlsx": collapse(right.get(field))}
                        )
            if not equivalent:
                material.append({"repd_ref": ref, "field": field, "csv": collapse(left.get(field)), "xlsx": collapse(right.get(field))})

        csv_capacity = norm_number(left.get("Installed Capacity (MWelec)"))
        xlsx_capacity = norm_number(right.get("Installed Capacity (MWelec)"))
        if csv_capacity is None or xlsx_capacity is None:
            if csv_capacity != xlsx_capacity:
                material.append({"repd_ref": ref, "field": "Installed Capacity (MWelec)", "csv": csv_capacity, "xlsx": xlsx_capacity})
        elif abs(csv_capacity - xlsx_capacity) > CAPACITY_ROUNDING_TOLERANCE_MW:
            material.append({"repd_ref": ref, "field": "Installed Capacity (MWelec)", "csv": csv_capacity, "xlsx": xlsx_capacity})
        elif csv_capacity != xlsx_capacity:
            representation["capacity_precision"] += 1
            if len(representation_examples["capacity_precision"]) < 10:
                representation_examples["capacity_precision"].append(
                    {"repd_ref": ref, "csv": csv_capacity, "xlsx": xlsx_capacity}
                )

    check(not material, "CSV/XLSX material fields reconcile", f"material_mismatches={len(material)}")

    canonical = build_canonical(csv_frame, xlsx_frame) if not errors else pd.DataFrame()
    csv_solar, csv_bess = threshold_counts(csv_frame)
    xlsx_solar, xlsx_bess = threshold_counts(xlsx_frame)
    canonical_solar, canonical_bess = threshold_counts(canonical) if not canonical.empty else (0, 0)
    check(xlsx_solar == EXPECTED_SOLAR_GT1, "XLSX/canonical solar >1MW exact", f"actual={xlsx_solar} expected={EXPECTED_SOLAR_GT1}")
    check(xlsx_bess == EXPECTED_BESS_GT100, "XLSX/canonical BESS >100MW exact", f"actual={xlsx_bess} expected={EXPECTED_BESS_GT100}")
    check(canonical_solar == EXPECTED_SOLAR_GT1, "canonical solar >1MW exact", f"actual={canonical_solar}")
    check(canonical_bess == EXPECTED_BESS_GT100, "canonical BESS >100MW exact", f"actual={canonical_bess}")

    validated_at = utc_now()
    metrics = {
        "csv_rows": len(csv_ix),
        "xlsx_rows": len(xlsx_ix),
        "csv_unique_refs": len(csv_refs),
        "xlsx_unique_refs": len(xlsx_refs),
        "csv_native_solar_gt1_rounded": csv_solar,
        "xlsx_canonical_solar_gt1": xlsx_solar,
        "canonical_solar_gt1": canonical_solar,
        "csv_bess_gt100": csv_bess,
        "xlsx_bess_gt100": xlsx_bess,
        "canonical_bess_gt100": canonical_bess,
        "canonical_combined_projects": canonical_solar + canonical_bess,
        "material_mismatches": len(material),
        "representation_differences": representation,
    }
    report = {
        "schema": "globalgrid2050.repd-source-reconciliation.v6",
        "pass": not errors,
        "validated_at": validated_at,
        "csv_url": CSV_URL,
        "xlsx_url": XLSX_URL,
        "xlsx_sheet": xlsx_sheet,
        "source_hashes": {"csv_sha256": sha256(csv_raw), "xlsx_sha256": sha256(xlsx_raw)},
        "capacity_policy": "XLSX precision is canonical; CSV must be within 0.005 MW display-rounding tolerance",
        "text_policy": "trim/collapse whitespace; treat XLSX _x000D_ as whitespace; use the XLSX representation of integer-equivalent planning references and report leading-zero differences",
        "metrics": metrics,
        "checks": checks,
        "representation_difference_examples": representation_examples,
        "material_mismatch_examples": material[:25],
        "errors": errors,
    }
    manifest = {
        "schema": "globalgrid2050.repd-manifest.v6",
        "schema_version": 6,
        "status": "VALIDATED" if not errors else "REJECTED",
        "validated_at": validated_at,
        "source_owner": "Department for Energy Security and Net Zero (DESNZ)",
        "source_page": SOURCE_PAGE,
        "source_page_last_updated": PUBLICATION_DATE,
        "source_dataset_title": DATASET_TITLE,
        "source_url": CSV_URL,
        "source_excel_url": XLSX_URL,
        "source_hashes": report["source_hashes"],
        "source_record_count": EXPECTED_ROWS,
        "source_unique_ref_count": EXPECTED_ROWS,
        "canonical_capacity_source": "official XLSX precision, reconciled to official CSV by Ref ID",
        "header_policy": "trim + collapse internal whitespace + case-insensitive aliases",
        "missing_value_policy": "official blanks remain null; no value or date is invented",
        "thresholds": {"solar_mw_exclusive": 1.0, "bess_mw_exclusive": 100.0},
        "canonical_counts": {"solar": EXPECTED_SOLAR_GT1, "bess": EXPECTED_BESS_GT100, "combined": EXPECTED_SOLAR_GT1 + EXPECTED_BESS_GT100},
    }
    return canonical, report, manifest


def run_reconciliation() -> tuple[pd.DataFrame, dict, dict]:
    csv_raw = fetch_bytes(CSV_URL)
    xlsx_raw = fetch_bytes(XLSX_URL)
    return reconcile(csv_raw, xlsx_raw)


def write_outputs(canonical: pd.DataFrame, report: dict, manifest: dict) -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if not report.get("pass"):
        raise RuntimeError("Official Q2 CSV/XLSX reconciliation failed; previous validated snapshot retained")
    canonical.to_csv(CANONICAL_CSV, index=False, encoding="utf-8-sig")
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    canonical, report, manifest = run_reconciliation()
    write_outputs(canonical, report, manifest)
    print("REPD SOURCE RECONCILIATION PASS", json.dumps(report["metrics"], sort_keys=True))


if __name__ == "__main__":
    main()
