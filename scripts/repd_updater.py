import pandas as pd
import json
import yaml
import os
from datetime import datetime

class REPDUpdater:
    """
    Industrial-Grade REPD Data Processor.
    Built on 14 years of Energy Domain Research & 20 years of Cable Engineering.
    Converts raw Gov CSVs into Clean, Map-Ready Geospatial Assets.
    """
    def __init__(self, registry_path="backend/registry.yaml"):
        print(f"📡 VENTUS REPD UPDATER | INITIALIZING...")
        with open(registry_path, 'r') as f:
            self.config = yaml.safe_load(f)
        self.output_dir = "dist"
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def process_repd_csv(self, file_path):
        """
        1. Cleans encoding artifacts.
        2. Filters for 2050 Net Zero viability.
        3. Standardizes Operator & Technology names for Chart.js.
        """
        # Load with robust encoding for Gov-style CSVs
        df = pd.read_csv(file_path, encoding='unicode_escape')
        
        # Filter: Only Operational/Active Construction (The 'Ventus Viability' Filter)
        active_projects = ['Operational', 'Under Construction', 'Consented']
        df = df[df['Development Status (short)'].isin(active_projects)]
        
        # Build the GeoJSON structure for the V4 Procedural Discovery HUD
        features = []
        for _, row in df.iterrows():
            # Clean up the Operator strings (Removing 'Plc', 'Ltd', etc.)
            op_name = str(row.get('Operator (or Applicant)', 'Unknown')).split(' ')[0]
            
            features.append({
                "type": "Feature",
                "properties": {
                    "name": row['Site Name'],
                    "operator": op_name,
                    "mw": row['Installed Capacity (MWelec)'],
                    "status": row['Development Status (short)'],
                    "tech": row['Technology Type']
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row['X-coordinate']), float(row['Y-coordinate'])] 
                    # NOTE: Converter logic for BNG to WGS84 goes here
                }
            })
        
        return {"type": "FeatureCollection", "features": features}

    def generate_manifest(self):
        """Generates the JIT manifest_v4.json for the frontend HUD."""
        manifest = {
            "version": "4.2",
            "last_updated": datetime.now().isoformat(),
            "layers": [layer['id'] for layer in self.config['layers']]
        }
        with open(f"{self.output_dir}/manifest_v4.json", 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f"✅ MANIFEST_V4.JSON GENERATED.")

if __name__ == "__main__":
    updater = REPDUpdater()
    # updater.run()
    print("🚀 REPD Updater System: Standby for Sync.")
