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
    VENTUS REPD UPDATER v5.9 | MASTER UNIFIED GEOJSON
    Fixed: hydrogen classification. Added: geothermal, act, caes layers.
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

    BIOMASS_TERMS = [
        'biomass (dedicated)',
        'biomass (co-firing)',
        'energy from waste',
        'efw incineration',
        'anaerobic digestion',
        'landfill gas',
        'sewage sludge digestion',
        'co-firing'
    ]

    def __init__(self, registry_path="config/registry.yaml"):
        print("📡 VENTUS REPD UPDATER v5.9 | BOOTING SYSTEM...")
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
        Exact REPD Technology Type matching.
        Complete strings first — no substring collisions.
        """
        t = tech_raw.strip()
        tl = t.lower()

        # --- Solar — mounting drives rooftop split ---
        if t in ('Solar Photovoltaics',):
            return 'solar_roof' if mounting == 'roof' else 'solar'

        # --- Wind ---
        if t in ('Wind Onshore', 'Wind Offshore'):
            return 'wind'

        # --- Battery / BESS ---
        if t in ('Battery',):
            return 'bess'

        # --- Compressed / Liquid Air Energy Storage → bess family ---
        if t in ('Compressed Air Energy Storage', 'Liquid Air Energy Storage'):
            return 'caes'

        # --- Hydrogen — EXACT match, before any hydro check ---
        if t in ('Hydrogen', 'Fuel Cell (Hydrogen)'):
            return 'hydrogen'

        # --- Hydro — exact REPD terms ---
        if t in ('Large Hydro', 'Small Hydro', 'Pumped Storage Hydroelectricity'):
            return 'hydro'

        # --- Biomass family ---
        if t in (
            'Biomass (dedicated)', 'Biomass (co-firing)',
            'EfW Incineration', 'Anaerobic Digestion',
            'Landfill Gas', 'Sewage Sludge Digestion'
        ):
            return 'biomass'

        # --- Advanced Conversion Technologies ---
        if t in ('Advanced Conversion Technologies',):
            return 'act'

        # --- Geothermal ---
        if t in ('Geothermal', 'Hot Dry Rocks (HDR)'):
            return 'geothermal'

        # --- Tidal / Wave ---
        if t in ('Tidal Stream', 'Tidal Lagoon', 'Shoreline Wave'):
            return 'tidal'

        # --- Flywheel ---
        if t in ('Flywheels',):
            return 'flywheel'

        # --- Fallback substring safety net ---
        if 'solar' in tl or 'photovoltaic' in tl:
            return 'solar_roof' if mounting == 'roof' else 'solar'
        if 'wind' in tl:
            return 'wind'
        if 'hydrogen' in tl:
            return 'hydrogen'
        if tl.startswith('hydro'):
            return 'hydro'
        if 'battery' in tl or 'storage' in tl:
            return 'bess'
        if 'biomass' in tl or 'digestion' in tl or 'landfill' in tl:
            return 'biomass'
        if 'tidal' in tl or 'wave' in tl:
            return 'tidal'
        if 'flywheel' in tl:
            return 'flywheel'
        if 'geothermal' in tl or 'hot dry' in tl:
            return 'geothermal'
        if 'advanced conversion' in tl or 'gasification' in tl or 'pyrolysis' in tl:
            return 'act'

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
