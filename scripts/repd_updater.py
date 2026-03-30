import pandas as pd
import json
import yaml
import os
import requests
from datetime import datetime
from pyproj import Transformer

class REPDUpdater:
    """
    VENTUS REPD UPDATER v4.2
    Automating 14 years of research for the 2050 Horizon.
    """
    def __init__(self, registry_path="config/registry.yaml"):
        print(f"📡 VENTUS REPD UPDATER | BOOTING SYSTEM...")
        
        # Load the Registry
        try:
            with open(registry_path, 'r') as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            print(f"❌ ERROR: {registry_path} not found. Ensure file exists.")
            exit(1)
            
        self.output_dir = "dist"
        self.raw_data_dir = "data"
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.raw_data_dir, exist_ok=True)
            
        # PROJ Transformation: British National Grid (27700) to WGS84 (4326)
        # Critical for map accuracy during high-voltage route planning
        self.transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    def fetch_data(self, url):
        print(f"📥 FETCHING SOURCE: {url}")
        try:
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            path = f"{self.raw_data_dir}/latest_repd.csv"
            with open(path, 'wb') as f:
                f.write(response.content)
            return path
        except Exception as e:
            print(f"⚠️ FETCH FAILED: {e}")
            return None

    def refine_dataset(self, csv_path):
        print("🧪 REFINING INDUSTRIAL DATA...")
        # Gov CSVs often have 'unicode_escape' or 'latin1' encoding
        df = pd.read_csv(csv_path, encoding='unicode_escape')
        df.columns = [c.strip() for c in df.columns]

        # INDUSTRIAL FILTER: Focus strictly on high-impact Net Zero infrastructure
        viability_mask = ['Operational', 'Under Construction', 'Awaiting Construction', 'Consented']
        df = df[df['Development Status (short)'].isin(viability_mask)]
        
        features = []
        for _, row in df.iterrows():
            try:
                # Spatial Translation
                e, n = float(row['X-coordinate']), float(row['Y-coordinate'])
                lon, lat = self.transformer.transform(e, n)

                # Clean Meta-Data for HUD
                operator = str(row.get('Operator (or Applicant)', 'Unknown')).split(' ')[0].upper()
                
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": row['Site Name'],
                        "operator": operator,
                        "mw": float(row.get('Installed Capacity (MWelec)', 0)),
                        "status": row['Development Status (short)'],
                        "tech": row['Technology Type'],
                        "id": row.get('Ref ID', 'N/A')
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
        for layer in self.config['layers']:
            if layer['type'] == 'csv':
                local_csv = self.fetch_data(layer['url'])
                if local_csv:
                    geojson = self.refine_dataset(local_csv)
                    output = f"{self.output_dir}/{layer['id']}.json"
                    with open(output, 'w') as f:
                        json.dump(geojson, f)
                    print(f"✅ SYNCED: {layer['id']} | {len(geojson['features'])} Assets")

        # Update HUD Manifest
        manifest = {
            "system": "VENTUS_QUANTUM",
            "last_sync": datetime.now().isoformat(),
            "status": "OPERATIONAL"
        }
        with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
            json.dump(manifest, f, indent=2)
        print("🏁 SYSTEM SYNC COMPLETE.")

if __name__ == "__main__":
    REPDUpdater().execute()
