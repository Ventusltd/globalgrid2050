import pandas as pd
import json
import os
import requests
from pyproj import Transformer

# --- CONFIGURATION ---
# Replace this with the direct URL to the latest NAEI Point Source CSV when published,
# OR place a downloaded CSV in your data folder and point this to local path (e.g., "data/naei_emissions.csv")
DATA_URL = "https://naei.energysecurity.gov.uk/data/YOUR_DATASET_URL.csv" 
OUTPUT_GEOJSON = "heaviest_emitters.geojson"

def fetch_and_process_emitters():
    print("🚀 Starting Heavy Emitters data pipeline...")
    
    # Set up coordinate transformer: British National Grid (EPSG:27700) -> WGS84 Lat/Lon (EPSG:4326)
    transformer = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    
    try:
        # 1. Load the data
        print(f"📥 Loading data from {DATA_URL}...")
        
        # If using a URL, requests gets it. If using a local file, pandas reads it directly.
        if DATA_URL.startswith("http"):
            df = pd.read_csv(DATA_URL)
        else:
            df = pd.read_csv(DATA_URL)

        # 2. Standardise column names (Update these to match the exact headers in your CSV)
        # NAEI typically uses 'Pollutant', 'Emission', 'Easting', 'Northing', 'SiteName', 'Operator'
        df.columns = [col.strip().lower() for col in df.columns]
        
        # 3. Filter for Carbon Dioxide / Greenhouse Gases
        # Adjust 'pollutant' to match the exact column name in the NAEI data
        if 'pollutant' in df.columns:
            df = df[df['pollutant'].astype(str).str.contains('carbon', case=False, na=False)]
            
        # 4. Sort by heaviest emitters (descending)
        # Adjust 'emission' to match the column containing the tonnes of CO2
        if 'emission' in df.columns:
            df = df.sort_values(by='emission', ascending=False)

        features = []
        
        # 5. Process coordinates and build GeoJSON
        print("🗺️ Converting Eastings/Northings to Lat/Lon...")
        for index, row in df.iterrows():
            try:
                # Extract coordinates
                easting = float(row.get('easting', 0))
                northing = float(row.get('northing', 0))
                
                if easting == 0 or northing == 0:
                    continue
                
                # Transform to Lat/Lon
                lon, lat = transformer.transform(easting, northing)
                
                # Extract emissions and convert to Kilotonnes for cleaner mapping
                emissions_tonnes = float(row.get('emission', 0))
                emissions_kt = round(emissions_tonnes / 1000, 2)
                
                if emissions_kt < 1: # Optional: skip tiny emitters to keep the map clean
                    continue

                # Build the GeoJSON feature
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": str(row.get('sitename', 'Unknown Facility')),
                        "operator": str(row.get('operator', 'Unknown Operator')),
                        "emissions_kt": emissions_kt,
                        "type": "Heavy Emitter"
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(lon, 5), round(lat, 5)]
                    }
                })
            except Exception as row_err:
                print(f"⚠️ Skipping row due to error: {row_err}")
                continue

        # 6. Construct final GeoJSON structure
        geojson_output = {
            "type": "FeatureCollection",
            "features": features
        }

        # 7. Save to the root directory (matching your other data files)
        with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
            json.dump(geojson_output, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 Successfully converted and saved {len(features)} heavy emitters to {OUTPUT_GEOJSON}!")

    except Exception as e:
        print(f"❌ Pipeline failed: {e}")
        exit(1)

if __name__ == "__main__":
    fetch_and_process_emitters()
