import pandas as pd
import json
import yaml
import os
import requests
from datetime import datetime
from pyproj import Transformer

class REPDUpdater:
    """
    VENTUS REPD UPDATER v5.0 | MASTER UNIFIED GEOJSON
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
            
        # PROJ: British National Grid (27700) to standard GPS (4326)
        self.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    def fetch_data(self, url):
        print(f"📥 FETCHING SOURCE: {url}")
        try:
            # Using verify=False if GOV.UK SSL acts up in Actions, otherwise remove
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
        # REPD uses latin1 or unicode_escape for special characters
        df = pd.read_csv(csv_path, encoding='unicode_escape', low_memory=False)
        df.columns = [c.strip() for c in df.columns]

        # FILTER: Keep only viable projects to reduce payload size
        viability_mask = ['Operational', 'Under Construction', 'Awaiting Construction', 'Consented']
        df = df[df['Development Status (short)'].isin(viability_mask)]
        
        features = []
        for _, row in df.iterrows():
            try:
                # 1. PRE-CALCULATE COORDINATES (No more 'WAIT' in UI)
                e, n = float(row['X-coordinate']), float(row['Y-coordinate'])
                lon, lat = self.transformer.transform(e, n)

                # 2. STANDARDIZE PROPERTIES FOR UI FILTERING
                # We map everything to lowercase 'tech' for the dropdown
                tech_raw = str(row.get('Technology Type', '')).lower()
                
                # Simplified tech mapping to match your UI 'value' attributes
                tech_map = 'other'
                if 'solar' in tech_raw: tech_map = 'solar'
                elif 'wind' in tech_raw: tech_map = 'wind'
                elif 'battery' in tech_raw or 'storage' in tech_raw: tech_map = 'bess'

                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": row['Site Name'],
                        "operator": str(row.get('Operator (or Applicant)', 'Unknown')).upper(),
                        "capacity": float(row.get('Installed Capacity (MWelec)', 0)),
                        "status": row['Development Status (short)'],
                        "tech": tech_map, # Used by your dropdown
                        "raw_tech": row['Technology Type']
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(lon, 6), round(lat, 6)]
                    }
                })
            except (ValueError, TypeError):
                continue
        
        return {"type": "FeatureCollection", "features": features}

    def execute(self):
        # We target the specific REPD entry in your registry
        for layer in self.config['layers']:
            if layer['id'] == 'repd' or layer['type'] == 'csv':
                local_csv = self.fetch_data(layer['url'])
                if local_csv:
                    geojson = self.refine_dataset(local_csv)
                    
                    # SAVE MASTER FILE (Used by all REPD toggles in UI)
                    output = f"{self.output_dir}/repd_master.json"
                    with open(output, 'w') as f:
                        json.dump(geojson, f)
                    
                    print(f"✅ MASTER SYNC: {len(geojson['features'])} Assets optimized for GPU.")

        # Update HUD Manifest
        manifest = {
            "system": "VENTUS_CORE",
            "last_sync": datetime.now().isoformat(),
            "status": "OPERATIONAL"
        }
        with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
            json.dump(manifest, f, indent=2)

if __name__ == "__main__":
    REPDUpdater().execute()
