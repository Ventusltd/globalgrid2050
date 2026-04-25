import requests
import json

# Overpass query to find London Underground stations
query = """
[out:json][timeout:90];
area["ISO3166-1"="GB"]->.uk;
(
  node["railway"="station"]["network"~"London Underground"](area.uk);
  way["railway"="station"]["network"~"London Underground"](area.uk);
  rel["railway"="station"]["network"~"London Underground"](area.uk);
);
out center;
"""

url = "https://overpass-api.de/api/interpreter"
print("Fetching London Underground stations from Overpass API...")
response = requests.post(url, data={'data': query})

if response.status_code == 200:
    data = response.json()
    features = []
    
    for element in data.get('elements', []):
        # Extract coordinates (handles nodes, ways, and relations)
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        
        if lat and lon:
            tags = element.get('tags', {})
            name = tags.get('name', 'Unknown Station')
            
            feature = {
                "type": "Feature",
                "properties": {
                    "name": name,
                    "type": "Tube Station",
                    "operator": "Transport for London"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                }
            }
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    output_path = "london_underground.geojson"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    print(f"Successfully saved {len(features)} London Underground stations to {output_path}")
else:
    print(f"Error fetching data: {response.status_code}")
