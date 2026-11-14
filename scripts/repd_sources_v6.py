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
import os
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

# Release descriptor. The July 2026 (Q2) values above are the DEFAULT descriptor,
# so a run without REPD_RELEASE_DESCRIPTOR behaves exactly as the historical V6
# chain did (same names, same gates, same bytes). A descriptor JSON overrides the
# pins for a later release and MUST redirect every output to REPD_OUT_DIR under
# new release-suffixed names; the frozen *_v6 files are never written by it.
RELEASE_ID = "2026q2"
QUARTER_LABEL = "Q2"
OUTPUT_SUFFIX = "v6"
EXPECTED_UNIQUE_REFS = EXPECTED_ROWS
DUPLICATE_ROW_POLICY = "reject"  # "reject" | "drop_identical"
DATE_RULE = "csv"  # "csv" (historical) | "xlsx_typed_wins"
NA_DATE_MARKERS = {"na", "n/a"}
RELEASE_DESCRIPTOR_PATH = os.environ.get("REPD_RELEASE_DESCRIPTOR", "").strip()
RELEASE_DESCRIPTOR: dict = {}
if RELEASE_DESCRIPTOR_PATH:
    RELEASE_DESCRIPTOR = json.loads(Path(RELEASE_DESCRIPTOR_PATH).read_text(encoding="utf-8"))
    _required = [
        "release_id", "quarter_label", "output_suffix", "csv_url", "xlsx_url", "publication_date",
        "dataset_title", "expected_rows", "expected_unique_refs", "expected_solar_gt1",
        "expected_bess_gt100", "expected_csv_sha256", "expected_xlsx_sha256",
    ]
    _missing = [key for key in _required if RELEASE_DESCRIPTOR.get(key) in (None, "")]
    if _missing:
        raise RuntimeError(f"Release descriptor {RELEASE_DESCRIPTOR_PATH} missing keys: {_missing}")
    RELEASE_ID = str(RELEASE_DESCRIPTOR["release_id"])
    QUARTER_LABEL = str(RELEASE_DESCRIPTOR["quarter_label"])
    OUTPUT_SUFFIX = str(RELEASE_DESCRIPTOR["output_suffix"])
    if not re.fullmatch(r"[0-9]{4}q[1-4]", OUTPUT_SUFFIX):
        raise RuntimeError(f"Descriptor output_suffix must look like 2026q3 (never v6): {OUTPUT_SUFFIX!r}")
    CSV_URL = RELEASE_DESCRIPTOR["csv_url"]
    XLSX_URL = RELEASE_DESCRIPTOR["xlsx_url"]
    PUBLICATION_DATE = RELEASE_DESCRIPTOR["publication_date"]
    DATASET_TITLE = RELEASE_DESCRIPTOR["dataset_title"]
    EXPECTED_ROWS = int(RELEASE_DESCRIPTOR["expected_rows"])
    EXPECTED_UNIQUE_REFS = int(RELEASE_DESCRIPTOR["expected_unique_refs"])
    EXPECTED_SOLAR_GT1 = int(RELEASE_DESCRIPTOR["expected_solar_gt1"])
    EXPECTED_BESS_GT100 = int(RELEASE_DESCRIPTOR["expected_bess_gt100"])
    EXPECTED_CSV_SHA256 = RELEASE_DESCRIPTOR["expected_csv_sha256"]
    EXPECTED_XLSX_SHA256 = RELEASE_DESCRIPTOR["expected_xlsx_sha256"]
    DUPLICATE_ROW_POLICY = RELEASE_DESCRIPTOR.get("duplicate_row_policy", DUPLICATE_ROW_POLICY)
    DATE_RULE = RELEASE_DESCRIPTOR.get("date_rule", DATE_RULE)
    if DUPLICATE_ROW_POLICY not in {"reject", "drop_identical"} or DATE_RULE not in {"csv", "xlsx_typed_wins"}:
        raise RuntimeError(f"Unsupported descriptor policy: duplicates={DUPLICATE_ROW_POLICY!r} dates={DATE_RULE!r}")
    _out = os.environ.get("REPD_OUT_DIR", "").strip()
    if not _out:
        raise RuntimeError("REPD_OUT_DIR is required with a release descriptor (outputs are never written in place)")
    DATA = Path(_out) / "data"
    DIST = Path(_out) / "dist"
    CANONICAL_CSV = DATA / f"latest_repd_{OUTPUT_SUFFIX}_canonical.csv"
    REPORT = DIST / f"repd_source_reconciliation_{OUTPUT_SUFFIX}.json"
    MANIFEST = DIST / f"manifest_{OUTPUT_SUFFIX}.json"

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
    # REPD_VALIDATED_AT pins the timestamp so a rerun on the same bytes is byte-identical.
    return os.environ.get("REPD_VALIDATED_AT", "").strip() or datetime.now(timezone.utc).isoformat()


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


