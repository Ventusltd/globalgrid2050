#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
from pathlib import Path

import pandas as pd

from repd_updater import REPDUpdater


class HardenedREPDUpdater(REPDUpdater):
    """V6 ingestion wrapper around the established REPD master transformation.

    It preserves V1-V5 serving behaviour but makes the DESNZ schema tolerant of
    harmless header whitespace/alias changes and records source-null provenance.
    """

    def already_current(self, url):
        if not super().already_current(url):
            return False
        manifest_path = Path(self.output_dir) / "manifest_v4.json"
        master_path = Path(self.output_dir) / "repd_master.json"
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            master = json.loads(master_path.read_text(encoding="utf-8"))
            hardened = (
                manifest.get("ingestion_profile") == "globalgrid2050.repd-v6-hardened"
                and master.get("ingestion_profile") == "globalgrid2050.repd-v6-hardened"
            )
            if not hardened:
                print("⚠️ REPD edition is current but hardened V6 provenance is absent; rebuilding master.")
            return hardened
        except Exception:
            return False

    def canonicalise_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        wanted = list(self.REQUIRED_COLUMNS) + list(self.OPTIONAL_COLUMNS)
        canonical = {re.sub(r"\s+", " ", c.strip()).lower(): c for c in wanted}
        canonical.update(
            {
                "record last updated": "Record Last Updated (dd/mm/yyyy)",
                "mounting type": "Mounting Type for Solar",
                "planning permission granted": "Planning Permission Granted",
            }
        )

        rename = {}
        target_to_sources = {}
        for source in df.columns:
            collapsed = re.sub(r"\s+", " ", str(source).strip())
            target = canonical.get(collapsed.lower(), collapsed)
            rename[source] = target
            target_to_sources.setdefault(target, []).append(source)

        collisions = {k: v for k, v in target_to_sources.items() if len(v) > 1}
        if collisions:
            raise RuntimeError(f"DESNZ header canonicalisation collision: {collisions}")

        out = df.rename(columns=rename)
        out.columns = [re.sub(r"\s+", " ", str(c).strip()) for c in out.columns]
        return out

    @staticmethod
    def raw_capacity_known(value) -> bool:
        if pd.isna(value):
            return False
        s = str(value).strip()
        if not s or s.lower() in {"nan", "none", "null", "not set"}:
            return False
        try:
            return math.isfinite(float(s.replace(",", "")))
        except Exception:
            return False

    def refine_dataset(self, csv_path):
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip", engine="python")
        except UnicodeDecodeError:
            df = pd.read_csv(csv_path, encoding="unicode_escape", on_bad_lines="skip", engine="python")

        df = self.canonicalise_columns(df)
        self.validate_schema(df)

        normalized = Path(self.raw_data_dir) / "latest_repd_v6_normalized.csv"
        df.to_csv(normalized, index=False, encoding="utf-8-sig")

        geojson = super().refine_dataset(str(normalized))

        by_ref = {}
        for source_row, row in df.iterrows():
            ref = self.clean_ref(row.get("Ref ID"))
            if not ref:
                continue
            by_ref[ref] = {
                "source_row": int(source_row) + 2,
                "capacity_raw": self.clean_text(row.get("Installed Capacity (MWelec)")),
                "capacity_known": self.raw_capacity_known(row.get("Installed Capacity (MWelec)")),
                "record_updated_raw": self.clean_text(row.get("Record Last Updated (dd/mm/yyyy)")),
            }

        missing_update = 0
        for feature in geojson.get("features", []):
            p = feature.setdefault("properties", {})
            ref = self.clean_ref(p.get("repd_ref"))
            raw = by_ref.get(ref, {})
            p["capacity_known"] = bool(raw.get("capacity_known"))
            p["capacity_source_raw"] = raw.get("capacity_raw") or None
            p["repd_record_updated_supplied"] = bool(p.get("repd_record_updated"))
            p["repd_source_row"] = raw.get("source_row")
            if not p["repd_record_updated_supplied"]:
                missing_update += 1

        geojson["ingestion_profile"] = "globalgrid2050.repd-v6-hardened"
        geojson["record_update_date_policy"] = "official value when supplied; blank remains blank and is never invented"
        geojson["header_policy"] = "trim + collapse internal whitespace + canonical aliases before schema validation"
        print(
            "REPD V6 hardened provenance:",
            f"features={len(geojson.get('features', []))}",
            f"missing_record_update={missing_update}",
        )
        return geojson

    def execute(self):
        super().execute()
        manifest_path = Path(self.output_dir) / "manifest_v4.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if int(manifest.get("schema_version") or 0) >= 6:
                manifest["ingestion_profile"] = "globalgrid2050.repd-v6-hardened"
                manifest["header_policy"] = "trim + collapse whitespace + canonical aliases"
                manifest["record_update_date_policy"] = "official when supplied; blank preserved, never inferred"
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    HardenedREPDUpdater().execute()
