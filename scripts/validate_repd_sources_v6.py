#!/usr/bin/env python3
from __future__ import annotations

import io
import json
import math
import re
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
MANIFEST = DIST / "manifest_v4.json"
REPORT = DIST / "repd_source_reconciliation_v6.json"

Q2_ROWS = 14657
Q2_SOLAR_GT1 = 3445
Q2_BESS_GT100 = 269
CORE_FIELDS = [
    "Site Name",
    "Technology Type",
    "Development Status (short)",
    "Installed Capacity (MWelec)",
    "Operator (or Applicant)",
    "Record Last Updated (dd/mm/yyyy)",
]


def collapse(v):
    return re.sub(r"\s+", " ", str(v or "").strip())


def norm_text(v):
    if pd.isna(v):
        return ""
    return collapse(v).lower()


def clean_ref(v):
    if pd.isna(v):
        return ""
    s = str(v).strip()
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s


def norm_number(v):
    if pd.isna(v) or str(v).strip() == "":
        return None
    try:
        x = float(str(v).replace(",", ""))
        return round(x, 8) if math.isfinite(x) else None
    except Exception:
        return None


def norm_date(v):
    if pd.isna(v) or str(v).strip() == "":
        return ""
    dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
    return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")


def canonicalise(df):
    aliases = {
        "record last updated": "Record Last Updated (dd/mm/yyyy)",
        "record last updated (dd/mm/yyyy)": "Record Last Updated (dd/mm/yyyy)",
        "planning permission granted": "Planning Permission Granted",
    }
    cols = []
    for c in df.columns:
        cc = collapse(c)
        cols.append(aliases.get(cc.lower(), cc))
    df = df.copy()
    df.columns = cols
    return df


def fetch_bytes(url):
    r = requests.get(url, headers={"User-Agent": "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"}, timeout=60)
    r.raise_for_status()
    return r.content


def read_csv(raw):
    for enc in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return canonicalise(pd.read_csv(io.BytesIO(raw), encoding=enc, on_bad_lines="skip", engine="python"))
        except UnicodeDecodeError:
            continue
    raise RuntimeError("Unable to decode official REPD CSV")


def read_excel(raw):
    book = pd.ExcelFile(io.BytesIO(raw), engine="openpyxl")
    for sheet in book.sheet_names:
        df = canonicalise(pd.read_excel(book, sheet_name=sheet))
        needed = {"Ref ID", "Site Name", "Technology Type"}
        if needed.issubset(set(df.columns)):
            return df, sheet
    raise RuntimeError(f"No REPD data sheet found in official XLSX; sheets={book.sheet_names}")


def indexed(df, label):
    if "Ref ID" not in df.columns:
        raise RuntimeError(f"{label} missing Ref ID")
    refs = [clean_ref(v) for v in df["Ref ID"].tolist()]
    missing = sum(not x for x in refs)
    dupes = len(refs) - len(set(refs))
    if missing or dupes:
        raise RuntimeError(f"{label} invalid Ref IDs: missing={missing} duplicates={dupes}")
    out = df.copy()
    out["__ref"] = refs
    return out.set_index("__ref", drop=False)