def strict_date(value) -> str:
    """Day-first or ISO only; never infers month-first (used by DATE_RULE xlsx_typed_wins)."""
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return ""
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.strftime("%Y-%m-%d")
    text = collapse(value)
    for pattern in ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def month_first_date(value) -> str:
    try:
        return datetime.strptime(collapse(value), "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return ""


def is_typed_date(value) -> bool:
    return isinstance(value, (datetime, pd.Timestamp)) and not pd.isna(value)


def drop_identical_duplicates(frame: pd.DataFrame, label: str) -> tuple[pd.DataFrame, list[dict]]:
    """Keep the first of exactly identical repeated rows; conflicting duplicates still fail closed."""
    if "Ref ID" not in frame.columns:
        raise RuntimeError(f"{label} missing Ref ID")
    refs = [clean_ref(value) for value in frame["Ref ID"].tolist()]
    positions: dict[str, list[int]] = {}
    for index, ref in enumerate(refs):
        positions.setdefault(ref, []).append(index)
    evidence, drop = [], set()
    for ref, indices in positions.items():
        if len(indices) < 2 or not ref:
            continue
        first = [collapse(v) for v in frame.iloc[indices[0]].tolist()]
        if any([collapse(v) for v in frame.iloc[i].tolist()] != first for i in indices[1:]):
            raise RuntimeError(f"{label} conflicting duplicate Ref ID {ref}; refusing to choose a record")
        drop.update(indices[1:])
        evidence.append({"repd_ref": ref, "occurrences": len(indices),
                         "data_rows_1_based": [i + 1 for i in indices], "exactly_identical": True})
    kept = frame.iloc[[i for i in range(len(frame)) if i not in drop]].reset_index(drop=True)
    return kept, evidence


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
    if DATE_RULE == "xlsx_typed_wins":
        # General date rule: a typed workbook date is the official value; every consumed
        # date is serialised strictly dd/mm/yyyy; NA text is a blank (unknown), never a date.
        for field in ["Record Last Updated (dd/mm/yyyy)"] + OFFICIAL_DATE_FIELDS:
            if field not in canonical.columns or field not in xlsx_ix.columns:
                continue
            values = []
            for ref in canonical.index:
                typed = xlsx_ix.at[ref, field]
                iso = strict_date(typed) if is_typed_date(typed) else strict_date(csv_ix.at[ref, field])
                values.append(datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y") if iso else "")
            canonical[field] = values
    canonical["Ref ID"] = [clean_ref(value) for value in canonical["Ref ID"]]
    return canonical.drop(columns=["__repd_ref"])


def reconcile(csv_raw: bytes, xlsx_raw: bytes) -> tuple[pd.DataFrame, dict, dict]:
    csv_frame = read_csv(csv_raw)
    xlsx_frame, xlsx_sheet = read_xlsx(xlsx_raw)
    csv_source_rows, xlsx_source_rows = len(csv_frame), len(xlsx_frame)
    duplicate_evidence = {"csv": [], "xlsx": []}
    if DUPLICATE_ROW_POLICY == "drop_identical":
        csv_frame, duplicate_evidence["csv"] = drop_identical_duplicates(csv_frame, "CSV")
        xlsx_frame, duplicate_evidence["xlsx"] = drop_identical_duplicates(xlsx_frame, "XLSX")
    csv_ix = indexed(csv_frame, "CSV")
    xlsx_ix = indexed(xlsx_frame, "XLSX")

    errors = []
    checks = []

    def check(ok, gate, detail=""):
        checks.append({"gate": gate, "pass": bool(ok), "detail": detail})
        if not ok:
            errors.append(f"{gate}: {detail}" if detail else gate)

    csv_refs, xlsx_refs = set(csv_ix.index), set(xlsx_ix.index)
    check(csv_source_rows == EXPECTED_ROWS, "CSV row count exact", f"actual={csv_source_rows} expected={EXPECTED_ROWS}")
    check(xlsx_source_rows == EXPECTED_ROWS, "XLSX row count exact", f"actual={xlsx_source_rows} expected={EXPECTED_ROWS}")
    check(len(csv_refs) == EXPECTED_UNIQUE_REFS, "CSV unique Ref ID count exact", f"actual={len(csv_refs)}")
    check(len(xlsx_refs) == EXPECTED_UNIQUE_REFS, "XLSX unique Ref ID count exact", f"actual={len(xlsx_refs)}")
    check(csv_refs == xlsx_refs, "CSV/XLSX Ref ID sets equal", f"csv_only={len(csv_refs-xlsx_refs)} xlsx_only={len(xlsx_refs-csv_refs)}")
    check(sha256(csv_raw) == EXPECTED_CSV_SHA256, f"{QUARTER_LABEL} CSV immutable SHA-256", sha256(csv_raw))
    check(sha256(xlsx_raw) == EXPECTED_XLSX_SHA256, f"{QUARTER_LABEL} XLSX immutable SHA-256", sha256(xlsx_raw))
    if DUPLICATE_ROW_POLICY != "reject":
        check(
            [d["repd_ref"] for d in duplicate_evidence["csv"]] == [d["repd_ref"] for d in duplicate_evidence["xlsx"]],
            "CSV/XLSX identical duplicate rows agree",
            f"csv={[d['repd_ref'] for d in duplicate_evidence['csv']]} xlsx={[d['repd_ref'] for d in duplicate_evidence['xlsx']]}",
        )

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
    if DATE_RULE == "xlsx_typed_wins":
        for key in ("csv_month_first_date", "na_date_text"):
            representation[key] = 0
            representation_examples[key] = []
    for ref in sorted(csv_refs & xlsx_refs, key=lambda value: (int(value) if value.isdigit() else 10**18, value)):
        left, right = csv_ix.loc[ref], xlsx_ix.loc[ref]
        for field in CORE_TEXT_FIELDS + OFFICIAL_DATE_FIELDS:
            if field not in csv_ix.columns or field not in xlsx_ix.columns:
                material.append({"repd_ref": ref, "field": field, "reason": "missing field in one publication"})
                continue
            if (field == "Record Last Updated (dd/mm/yyyy)" or field in OFFICIAL_DATE_FIELDS) and DATE_RULE == "xlsx_typed_wins":
                csv_value, xlsx_value = left.get(field), right.get(field)
                key = ""
                if is_typed_date(xlsx_value):
                    equivalent = strict_date(csv_value) == strict_date(xlsx_value)
                    if not equivalent and month_first_date(csv_value) == strict_date(xlsx_value):
                        equivalent, key = True, "csv_month_first_date"
                elif norm_text(csv_value) in NA_DATE_MARKERS | {""} and norm_text(xlsx_value) in NA_DATE_MARKERS | {""}:
                    equivalent = True
                    key = "na_date_text" if (norm_text(csv_value) or norm_text(xlsx_value)) else ""
                else:
                    # Unparseable non-blank text on either side is material: fail closed.
                    equivalent = bool(strict_date(csv_value)) and strict_date(csv_value) == strict_date(xlsx_value)
                if key:
                    representation[key] += 1
                    if len(representation_examples[key]) < 30:
                        representation_examples[key].append(
                            {"repd_ref": ref, "field": field, "csv": collapse(csv_value), "xlsx": strict_date(xlsx_value) or collapse(xlsx_value)}
                        )
            elif field == "Record Last Updated (dd/mm/yyyy)" or field in OFFICIAL_DATE_FIELDS:
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
        "csv_rows": csv_source_rows,
        "xlsx_rows": xlsx_source_rows,
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
    if RELEASE_DESCRIPTOR:
        report["release_id"] = RELEASE_ID
        report["date_rule"] = DATE_RULE
        report["duplicate_row_policy"] = DUPLICATE_ROW_POLICY
        report["identical_duplicate_rows_dropped"] = duplicate_evidence
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
        "source_unique_ref_count": EXPECTED_UNIQUE_REFS,
        "canonical_capacity_source": "official XLSX precision, reconciled to official CSV by Ref ID",
        "header_policy": "trim + collapse internal whitespace + case-insensitive aliases",
        "missing_value_policy": "official blanks remain null; no value or date is invented",
        "thresholds": {"solar_mw_exclusive": 1.0, "bess_mw_exclusive": 100.0},
        "canonical_counts": {"solar": EXPECTED_SOLAR_GT1, "bess": EXPECTED_BESS_GT100, "combined": EXPECTED_SOLAR_GT1 + EXPECTED_BESS_GT100},
    }
    if RELEASE_DESCRIPTOR:
        manifest["release_id"] = RELEASE_ID
        manifest["date_rule"] = DATE_RULE
        manifest["duplicate_row_policy"] = DUPLICATE_ROW_POLICY
    return canonical, report, manifest


def run_reconciliation(csv_file: str = "", xlsx_file: str = "", fetch=fetch_bytes) -> tuple[pd.DataFrame, dict, dict]:
    # Offline mode: local official bytes (same hash gates apply); otherwise the injectable fetcher.
    csv_file = csv_file or os.environ.get("REPD_SOURCE_CSV_FILE", "").strip()
    xlsx_file = xlsx_file or os.environ.get("REPD_SOURCE_XLSX_FILE", "").strip()
    if bool(csv_file) != bool(xlsx_file):
        raise RuntimeError("Offline mode needs both the CSV and the XLSX file")
    csv_raw = Path(csv_file).read_bytes() if csv_file else fetch(CSV_URL)
    xlsx_raw = Path(xlsx_file).read_bytes() if xlsx_file else fetch(XLSX_URL)
    return reconcile(csv_raw, xlsx_raw)


def write_outputs(canonical: pd.DataFrame, report: dict, manifest: dict) -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if not report.get("pass"):
        raise RuntimeError(f"Official {QUARTER_LABEL} CSV/XLSX reconciliation failed; previous validated snapshot retained")
    canonical.to_csv(CANONICAL_CSV, index=False, encoding="utf-8-sig")
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main(argv=None) -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Reconcile the official REPD CSV/XLSX (descriptor via REPD_RELEASE_DESCRIPTOR)")
    parser.add_argument("--csv-file", default="", help="offline mode: local official CSV bytes")
    parser.add_argument("--xlsx-file", default="", help="offline mode: local official XLSX bytes")
    args = parser.parse_args(argv)
    canonical, report, manifest = run_reconciliation(args.csv_file, args.xlsx_file)
    write_outputs(canonical, report, manifest)
    print("REPD SOURCE RECONCILIATION PASS", json.dumps(report["metrics"], sort_keys=True))


if __name__ == "__main__":
    main()
