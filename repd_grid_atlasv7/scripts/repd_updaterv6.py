import pandas as pd
import json
import yaml
import os
import requests
from datetime import datetime
from math import isfinite
from pyproj import Transformer
from bs4 import BeautifulSoup

class REPDUpdater:
    """
    VENTUS REPD UPDATER v5.10 | MASTER UNIFIED GEOJSON
    Fixed: substring matching for all tech types — no encoding collisions.
    """

    REPD_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-monthly-extract"

    UK_LON_MIN, UK_LON_MAX = -9.0,  2.5
    UK_LAT_MIN, UK_LAT_MAX = 49.0, 61.0

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

    REQUIRED_COLUMNS = [
        'Site Name',
        'Technology Type',
        'Development Status (short)',
        'Installed Capacity (MWelec)',
        'X-coordinate',
        'Y-coordinate',
        'Operator (or Applicant)'
    ]

    OPTIONAL_COLUMNS = [
        'Mounting Type for Solar'
    ]

    def __init__(self, registry_path="config/registry.yaml"):
        print("📡 VENTUS REPD UPDATER v5.10 | BOOTING SYSTEM...")
        try:
            with open(registry_path, 'r') as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            print(f"❌ ERROR: {registry_path} not found.")
            exit(1)
        self.output_dir   = "dist"
        self.raw_data_dir = "data"
        os.makedirs(self.output_dir,   exist_ok=True)
        os.makedirs(self.raw_data_dir, exist_ok=True)
        self.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    def validate_schema(self, df):
        cols = set(df.columns)
        missing_required = [c for c in self.REQUIRED_COLUMNS if c not in cols]
        missing_optional = [c for c in self.OPTIONAL_COLUMNS if c not in cols]
        if missing_required:
            print(f"❌ SCHEMA ERROR — missing required columns: {missing_required}")
            print(f"   Available columns: {sorted(cols)}")
            exit(1)
        if missing_optional:
            print(f"⚠️  Missing optional columns (degraded output): {missing_optional}")
        else:
            print(f"✅ Schema valid — all required and optional columns present")

    def discover_latest_url(self):
        print("🔍 Discovering latest REPD URL from Gov.uk...")
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

    def already_current(self, url):
        manifest_path = f"{self.output_dir}/manifest_v4.json"
        if not os.path.exists(manifest_path):
            return False
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            if manifest.get('source_url') == url:
                print("✅ REPD unchanged since last sync — skipping pipeline.")
                return True
        except Exception:
            pass
        return False

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

    def classify_tech(self, tech_raw, mounting):
        """
        Substring matching throughout — immune to encoding artifacts.
        Hydrogen checked before hydro — no collision possible.
        """
        t  = tech_raw.strip()
        tl = t.lower()

        # --- Solar — mounting drives rooftop split ---
        if 'solar photovoltaic' in tl or 'solar pv' in tl:
            return 'solar_roof' if mounting == 'roof' else 'solar'

        # --- Wind ---
        if 'wind onshore' in tl or 'wind offshore' in tl or tl == 'wind':
            return 'wind'

        # --- Hydrogen — MUST be before hydro ---
        if tl == 'hydrogen' or 'fuel cell (hydrogen)' in tl:
            return 'hydrogen'

        # --- Hydro ---
        if 'large hydro' in tl or 'small hydro' in tl or 'pumped storage hydro' in tl:
            return 'hydro'

        # --- Compressed / Liquid Air Energy Storage ---
        if 'compressed air energy storage' in tl or 'liquid air energy storage' in tl:
            return 'caes'

        # --- Battery ---
        if tl == 'battery' or tl == 'battery storage':
            return 'bess'

        # --- Biomass family ---
        if any(x in tl for x in [
            'biomass', 'efw incineration', 'anaerobic digestion',
            'landfill gas', 'sewage sludge', 'co-firing',
            'energy from waste', 'incineration'
        ]):
            return 'biomass'

        # --- Advanced Conversion Technologies ---
        if 'advanced conversion' in tl or 'gasification' in tl or 'pyrolysis' in tl:
            return 'act'

        # --- Geothermal ---
        if 'geothermal' in tl or 'hot dry rocks' in tl:
            return 'geothermal'

        # --- Tidal / Wave ---
        if 'tidal' in tl or 'shoreline wave' in tl:
            return 'tidal'

        # --- Flywheel ---
        if 'flywheel' in tl:
            return 'flywheel'

        # --- Generic storage fallback ---
        if 'storage' in tl or 'battery' in tl:
            return 'bess'

        # --- Generic wind fallback ---
        if 'wind' in tl:
            return 'wind'

        return 'other'

    def refine_dataset(self, csv_path):
        print("🧪 REFINING MASTER DATASET...")
        df = pd.read_csv(csv_path, encoding='unicode_escape', on_bad_lines='skip', engine='python')
        df.columns = [c.strip() for c in df.columns]

        self.validate_schema(df)

        if 'Mounting Type for Solar' in df.columns:
            mounting_col = 'Mounting Type for Solar'
        elif 'Mounting Type' in df.columns:
            mounting_col = 'Mounting Type'
        else:
            mounting_col = None
            print("⚠️ No mounting type column found — all solar mapped to 'solar'")

        print(f"🔍 Mounting column: '{mounting_col}'")
        if mounting_col:
            print(f"🔍 Mounting values: {df[mounting_col].dropna().unique()}")
        print(f"🔍 Tech Types (all): {sorted(df['Technology Type'].dropna().unique())}")

        df['Development Status (short)'] = (
            df['Development Status (short)']
            .astype(str).str.strip().str.lower()
        )
        df = df[df['Development Status (short)'].isin(self.VIABLE_STATUSES)]
        print(f"🔍 Rows after status filter: {len(df)}")

        features = []
        skipped  = 0

        for _, row in df.iterrows():
            try:
                e = float(row['X-coordinate'])
                n = float(row['Y-coordinate'])
                if not e or not n or e == 0 or n == 0:
                    skipped += 1
                    continue

                lon, lat = self.transformer.transform(e, n)
                if not (isfinite(lon) and isfinite(lat)):
                    skipped += 1
                    continue

                if not (self.UK_LON_MIN < lon < self.UK_LON_MAX and
                        self.UK_LAT_MIN < lat < self.UK_LAT_MAX):
                    skipped += 1
                    continue

                tech_raw = str(row.get('Technology Type', '')).strip()
                mounting = ''
                if mounting_col:
                    mounting = str(row.get(mounting_col, '')).strip().lower()

                tech_map = self.classify_tech(tech_raw, mounting)

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
                        "mounting": mounting
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

        other_count = tech_counts.get('other', 0)
        if other_count > 0:
            other_techs = set(
                f['properties']['raw_tech'] for f in features
                if f['properties']['tech'] == 'other'
            )
            print(f"⚠️  {other_count} unmapped — raw tech values: {other_techs}")

        return {"type": "FeatureCollection", "features": features}

    def execute(self):
        for layer in self.config['layers']:
            if layer['id'] == 'repd' or layer['type'] == 'csv':

                url = self.discover_latest_url() or layer['url']

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
