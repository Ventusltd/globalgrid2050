import pandas as pd
import json
import yaml
import os
import requests
from datetime import datetime
from math import isfinite
from pyproj import Transformer

class REPDUpdater:
    """
    VENTUS REPD UPDATER v5.5 | MASTER UNIFIED GEOJSON
    Hardened: Mounting Type classification, unit normalisation,
    status tiering, biomass family grouping, coordinate sanity.
    """
    def __init__(self, registry_path="config/registry.yaml"):
        print(f"📡 VENTUS REPD UPDATER | BOOTING SYSTEM...")
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

    # ------------------------------------------------------------------
    # Status tiering — normalise REPD's inconsistent status strings
    # ------------------------------------------------------------------
    TIER1 = {'operational', 'under construction', 'awaiting construction'}
    TIER2 = {'consented', 'planning permission granted', 'planning approved'}
    TIER3 = {'application submitted', 'pre-construction'}

    @staticmethod
    def normalise_status(raw):
        s = str(raw).strip().lower()
        if s in REPDUpdater.TIER1: return raw.strip()
        if s in REPDUpdater.TIER2: return raw.strip()
        if s in REPDUpdater.TIER3: return raw.strip()
        return None  # drop everything else

    def fetch_data(self, url):
        print(f"📥 FETCHING SOURCE: {url}")
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            path = f"{self.raw_data_dir}/latest_repd.csv"
            with open(path, 'wb') as f:
                f.write(response.content)
            return path
        except Exception as e:
            print(f"⚠️ FETCH FAILED: {e}")
            return None

    def refine_dataset(self, csv_path):
        print("🧪 REFINING MASTER DATASET...")
        df = pd.read_csv(csv_path, encoding='unicode_escape', on_bad_lines='skip', engine='python')
        df.columns = [c.strip() for c in df.columns]

        # Tier 1 + 2 + 3 — all viable statuses
        viable = (
            self.TIER1 |
            self.TIER2 |
            self.TIER3
        )
        # Match against the short status column case-insensitively
        df = df[df['Development Status (short)'].str.strip().str.lower().isin(viable)]

        # Debug
        print(f"🔍 Rows after status filter: {len(df)}")
        if 'Mounting Type' in df.columns:
            print(f"🔍 Mounting Types: {df['Mounting Type'].dropna().unique()}")
        else:
            print("⚠️ No 'Mounting Type' column — rooftop split unavailable")
        print(f"🔍 Tech Types (sample): {df['Technology Type'].dropna().unique()[:20]}")

        features = []
        skipped = 0

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

                # --- Technology classification ---
                tech_raw   = str(row.get('Technology Type', '')).strip()
                tech_lower = tech_raw.lower()
                mounting   = str(row.get('Mounting Type', '')).strip().lower()

                tech_map = 'other'

                if 'solar' in tech_lower or 'photovoltaic' in tech_lower:
                    # Mounting Type drives the split — NOT Technology Type
                    # "Ground & Roof" → utility scale → solar
                    # "Roof" only → solar_roof
                    if mounting == 'roof':
                        tech_map = 'solar_roof'
                    else:
                        tech_map = 'solar'

                elif 'wind' in tech_lower:
                    tech_map = 'wind'

                elif 'battery' in tech_lower or 'storage' in tech_lower:
                    tech_map = 'bess'

                elif any(x in tech_lower for x in [
                    'biomass', 'energy from waste', 'efw',
                    'anaerobic', 'landfill gas',
                    'sewage sludge', 'co-firing', 'incineration'
                ]):
                    tech_map = 'biomass'

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
                    # Physics sanity — rooftop >50 and biomass >100
                    # are almost certainly kW mislabelled as MW
                    if tech_map == 'solar_roof' and capacity > 50:
                        capacity = round(capacity / 1000, 4)
                    if tech_map == 'biomass' and capacity > 100:
                        capacity = round(capacity / 1000, 4)
                except (ValueError, TypeError):
                    capacity = 0.0

                # --- Status normalisation ---
                status = str(row.get('Development Status (short)', '')).strip()

                features.append({
                    "type": "Feature",
                    "properties": {
                        "name":     str(row.get('Site Name', 'Unknown')),
                        "operator": str(row.get('Operator (or Applicant)', 'Unknown')).upper(),
                        "capacity": capacity,
                        "status":   status,
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

        # --- Distribution report ---
        print(f"⚠️  Skipped: {skipped}")
        tech_counts = {}
        for f in features:
            t = f['properties']['tech']
            tech_counts[t] = tech_counts.get(t, 0) + 1
        print(f"📊 Tech distribution: {tech_counts}")
        return {"type": "FeatureCollection", "features": features}

    def execute(self):
        for layer in self.config['layers']:
            if layer['id'] == 'repd' or layer['type'] == 'csv':
                local_csv = self.fetch_data(layer['url'])
                if local_csv:
                    geojson = self.refine_dataset(local_csv)
                    output = f"{self.output_dir}/repd_master.json"
                    with open(output, 'w') as f:
                        json.dump(geojson, f)
                    print(f"✅ MASTER SYNC: {len(geojson['features'])} Assets optimized for GPU.")

        manifest = {
            "system": "VENTUS_CORE",
            "last_sync": datetime.now().isoformat(),
            "status": "OPERATIONAL"
        }
        with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
            json.dump(manifest, f, indent=2)

if __name__ == "__main__":
    REPDUpdater().execute()
