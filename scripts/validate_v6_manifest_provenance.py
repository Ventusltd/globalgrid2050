#!/usr/bin/env python3
"""Validate that V6 is bound to the reconciled, immutable Q2 2026 release."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from repd_sources_v6 import (
    CSV_URL,
    EXPECTED_BESS_GT100,
    EXPECTED_CSV_SHA256,
    EXPECTED_ROWS,
    EXPECTED_SOLAR_GT1,
    EXPECTED_XLSX_SHA256,
    MANIFEST,
    PUBLICATION_DATE,
    REPORT,
    SOURCE_PAGE,
    XLSX_URL,
)

errors = []


def need(condition, message):
    if not condition:
        errors.append(message)


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Cannot read {path}: {exc}") from exc


manifest = load(MANIFEST)
source = load(REPORT)
metrics = source.get("metrics") or {}
hashes = source.get("source_hashes") or {}

need(manifest.get("schema") == "globalgrid2050.repd-manifest.v6", "V6 manifest schema mismatch")
need(manifest.get("status") == "VALIDATED", "V6 manifest is not validated")
need(source.get("pass") is True, "CSV/XLSX reconciliation did not pass")
need(manifest.get("source_owner") == "Department for Energy Security and Net Zero (DESNZ)", "DESNZ owner missing")
need(manifest.get("source_page") == SOURCE_PAGE, "official publication page mismatch")
need(manifest.get("source_page_last_updated") == PUBLICATION_DATE, "Q2 publication date mismatch")
need(manifest.get("source_url") == CSV_URL == source.get("csv_url"), "official CSV URL mismatch")
need(manifest.get("source_excel_url") == XLSX_URL == source.get("xlsx_url"), "official XLSX URL mismatch")
need(urlparse(CSV_URL).netloc == "assets.publishing.service.gov.uk", "official CSV host mismatch")
need(urlparse(XLSX_URL).netloc == "assets.publishing.service.gov.uk", "official XLSX host mismatch")
need(hashes.get("csv_sha256") == EXPECTED_CSV_SHA256, "official CSV hash mismatch")
need(hashes.get("xlsx_sha256") == EXPECTED_XLSX_SHA256, "official XLSX hash mismatch")
need(manifest.get("source_hashes") == hashes, "manifest/source-report hashes differ")
need(metrics.get("csv_rows") == EXPECTED_ROWS, "CSV row count mismatch")
need(metrics.get("xlsx_rows") == EXPECTED_ROWS, "XLSX row count mismatch")
need(metrics.get("csv_unique_refs") == EXPECTED_ROWS, "CSV unique Ref count mismatch")
need(metrics.get("xlsx_unique_refs") == EXPECTED_ROWS, "XLSX unique Ref count mismatch")
need(metrics.get("material_mismatches") == 0, "material CSV/XLSX mismatch present")
need(metrics.get("canonical_solar_gt1") == EXPECTED_SOLAR_GT1, "canonical solar count mismatch")
need(metrics.get("canonical_bess_gt100") == EXPECTED_BESS_GT100, "canonical BESS count mismatch")
need(metrics.get("canonical_combined_projects") == EXPECTED_SOLAR_GT1 + EXPECTED_BESS_GT100, "combined V6 count mismatch")

if errors:
    print("V6 MANIFEST PROVENANCE FAILED")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)

print(
    "V6 MANIFEST PROVENANCE PASS",
    f"source_rows={EXPECTED_ROWS}",
    f"solar={EXPECTED_SOLAR_GT1}",
    f"bess={EXPECTED_BESS_GT100}",
)