def count_thresholds(df):
    solar = 0
    bess = 0
    for _, row in df.iterrows():
        mw = norm_number(row.get("Installed Capacity (MWelec)"))
        if mw is None:
            continue
        tech = norm_text(row.get("Technology Type"))
        if "solar photovoltaic" in tech and mw > 1.0:
            solar += 1
        if "battery" in tech and mw > 100.0:
            bess += 1
    return solar, bess


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    csv_url = str(manifest.get("source_url") or "")
    xlsx_url = str(manifest.get("source_excel_url") or "")
    if "assets.publishing.service.gov.uk" not in csv_url or not csv_url.lower().endswith(".csv"):
        raise RuntimeError(f"Manifest CSV is not official DESNZ asset: {csv_url}")
    if "assets.publishing.service.gov.uk" not in xlsx_url or not xlsx_url.lower().endswith(".xlsx"):
        raise RuntimeError(f"Manifest XLSX is not official DESNZ asset: {xlsx_url}")

    csv_df = read_csv(fetch_bytes(csv_url))
    xlsx_df, xlsx_sheet = read_excel(fetch_bytes(xlsx_url))
    csv_ix = indexed(csv_df, "CSV")
    xlsx_ix = indexed(xlsx_df, "XLSX")

    errors = []
    checks = []

    def check(ok, gate, detail=""):
        checks.append({"gate": gate, "pass": bool(ok), "detail": detail})
        if not ok:
            errors.append(f"{gate}: {detail}" if detail else gate)

    csv_refs = set(csv_ix.index)
    xlsx_refs = set(xlsx_ix.index)
    check(len(csv_ix) == len(xlsx_ix), "CSV/XLSX row count equal", f"csv={len(csv_ix)} xlsx={len(xlsx_ix)}")
    check(csv_refs == xlsx_refs, "CSV/XLSX Ref ID sets equal", f"csv_only={len(csv_refs-xlsx_refs)} xlsx_only={len(xlsx_refs-csv_refs)}")

    mismatches = []
    for ref in sorted(csv_refs & xlsx_refs, key=lambda x: (int(x) if x.isdigit() else 10**18, x)):
        a = csv_ix.loc[ref]
        b = xlsx_ix.loc[ref]
        for field in CORE_FIELDS:
            if field not in csv_ix.columns or field not in xlsx_ix.columns:
                errors.append(f"core field missing from source reconciliation: {field}")
                continue
            if field == "Installed Capacity (MWelec)":
                av, bv = norm_number(a.get(field)), norm_number(b.get(field))
            elif field == "Record Last Updated (dd/mm/yyyy)":
                av, bv = norm_date(a.get(field)), norm_date(b.get(field))
            else:
                av, bv = norm_text(a.get(field)), norm_text(b.get(field))
            if av != bv:
                mismatches.append({"repd_ref": ref, "field": field, "csv": av, "xlsx": bv})
                if len(mismatches) >= 200:
                    break
        if len(mismatches) >= 200:
            break
    check(not mismatches, "CSV/XLSX core fields agree by Ref ID", f"mismatches={len(mismatches)}")

    csv_solar, csv_bess = count_thresholds(csv_df)
    xlsx_solar, xlsx_bess = count_thresholds(xlsx_df)
    check(csv_solar == xlsx_solar, "CSV/XLSX solar >1MW counts agree", f"csv={csv_solar} xlsx={xlsx_solar}")
    check(csv_bess == xlsx_bess, "CSV/XLSX BESS >100MW counts agree", f"csv={csv_bess} xlsx={xlsx_bess}")

    if "REPD_Publication_Q2_2026" in csv_url:
        check(len(csv_ix) == Q2_ROWS, "Q2 2026 raw row count exact", f"actual={len(csv_ix)} expected={Q2_ROWS}")
        check(csv_solar == Q2_SOLAR_GT1, "Q2 2026 raw solar >1MW exact", f"actual={csv_solar} expected={Q2_SOLAR_GT1}")
        check(csv_bess == Q2_BESS_GT100, "Q2 2026 raw BESS >100MW exact", f"actual={csv_bess} expected={Q2_BESS_GT100}")

    report = {
        "schema": "globalgrid2050.repd-source-reconciliation.v6",
        "pass": not errors,
        "csv_url": csv_url,
        "xlsx_url": xlsx_url,
        "xlsx_sheet": xlsx_sheet,
        "metrics": {
            "csv_rows": len(csv_ix),
            "xlsx_rows": len(xlsx_ix),
            "unique_refs": len(csv_refs),
            "solar_gt1_raw": csv_solar,
            "bess_gt100_raw": csv_bess,
            "core_mismatches": len(mismatches),
        },
        "checks": checks,
        "mismatch_examples": mismatches[:25],
        "errors": errors,
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if errors:
        print("REPD SOURCE RECONCILIATION FAILED")
        for error in errors[:100]:
            print(" -", error)
        raise SystemExit(1)
    print("REPD SOURCE RECONCILIATION PASS", json.dumps(report["metrics"], sort_keys=True))


if __name__ == "__main__":
    main()
