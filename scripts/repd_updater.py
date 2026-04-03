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
    VENTUS REPD UPDATER v5.4 | MASTER UNIFIED GEOJSON
    Optimized for GPU-Accelerated UI filtering.
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
        viability_mask = ['Operational', 'Under Construction', 'Awaiting Construction', 'Consented']
        df = df[df['Development Status (short)'].isin(viability_mask)]

        # Debug: print unique Technology Type and Mounting Type values
        print("🔍 Technology Types:", df['Technology Type'].dropna().unique()[:20])
        if 'Mounting Type' in df.columns:
            print("🔍 Mounting Types:", df['Mounting Type'].dropna().unique())
        else:
            print("⚠️ No 'Mounting Type' column found")

        features = []
        skipped = 0
        for _, row in df.iterrows():
            try:
                e, n = float(row['X-coordinate']), float(row['Y-coordinate'])
                lon, lat = self.transformer.transform(e, n)
                if not (isfinite(lon) and isfinite(lat)):
                    skipped += 1
                    continue

                tech_raw = str(row.get('Technology Type', '')).strip()
                tech_raw_lower = tech_raw.lower()
                mounting = str(row.get('Mounting Type', '')).strip().lower()

                tech_map = 'other'

                if 'solar' in tech_raw_lower or 'photovoltaic' in tech_raw_lower:
                    # Use Mounting Type to split rooftop vs ground
                    if 'roof' in mounting:
                        tech_map = 'solar_roof'
                    else:
                        tech_map = 'solar'
                elif 'wind' in tech_raw_lower:
                    tech_map = 'wind'
                elif 'battery' in tech_raw_lower or 'storage' in tech_raw_lower:
                    tech_map = 'bess'
                elif 'biomass' in tech_raw_lower or 'energy from waste' in tech_raw_lower:
                    tech_map = 'biomass'
                elif 'tidal' in tech_raw_lower or 'wave' in tech_raw_lower:
                    tech_map = 'tidal'
                elif 'hydrogen' in tech_raw_lower:
                    tech_map = 'hydrogen'
                elif 'flywheel' in tech_raw_lower:
                    tech_map = 'flywheel'

                try:
                    capacity = float(row.get('Installed Capacity (MWelec)', 0))
                    if not isfinite(capacity):
                        capacity = 0.0
                    # Unit fix: rooftop entries >100 are almost certainly kW not MW
                    if tech_map == 'solar_roof' and capacity > 100:
                        capacity = round(capacity / 1000, 4)
                except (ValueError, TypeError):
                    capacity = 0.0

                features.append({
                    "type": "Feature",
                    "properties": {
                        "name":     str(row.get('Site Name', 'Unknown')),
                        "operator": str(row.get('Operator (or Applicant)', 'Unknown')).upper(),
                        "capacity": capacity,
                        "status":   row['Development Status (short)'],
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

        print(f"⚠️ Skipped {skipped} features with invalid data.")
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
