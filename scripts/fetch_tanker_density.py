import os
import json
import zipfile
import requests
import io

# Calculate the absolute path of the repository root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

# Defra Spatial Data standard download URL structure
DOWNLOAD_URL = "https://environment.data.gov.uk/spatialdata/shipping-vessel-density-grid/datadownload/Shipping_vessel_density_grid.geojson.zip"
OUTPUT_FILE = "uk_tanker_density.geojson"

def fetch_and_process():
    print(f"Downloading dataset from: {DOWNLOAD_URL}")
    headers = {'User-Agent': 'GlobalGrid2050-Pipeline/5.1'}
    
    response = requests.get(DOWNLOAD_URL, headers=headers, stream=True)
    if response.status_code != 200:
        print(f"CRITICAL: Failed to download data. HTTP {response.status_code}")
        print("The Defra spatial URL might have changed. Please verify the direct download link on the portal.")
        exit(1)
        
    print("Download complete. Extracting GeoJSON from ZIP...")
    
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # Find the geojson file inside the zip (usually named exactly the same)
        geojson_filename = next((name for name in z.namelist() if name.endswith('.geojson')), None)
        
        if not geojson_filename:
            print("CRITICAL: No .geojson file found inside the downloaded ZIP.")
            exit(1)
            
        print(f"Extracting and parsing {geojson_filename} into memory...")
        with z.open(geojson_filename) as f:
            data = json.load(f)
            
    print(f"Raw dataset loaded. Total UK grid cells: {len(data.get('features', []))}")
    
    # Filter strictly for Tankers (Category 8)
    filtered_features = []
    dropped = 0
    
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        
        # Depending on how Defra exported the shapefile, the attribute might have different casing
        tanker_density = props.get('8') or props.get('Tankers') or props.get('cat_8') or props.get('category_8') or 0
        
        try:
            tanker_density = float(tanker_density)
        except (ValueError, TypeError):
            tanker_density = 0.0
            
        # Only keep the 2km grid cell if an oil/LNG tanker has passed through it
        if tanker_density > 0:
            # Strip out all other ship types (fishing, passenger, etc.) to dramatically reduce file size
            feature['properties'] = {
                'category': 'Tanker Route',
                'tanker_density': round(tanker_density, 3),
                'weekly_avg': round(float(props.get('Week_Ave', 0)), 3),
                'annual_avg': round(float(props.get('Annual_Ave', 0)), 3)
            }
            filtered_features.append(feature)
        else:
            dropped += 1
            
    print(f"Filtering complete. Kept {len(filtered_features)} Tanker cells.")
    print(f"Dropped {dropped} non-tanker/empty cells, vastly reducing file size.")
    
    # Package back into a standard FeatureCollection
    output_data = {
        "type": "FeatureCollection",
        "features": filtered_features
    }
    
    output_path = os.path.join(REPO_ROOT, OUTPUT_FILE)
    print(f"Saving filtered Tanker dataset to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as out_f:
        json.dump(output_data, out_f, separators=(',', ':'))
        
    print("SUCCESS: MMO Tanker Density Pipeline complete.")

if __name__ == "__main__":
    fetch_and_process()
