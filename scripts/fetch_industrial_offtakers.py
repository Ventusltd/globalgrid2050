import requests
import json
import time

def fetch_heavy_industry():
    print("🚀 Fetching UK Heavy Industrial Offtakers from OpenStreetMap...")
    
    query = """
    [out:json][timeout:300];
    area(3600062149)->.uk;
    (
      // Manufacturing & Processing
      node["industrial"="steel"](area.uk);
      way["industrial"="steel"](area.uk);
      relation["industrial"="steel"](area.uk);
      
      node["industrial"="metallurgical"](area.uk);
      way["industrial"="metallurgical"](area.uk);
      relation["industrial"="metallurgical"](area.uk);
      
      node["industrial"="glass"](area.uk);
      way["industrial"="glass"](area.uk);
      relation["industrial"="glass"](area.uk);
      
      node["industrial"="cement"](area.uk);
      way["industrial"="cement"](area.uk);
      relation["industrial"="cement"](area.uk);
      
      node["industrial"="paper"](area.uk);
      way["industrial"="paper"](area.uk);
      relation["industrial"="paper"](area.uk);
      
      node["industrial"="chemical"](area.uk);
      way["industrial"="chemical"](area.uk);
      relation["industrial"="chemical"](area.uk);
      
      node["industrial"="oil"](area.uk);
      way["industrial"="oil"](area.uk);
      relation["industrial"="oil"](area.uk);

      // Major Water Infrastructure (Massive power consumers)
      node["man_made"="water_works"](area.uk);
      way["man_made"="water_works"](area.uk);
      relation["man_made"="water_works"](area.uk);
      
      node["man_made"="wastewater_plant"](area.uk);
      way["man_made"="wastewater_plant"](area.uk);
      relation["man_made"="wastewater_plant"](area.uk);
    );
    out center;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(3):
        try:
            response = requests.post(url, data={'data': query})
            if response.status_code == 200:
                print("  ✅ Download successful!")
                break
            elif response.status_code == 429:
                print("  ⚠️ Server busy, sleeping 60s...")
                time.sleep(60)
            else:
                print(f"  ❌ Error: {response.status_code}")
                return
        except Exception as e:
            print(f"  ❌ Connection Error: {e}")
            return

    osm_data = response.json()
    geojson = {"type": "FeatureCollection", "features": []}
    
    for element in osm_data.get('elements', []):
        tags = element.get('tags', {})
        
        if element['type'] == 'node':
            lat, lon = element.get('lat'), element.get('lon')
        elif 'center' in element:
            lat, lon = element['center'].get('lat'), element['center'].get('lon')
        else:
            continue
            
        if lat and lon:
            # Categorize the industry type for the popup
            ind_type = tags.get('industrial', tags.get('man_made', 'Heavy Industry')).replace('_', ' ').title()
            
            # Filter out unnamed generic noise to keep the map clean and actionable
            name = tags.get('name')
            operator = tags.get('operator', tags.get('brand', 'Unknown Operator'))
            
            if name or operator != 'Unknown Operator':
                feature = {
                    "type": "Feature",
                    "properties": {
                        "name": name if name else f"Unnamed {ind_type} Facility",
                        "operator": operator,
                        "type": ind_type
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]}
                }
                geojson['features'].append(feature)

    with open("industrial_offtakers.geojson", 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
        
    print(f"🎉 Successfully saved {len(geojson['features'])} Industrial Sites to industrial_offtakers.geojson!")

if __name__ == "__main__":
    fetch_heavy_industry()

