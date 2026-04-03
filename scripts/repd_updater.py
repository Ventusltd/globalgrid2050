import pandas as pd
import json
import yaml
import os
import re
import requests
from datetime import datetime
from math import isfinite
from pyproj import Transformer
from bs4 import BeautifulSoup

class REPDUpdater:
    """
    VENTUS REPD UPDATER v5.6 | MASTER UNIFIED GEOJSON
    Hardened: dynamic URL fetching, UK bounds check, case-safe status
    filter, EfW/Hydro/AD classification, biomass unit sanity.
    """

    REPD_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-monthly-extract"

    # UK bounding box (WGS84)
    UK_LON_MIN, UK_LON_MAX = -9.0,  2.5
    UK_LAT_MIN, UK_LAT_MAX = 49.0, 61.0

    # Status tiers — all lower-cased for case-insensitive match
    VIABLE_STATUSES = {
        'operational',
        'under construction',
        'awaiting construction',
        'consented',
        'planning permission granted',
        'planning approved',
        'application submitted',
        'pre-construction'
    }

    def __init__(self, registry_path="config/registry.yaml"):
        print("📡 VENTUS REPD UPDATER v5.6 | BOOTING SYSTEM...")
        try:
            with open(registry_path, 'r') as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            print(f"❌ ERROR: {registry_path} not found.")
            exit(1)
        self.output_dir  = "dist"
        self.raw_data_dir = "data"
        os.makedirs(self.output_dir,   exist_ok=True)
        os.makedirs(self.raw_data_dir, exist_ok=True)
        self.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    # ------------------------------------------------------------------
    # Dynamic URL discovery — scrape Gov.uk for latest REPD CSV link
    # ------------------------------------------------------------------
    def discover_latest_url(self):
        print(f"🔍 Discovering latest REPD URL from Gov.uk...")
        try:
            r = requests.get(self.REPD_PAGE, timeout=30)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href']
                if href.endswith('.csv') and 'repd' in href.lower():
                    url = href if href.startswith('http') else f"https://www.gov.uk{href}"
                    print(f"✅ Latest REPD URL: {url}")
                    return url
            print("⚠️ Could not find CSV link — falling back to registry URL")
            return None
        except Exception as e:
            print(f"⚠️ Discovery failed: {e} — falling back to registry URL")
            return None

    # ------------------------------------------------------------------
    # Change detection — skip pipeline if URL unchanged since last sync
    # ------------------------------------------------------------------
    def already_current(self, url):
        manifest_path = f"{self.output_dir}/manifest_v4.json"
        if not os.path.exists(manifest_path):
            return False
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            if manifest.get('source_url') == url:
                print(f"✅ REPD unchanged since last sync — skipping pipeline.")
                return True
        except Exception:
            pass
        return False

    # ------------------------------------------------------------------
    # Fetch
    # ------------------------------------------------------------------
    def fetch_data(self, url):
        print(f"📥 FETCHING: {url}")
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            path = f"{self.raw_data_dir}/latest_repd.csv"
            with open(path, 'wb') as f:
                f.write(r.content)
            return path
        except Exception as e:
            print(f"⚠️ FETCH FAILED: {e}")
            return None

    # ------------------------------------------------------------------
    # Refine
    # ------------------------------------------------------------------
    def refine_dataset(self, csv_path):
        print("🧪 REFINING MASTER DATASET...")
        df = pd.read_csv(csv_path, encoding='unicode_escape', on_bad_lines='skip', engine='python')
        df.columns = [c.strip() for c in df.columns]

        # Case-safe status normalisation — strip whitespace, title-case
        df['Development Status (short)'] = (
            df['Development Status (short)']
            .astype(str).str.strip().str.lower()
        )
        df = df[df['Development Status (short)'].isin(self.VIABLE_STATUSES)]
        print(f"🔍 Rows after status filter: {len(df)}")

        if 'Mounting Type' in df.columns:
            print(f"🔍 Mounting Types: {df['Mounting Type'].dropna().unique()}")
        else:
            print("⚠️ No 'Mounting Type' column")
        print(f"🔍 Tech Types (sample): {df['Technology Type'].dropna().unique()[:20]}")

        features = []
        skipped  = 0

        for _, row in df.iterrows():
            try:
                # --- Coordinate sanity ---
                e = float(row['X-coordinate'])
                n = float(row['Y-coordinate'])
                if not e or not n or e == 0 or n == 0:
                    skipped += 1
                    continue

                lon, lat = self.transformer.transform(e, n)
                if not (isfinite(lon) and isfinite(lat)):
                    skipped += 1
                    continue

                # UK bounding box — catches Atlantic/Africa outliers
                if not (self.UK_LON_MIN < lon < self.UK_LON_MAX and
                        self.UK_LAT_MIN < lat < self.UK_LAT_MAX):
                    skipped += 1
                    continue

                # --- Technology classification ---
                tech_raw   = str(row.get('Technology Type', '')).strip()
                tech_lower = tech_raw.lower()
                mounting   = str(row.get('Mounting Type', '')).strip().lower()

                tech_map = 'other'

                if 'solar' in tech_lower or 'photovoltaic' in tech_lower:
                    tech_map = 'solar_roof' if mounting == 'roof' else 'solar'

                elif 'wind' in tech_lower:
                    tech_map = 'wind'

                elif 'battery' in tech_lower or 'storage' in tech_lower:
                    tech_map = 'bess'

                elif any(x in tech_lower for x in [
                    'biomass', 'energy from waste', 'efw', 'incineration',
                    'anaerobic', 'landfill gas', 'sewage sludge',
                    'co-firing', 'advanced conversion', 'gasification',
                    'pyrolysis'
                ]):
                    tech_map = 'biomass'

                elif 'hydro' in tech_lower:
                    tech_map = 'hydro'

                elif 'tidal' in tech_lower or 'wave' in tech_lower:
                    tech_map = 'tidal'

                elif 'hydrogen' in tech_lower:
                    tech_map = 'hydrogen'

                elif 'flywheel' in tech_lower:
                    tech_map = 'flywheel'

                # --- Capacity with unit sanity ---
                try:
                    capacity = float(row.get('Installed Capacity (MWelec)', 0))
                    if not isfinite(capacity):
                        capacity = 0.0
                    if tech_map == 'solar_roof' and capacity > 50:
                        capacity = round(capacity / 1000, 4)
                    if tech_map == 'biomass' and capacity > 100:
                        capacity = round(capacity / 1000, 4)
                except (ValueError, TypeError):
                    capacity = 0.0

                features.append({
                    "type": "Feature",
                    "properties": {
                        "name":     str(row.get('Site Name', 'Unknown')),
                        "operator": str(row.get('Operator (or Applicant)', 'Unknown')).upper(),
                        "capacity": capacity,
                        "status":   str(row.get('Development Status (short)', '')).strip(),
                        "tech":     tech_map,
                        "raw_tech": tech_raw,
                        "mounting": str(row.get('Mounting Type', ''))
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(lon, 6), round(lat, 6)]
                    }
                })

            except (ValueError, TypeError):
                skipped += 1
                continue

        print(f"⚠️  Skipped: {skipped}")
        tech_counts = {}
        for f in features:
            t = f['properties']['tech']
            tech_counts[t] = tech_counts.get(t, 0) + 1
        print(f"📊 Tech distribution: {tech_counts}")
        return {"type": "FeatureCollection", "features": features}

    # ------------------------------------------------------------------
    # Execute
    # ------------------------------------------------------------------
    def execute(self):
        for layer in self.config['layers']:
            if layer['id'] == 'repd' or layer['type'] == 'csv':

                # Try dynamic discovery first, fall back to registry URL
                url = self.discover_latest_url() or layer['url']

                # Skip if unchanged
                if self.already_current(url):
                    return

                local_csv = self.fetch_data(url)
                if not local_csv:
                    return

                geojson = self.refine_dataset(local_csv)
                output = f"{self.output_dir}/repd_master.json"
                with open(output, 'w') as f:
                    json.dump(geojson, f)
                print(f"✅ MASTER SYNC: {len(geojson['features'])} assets.")

                # Write manifest with source URL for change detection
                manifest = {
                    "system":     "VENTUS_CORE",
                    "last_sync":  datetime.now().isoformat(),
                    "source_url": url,
                    "status":     "OPERATIONAL"
                }
                with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
                    json.dump(manifest, f, indent=2)

if __name__ == "__main__":
    REPDUpdater().execute()
