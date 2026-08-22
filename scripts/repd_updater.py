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
    VENTUS REPD UPDATER v5.11 | MASTER UNIFIED GEOJSON
    Uses the current GOV.UK quarterly REPD publication page.
    """

    REPD_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"

    UK_LON_MIN, UK_LON_MAX = -9.0, 2.5
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
        'Mounting Type for Solar',
        'County',
        'Region',
        'Local Planning Authority'
    ]

    def __init__(self, registry_path="config/registry.yaml"):
        print("📡 VENTUS REPD UPDATER v5.11 | BOOTING SYSTEM...")
        try:
            with open(registry_path, 'r') as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            print(f"❌ ERROR: {registry_path} not found.")
            exit(1)
        self.output_dir = "dist"
        self.raw_data_dir = "data"
        os.makedirs(self.output_dir, exist_ok=True)
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
            print(f"⚠️ Missing optional columns (degraded output): {missing_optional}")
        else:
            print("✅ Schema valid — all required and optional columns present")

    def discover_latest_url(self):
        print("🔍 Discovering latest REPD URL from Gov.uk quarterly extract...")
        try:
            r = requests.get(self.REPD_PAGE, timeout=30)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'html.parser')
            candidates = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                text = a.get_text(" ", strip=True).lower()
                if '.csv' in href.lower() and ('repd' in href.lower() or 'renewable energy planning database' in text):
                    url = href if href.startswith('http') else f"https://www.gov.uk{href}"
                    candidates.append(url)
            if candidates:
                url = candidates[0]
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
        t = tech_raw.strip()
        tl = t.lower()
        if 'solar photovoltaic' in tl or 'solar pv' in tl:
            return 'solar_roof' if mounting == 'roof' else 'solar'
        if 'wind onshore' in tl or 'wind offshore' in tl or tl == 'wind':
            return 'wind'
        if tl == 'hydrogen' or 'fuel cell (hydrogen)' in tl:
            return 'hydrogen'
        if 'large hydro' in tl or 'small hydro' in tl or 'pumped storage hydro' in tl:
            return 'hydro'
        if 'compressed air energy storage' in tl or 'liquid air energy storage' in tl:
            return 'caes'
        if tl == 'battery' or tl == 'battery storage':
            return 'bess'
        if any(x in tl for x in ['biomass','efw incineration','anaerobic digestion','landfill gas','sewage sludge','co-firing','energy from waste','incineration']):
            return 'biomass'
        if 'advanced conversion' in tl or 'gasification' in tl or 'pyrolysis' in tl:
            return 'act'
        if 'geothermal' in tl or 'hot dry rocks' in tl:
            return 'geothermal'
        if 'tidal' in tl or 'shoreline wave' in tl:
            return 'tidal'
        if 'flywheel' in tl:
            return 'flywheel'
        if 'storage' in tl or 'battery' in tl:
            return 'bess'
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
        df['Development Status (short)'] = df['Development Status (short)'].astype(str).str.strip().str.lower()
        df = df[df['Development Status (short)'].isin(self.VIABLE_STATUSES)]
        features = []
        skipped = 0
        for _, row in df.iterrows():
            try:
                e = float(row['X-coordinate']); n = float(row['Y-coordinate'])
                if not e or not n or e == 0 or n == 0:
                    skipped += 1; continue
                lon, lat = self.transformer.transform(e, n)
                if not (isfinite(lon) and isfinite(lat)):
                    skipped += 1; continue
                if not (self.UK_LON_MIN < lon < self.UK_LON_MAX and self.UK_LAT_MIN < lat < self.UK_LAT_MAX):
                    skipped += 1; continue
                tech_raw = str(row.get('Technology Type', '')).strip()
                mounting = str(row.get(mounting_col, '')).strip().lower() if mounting_col else ''
                tech_map = self.classify_tech(tech_raw, mounting)
                try:
                    capacity = float(row.get('Installed Capacity (MWelec)', 0))
                    if not isfinite(capacity): capacity = 0.0
                    if tech_map == 'solar_roof' and capacity > 50: capacity = round(capacity / 1000, 4)
                    if tech_map == 'biomass' and capacity > 100: capacity = round(capacity / 1000, 4)
                except (ValueError, TypeError):
                    capacity = 0.0
                features.append({
                    "type":"Feature",
                    "properties":{
                        "name":str(row.get('Site Name','Unknown')).strip(),
                        "county":str(row.get('County','')).strip(),
                        "region":str(row.get('Region','')).strip(),
                        "local_planning_authority":str(row.get('Local Planning Authority','')).strip(),
                        "operator":str(row.get('Operator (or Applicant)','Unknown')).strip().upper(),
                        "capacity":capacity,
                        "status":str(row.get('Development Status (short)','')).strip(),
                        "tech":tech_map,
                        "raw_tech":tech_raw,
                        "mounting":mounting
                    },
                    "geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]}
                })
            except (ValueError, TypeError):
                skipped += 1
        print(f"⚠️ Skipped: {skipped}")
        return {"type":"FeatureCollection","features":features}

    def execute(self):
        for layer in self.config['layers']:
            if layer['id'] == 'repd' or layer['type'] == 'csv':
                url = self.discover_latest_url() or layer['url']
                local_csv = self.fetch_data(url)
                if not local_csv:
                    return
                geojson = self.refine_dataset(local_csv)
                with open(f"{self.output_dir}/repd_master.json", 'w') as f:
                    json.dump(geojson, f)
                print(f"✅ MASTER SYNC: {len(geojson['features'])} assets.")
                manifest = {
                    "system":"VENTUS_CORE",
                    "last_sync":datetime.now().isoformat(),
                    "source_url":url,
                    "source_page":self.REPD_PAGE,
                    "status":"OPERATIONAL"
                }
                with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
                    json.dump(manifest, f, indent=2)

if __name__ == "__main__":
    REPDUpdater().execute()
