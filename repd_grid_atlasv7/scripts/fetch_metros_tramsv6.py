import requests
import json

# Overpass query to find UK Metros, Trams, and Light Rail (excluding Glasgow Subway)
query = """
[out:json][timeout:90];
area["ISO3166-1"="GB"]->.uk;
(
  /* Target specific major networks (omitting Glasgow Subway) */
  node["network"~"London Underground|Tyne and Wear Metro|Docklands Light Railway|Manchester Metrolink|Edinburgh Trams|Nottingham Express Transit|Sheffield Supertram|West Midlands Metro|Blackpool Tramway|Tramlink"](area.uk);
  way["network"~"London Underground|Tyne and Wear Metro|Docklands Light Railway|Manchester Metrolink|Edinburgh Trams|Nottingham Express Transit|Sheffield Supertram|West Midlands Metro|Blackpool Tramway|Tramlink"](area.uk);
  rel["network"~"London Underground|Tyne and Wear Metro|Docklands Light Railway|Manchester Metrolink|Edinburgh Trams|Nottingham Express Transit|Sheffield Supertram|West Midlands Metro|Blackpool Tramway|Tramlink"](area.uk);

  /* Catch-all for generic tram stops and light rail, explicitly ensuring Glasgow isn't caught by accident */
  node["railway"="tram_stop"]["network"!~"Glasgow Subway"](area.uk);
  way["railway"="tram_stop"]["network"!~"Glasgow Subway"](area.uk);
  rel["railway"="tram_stop"]["network"!~"Glasgow Subway"](area.uk);
  
  node["railway"="station"]["light_rail"="yes"]["network"!~"Glasgow Subway"](area.uk);
);
out center;
"""

url = "https://overpass-api.de/api/interpreter"
print("Fetching UK Metros and Trams from Overpass API...")
response = requests.post(url, data={'data': query})

if response.status_code == 200:
    data = response.json()
    features = []
    
    for element in data.get('elements', []):
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        
        if lat and lon:
            tags = element.get('tags', {})
            name = tags.get('name', 'Unknown Station/Stop')
            network = tags.get('network', 'UK Metro/Tram')
            
            # Determine if it's a Metro or a Tram for the popup description
            is_metro = any(n in network for n in ["London Underground", "Tyne and Wear Metro", "Docklands Light Railway"])
            transit_type = "Metro Station" if is_metro else "Tram / Light Rail"

            feature = {
                "type": "Feature",
                "properties": {
                    "name": name,
                    "type": transit_type,
                    "operator": network
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

    output_path = "uk_metros_trams.geojson"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    print(f"Successfully saved {len(features)} Metro/Tram locations to {output_path}")
else:
    print(f"Error fetching data: {response.status_code}")
