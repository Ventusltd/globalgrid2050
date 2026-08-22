import pandas as pd
import json
import yaml
import os
import re
import requests
from datetime import datetime, timezone
from math import isfinite
from pathlib import Path
from pyproj import Transformer
from bs4 import BeautifulSoup


class REPDUpdater:
    """
    VENTUS REPD UPDATER v6.0 | OFFICIAL REPD-BOUND MASTER GEOJSON

    The serving spine remains dist/repd_master.json, but every retained project is
    now carried with its official DESNZ REPD Ref ID and Record Last Updated date.
    Existing V1-V5 consumers ignore the extra properties and remain compatible.
    """

    REPD_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
    CURRENT_Q2_2026_CSV = "https://assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv"
    CURRENT_Q2_2026_XLSX = "https://assets.publishing.service.gov.uk/media/6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx"

    UK_LON_MIN, UK_LON_MAX = -9.0, 2.5
    UK_LAT_MIN, UK_LAT_MAX = 49.0, 61.0

    VIABLE_STATUSES = {
        "operational",
        "under construction",
        "awaiting construction",
        "consented",
        "planning permission granted",
        "planning approved",
        "application submitted",
        "pre-construction",
    }

    REQUIRED_COLUMNS = [
        "Ref ID",
        "Record Last Updated (dd/mm/yyyy)",
        "Site Name",
        "Technology Type",
        "Development Status (short)",
        "Installed Capacity (MWelec)",
        "X-coordinate",
        "Y-coordinate",
        "Operator (or Applicant)",
    ]

    OPTIONAL_COLUMNS = [
        "Old Ref ID",
        "Mounting Type for Solar",
        "County",
        "Region",
        "Planning Authority",
        "Local Planning Authority",
        "Planning Application Reference",
        "Planning Permission Granted",
        "Under Construction",
        "Operational",
    ]

    def __init__(self, registry_path="config/registry.yaml"):
        print("📡 VENTUS REPD UPDATER v6.0 | OFFICIAL REPD BINDING...")
        try:
            with open(registry_path, "r", encoding="utf-8") as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            raise SystemExit(f"❌ ERROR: {registry_path} not found.")
        self.output_dir = "dist"
        self.raw_data_dir = "data"
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.raw_data_dir, exist_ok=True)
        self.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    @staticmethod
    def clean_text(value):
        if pd.isna(value):
            return ""
        s = str(value).strip()
        return "" if s.lower() in {"nan", "none", "not set", "null"} else s

    @staticmethod
    def clean_ref(value):
        if pd.isna(value):
            return ""
        s = str(value).strip()
        if re.fullmatch(r"\d+\.0", s):
            s = s[:-2]
        return "" if s.lower() in {"nan", "none", "not set", "null"} else s

    @staticmethod
    def iso_date(value):
        if pd.isna(value):
            return ""
        dt = pd.to_datetime(value, dayfirst=True, errors="coerce")
        return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")

    def validate_schema(self, df):
        cols = set(df.columns)
        missing_required = [c for c in self.REQUIRED_COLUMNS if c not in cols]
        missing_optional = [c for c in self.OPTIONAL_COLUMNS if c not in cols]
        if missing_required:
            print(f"❌ SCHEMA ERROR — missing required columns: {missing_required}")
            print(f"   Available columns: {sorted(cols)}")
            raise SystemExit(1)
        if missing_optional:
            print(f"⚠️ Missing optional columns (degraded enrichment only): {missing_optional}")
        else:
            print("✅ DESNZ schema valid — official Ref ID and update-date columns present")

    def discover_latest_sources(self):
        print("🔍 Discovering current DESNZ REPD publication from GOV.UK...")
        result = {
            "csv_url": "",
            "excel_url": "",
            "dataset_title": "",
            "page_last_updated": "",
        }
        try:
            r = requests.get(self.REPD_PAGE, timeout=20)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            page_text = " ".join(soup.stripped_strings)
            m = re.search(r"Last updated:?\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})", page_text, re.I)
            if m:
                dt = pd.to_datetime(m.group(1), dayfirst=True, errors="coerce")
                if not pd.isna(dt):
                    result["page_last_updated"] = dt.strftime("%Y-%m-%d")

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                text = a.get_text(" ", strip=True)
                low = (href + " " + text).lower()
                url = href if href.startswith("http") else f"https://www.gov.uk{href}"
                if ".csv" in low and "repd" in low and not result["csv_url"]:
                    result["csv_url"] = url
                    result["dataset_title"] = text
                if (".xlsx" in low or ".xls" in low) and "repd" in low and not result["excel_url"]:
                    result["excel_url"] = url

            if result["csv_url"]:
                print(f"✅ Official REPD CSV: {result['csv_url']}")
                if result["excel_url"]:
                    print(f"✅ Official REPD Excel: {result['excel_url']}")
                return result
        except Exception as e:
            print(f"⚠️ GOV.UK discovery failed: {e}")

        print("⚠️ Falling back to the known DESNZ July 2026 Q2 publication URLs")
        result.update(
            {
                "csv_url": self.CURRENT_Q2_2026_CSV,
                "excel_url": self.CURRENT_Q2_2026_XLSX,
                "dataset_title": "Renewable Energy Planning Database (REPD): July 2026 (CSV)",
                "page_last_updated": "2026-08-03",
            }
        )
        return result

    def already_current(self, url):
        manifest_path = Path(self.output_dir) / "manifest_v4.json"
        master_path = Path(self.output_dir) / "repd_master.json"
        if not manifest_path.exists() or not master_path.exists():
            return False
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if manifest.get("source_url") != url or int(manifest.get("schema_version") or 0) < 6:
                return False
            master = json.loads(master_path.read_text(encoding="utf-8"))
            features = master.get("features") or []
            if not features:
                return False
            props = features[0].get("properties") or {}
            if not props.get("repd_ref") or "repd_record_updated" not in props:
                return False
            print("✅ REPD source unchanged and V6 official-reference schema already present.")
            return True
        except Exception:
            return False

    def fetch_data(self, url):
        print(f"📥 FETCHING OFFICIAL CSV: {url}")
        try:
            r = requests.get(url, timeout=45)
            r.raise_for_status()
            path = Path(self.raw_data_dir) / "latest_repd.csv"
            path.write_bytes(r.content)
            return str(path)
        except Exception as e:
            print(f"❌ REPD FETCH FAILED: {e}")
            return None

    def classify_tech(self, tech_raw, mounting):
        tl = tech_raw.strip().lower()
        if "solar photovoltaic" in tl or "solar pv" in tl:
            return "solar_roof" if mounting == "roof" else "solar"
        if "wind onshore" in tl or "wind offshore" in tl or tl == "wind":
            return "wind"
        if tl == "hydrogen" or "fuel cell (hydrogen)" in tl:
            return "hydrogen"
        if "large hydro" in tl or "small hydro" in tl or "pumped storage hydro" in tl:
            return "hydro"
        if "compressed air energy storage" in tl or "liquid air energy storage" in tl:
            return "caes"
        if tl in {"battery", "battery storage"}:
            return "bess"
        if any(x in tl for x in ["biomass", "efw incineration", "anaerobic digestion", "landfill gas", "sewage sludge", "co-firing", "energy from waste", "incineration"]):
            return "biomass"
        if "advanced conversion" in tl or "gasification" in tl or "pyrolysis" in tl:
            return "act"
        if "geothermal" in tl or "hot dry rocks" in tl:
            return "geothermal"
        if "tidal" in tl or "shoreline wave" in tl:
            return "tidal"
        if "flywheel" in tl:
            return "flywheel"
        if "storage" in tl or "battery" in tl:
            return "bess"
        if "wind" in tl:
            return "wind"
        return "other"

    def refine_dataset(self, csv_path):
        print("🧪 REFINING OFFICIAL REPD MASTER DATASET...")
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig", on_bad_lines="skip", engine="python")
        except UnicodeDecodeError:
            df = pd.read_csv(csv_path, encoding="unicode_escape", on_bad_lines="skip", engine="python")
        df.columns = [c.strip() for c in df.columns]
        self.validate_schema(df)

        mounting_col = "Mounting Type for Solar" if "Mounting Type for Solar" in df.columns else "Mounting Type" if "Mounting Type" in df.columns else None
        if not mounting_col:
            print("⚠️ No mounting type column found — all solar mapped to 'solar'")

        df["Development Status (short)"] = df["Development Status (short)"].astype(str).str.strip().str.lower()
        df = df[df["Development Status (short)"].isin(self.VIABLE_STATUSES)]

        features = []
        skipped = 0
        missing_refs = 0
        seen_refs = set()
        for _, row in df.iterrows():
            try:
                repd_ref = self.clean_ref(row.get("Ref ID"))
                if not repd_ref:
                    missing_refs += 1
                    skipped += 1
                    continue
                if repd_ref in seen_refs:
                    raise ValueError(f"duplicate official REPD Ref ID in viable dataset: {repd_ref}")
                seen_refs.add(repd_ref)

                e = float(row["X-coordinate"])
                n = float(row["Y-coordinate"])
                if not e or not n or e == 0 or n == 0:
                    skipped += 1
                    continue
                lon, lat = self.transformer.transform(e, n)
                if not (isfinite(lon) and isfinite(lat)):
                    skipped += 1
                    continue
                if not (self.UK_LON_MIN < lon < self.UK_LON_MAX and self.UK_LAT_MIN < lat < self.UK_LAT_MAX):
                    skipped += 1
                    continue

                tech_raw = self.clean_text(row.get("Technology Type"))
                mounting = self.clean_text(row.get(mounting_col)).lower() if mounting_col else ""
                tech_map = self.classify_tech(tech_raw, mounting)
                try:
                    capacity = float(row.get("Installed Capacity (MWelec)", 0))
                    if not isfinite(capacity):
                        capacity = 0.0
                    if tech_map == "solar_roof" and capacity > 50:
                        capacity = round(capacity / 1000, 4)
                    if tech_map == "biomass" and capacity > 100:
                        capacity = round(capacity / 1000, 4)
                except (ValueError, TypeError):
                    capacity = 0.0

                planning_authority = self.clean_text(row.get("Planning Authority")) or self.clean_text(row.get("Local Planning Authority"))
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "repd_ref": repd_ref,
                            "repd_old_ref": self.clean_ref(row.get("Old Ref ID")),
                            "repd_record_updated": self.iso_date(row.get("Record Last Updated (dd/mm/yyyy)")),
                            "name": self.clean_text(row.get("Site Name")) or "Unknown",
                            "county": self.clean_text(row.get("County")),
                            "region": self.clean_text(row.get("Region")),
                            "local_planning_authority": planning_authority,
                            "planning_authority": planning_authority,
                            "planning_application_reference": self.clean_text(row.get("Planning Application Reference")),
                            "planning_permission_granted": self.iso_date(row.get("Planning Permission Granted")),
                            "under_construction_date": self.iso_date(row.get("Under Construction")),
                            "operational_date": self.iso_date(row.get("Operational")),
                            "operator": (self.clean_text(row.get("Operator (or Applicant)")) or "Unknown").upper(),
                            "capacity": capacity,
                            "status": self.clean_text(row.get("Development Status (short)")),
                            "tech": tech_map,
                            "raw_tech": tech_raw,
                            "mounting": mounting,
                        },
                        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                    }
                )
            except (ValueError, TypeError) as e:
                skipped += 1
                if "duplicate official REPD Ref ID" in str(e):
                    raise

        if missing_refs:
            raise RuntimeError(f"Official REPD binding failed: {missing_refs} viable rows lacked Ref ID")
        print(f"✅ REPD V6 binding: {len(features)} viable geocoded assets; skipped {skipped} unusable-coordinate rows")
        return {"type": "FeatureCollection", "schema": "globalgrid2050.repd-master.v6", "features": features}

    def execute(self):
        sources = self.discover_latest_sources()
        for layer in self.config["layers"]:
            if layer["id"] == "repd" or layer["type"] == "csv":
                url = sources.get("csv_url") or layer.get("url") or self.CURRENT_Q2_2026_CSV
                if self.already_current(url):
                    return
                local_csv = self.fetch_data(url)
                if not local_csv:
                    raise SystemExit(1)
                geojson = self.refine_dataset(local_csv)
                Path(self.output_dir, "repd_master.json").write_text(json.dumps(geojson, separators=(",", ":")), encoding="utf-8")
                print(f"✅ MASTER SYNC: {len(geojson['features'])} assets.")
                manifest = {
                    "system": "VENTUS_CORE",
                    "schema_version": 6,
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "source_owner": "Department for Energy Security and Net Zero (DESNZ)",
                    "source_url": url,
                    "source_excel_url": sources.get("excel_url") or self.CURRENT_Q2_2026_XLSX,
                    "source_page": self.REPD_PAGE,
                    "source_dataset_title": sources.get("dataset_title") or "Renewable Energy Planning Database",
                    "source_page_last_updated": sources.get("page_last_updated"),
                    "source_file": url.rsplit("/", 1)[-1],
                    "official_ref_field": "Ref ID",
                    "official_record_update_field": "Record Last Updated (dd/mm/yyyy)",
                    "status": "OPERATIONAL",
                }
                Path(self.output_dir, "manifest_v4.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                return


if __name__ == "__main__":
    REPDUpdater().execute()
