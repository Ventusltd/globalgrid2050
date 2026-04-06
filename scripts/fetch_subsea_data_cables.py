import requests
import json
import math

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ---------------------------------------------------------
# STRATEGIC ILLUSTRATIVE ROUTES (News / Public Knowledge)
# ---------------------------------------------------------
# These act as proxies for 2045 Global HVDC corridors.
# Coordinates are [Longitude, Latitude]
ILLUSTRATIVE_ROUTES = [
    {
        "name": "Trans-Atlantic Corridor (UK-US Proxy)",
        "operator": "Strategic Forecast (Illustrative)",
        "waypoints": [
            [-4.54, 50.82],   # Bude, Cornwall, UK
            [-72.87, 40.76]   # Shirley, New York, US
        ]
    },
    {
        "name": "Trans-Pacific Corridor (AUS-US Proxy)",
        "operator": "Strategic Forecast (Illustrative)",
        "waypoints": [
            [151.20, -33.86], # Sydney, Australia
            [-157.85, 21.30], # Hawaii, US
            [-118.24, 34.05]  # Los Angeles, US
        ]
    },
    {
        "name": "Euro-Asia-Oceania Corridor (UK-AUS Proxy)",
        "operator": "Strategic Forecast (Illustrative)",
        "waypoints": [
            [-4.54, 50.82],   # Cornwall, UK
            [5.36, 43.29],    # Marseille, France
            [29.90, 31.20],   # Alexandria, Egypt
            [32.55, 29.96],   # Suez, Egypt
            [72.80, 18.90],   # Mumbai, India
            [103.81, 1.35],   # Singapore
            [115.86, -31.95]  # Perth, Australia
        ]
    },
    {
        "name": "South Atlantic Corridor (US-South America Proxy)",
        "operator": "Strategic Forecast (Illustrative)",
        "waypoints": [
            [-80.19, 25.76],  # Miami, US
            [-38.52, -3.73],  # Fortaleza, Brazil
            [-43.17, -22.90]  # Rio de Janeiro, Brazil
        ]
    }
]

# ---------------------------------------------------------
# MATHEMATICS: GREAT CIRCLE ARCS
# ---------------------------------------------------------
def create_great_circle_arc(lon1, lat1, lon2, lat2, num_points=40):
    """Calculates the curvature of the Earth to draw smooth arcs across oceans."""
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    if c == 0:
        return [[lon1, lat1]]
        
    path = []
    for i in range(num_points + 1):
        f = i / num_points
        A = math.sin((1 - f) * c) / math.sin(c)
        B = math.sin(f * c) / math.sin(c)
        
        x = A * math.cos(lat1_rad) * math.cos(lon1_rad) + B * math.cos(lat2_rad) * math.cos(lon2_rad)
        y = A * math.cos(lat1_rad) * math.sin(lon1_rad) + B * math.cos(lat2_rad) * math.sin(lon2_rad)
        z = A * math.sin(lat1_rad) + B * math.sin(lat2_rad)
        
        lat3 = math.atan2(z, math.sqrt(x**2 + y**2))
        lon3 = math.atan2(y, x)
        
        # Handle the Pacific Antimeridian (Date Line) wrapping
        deg_lon = math.degrees(lon3)
        if path and abs(deg_lon - path[-1][0]) > 180:
            # We break the line to prevent horizontal map streaking, but for standard 
            # illustrative paths, MapLibre often handles the dateline gracefully if drawn sequentially.
            pass
            
        path.append([deg_lon, math.degrees(lat3)])
    return path

def inject_illustrative_routes(features: list):
    """Injects our hardcoded strategic corridors into the map data."""
    for route in ILLUSTRATIVE_ROUTES:
        waypoints = route["waypoints"]
        full_line = []
        
        # Connect each waypoint with a curved great circle arc
        for i in range(len(waypoints) - 1):
            lon1, lat1 = waypoints[i]
            lon2, lat2 = waypoints[i+1]
            arc = create_great_circle_arc(lon1, lat1, lon2, lat2)
            if i > 0:
                arc = arc[1:] # Avoid duplicating the connecting node
            full_line.extend(arc)
            
        features.append({
            "type": "Feature",
            "properties": {
                "name": route["name"],
                "operator": route["operator"],
                "source": "Strategic Projection",
                "type": "subsea_data_cable"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": full_line
            }
        })
    return features

# ---------------------------------------------------------
# OPENSTREETMAP: LIVE DATA PULL
# ---------------------------------------------------------
def fetch_osm_cables() -> list:
    query = """[out:json][timeout:180];
    (
      way["telecom"="cable"]["submarine"="yes"];
      way["telecom"="communication_cable"]["location"="underwater"];
      relation["telecom"="cable"]["submarine"="yes"];
    );
    out geom;
    """
    features = []
    try:
        res = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        res.raise_for_status()
        data = res.json()
        
        seen_ways = set()
        
        # Process Relations
        for el in data.get("elements", []):
            if el["type"] == "relation":
                multiline = []
                for member in el.get("members", []):
                    if member["type"] == "way" and "geometry" in member:
                        line = [[pt["lon"], pt["lat"]] for pt in member["geometry"]]
                        if len(line) >= 2:
                            multiline.append(line)
                            seen_ways.add(member["ref"])
                if multiline:
                    features.append({
                        "type": "Feature",
                        "properties": {"name": "Regional Subsea Route", "type": "subsea_data_cable", "source": "OSM"},
                        "geometry": {"type": "MultiLineString", "coordinates": multiline}
                    })
                    
        # Process Ways
        for el in data.get("elements", []):
            if el["type"] == "way" and el["id"] not in seen_ways and "geometry" in el:
                line = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
                if len(line) >= 2:
                    features.append({
                        "type": "Feature",
                        "properties": {"name": "Local Subsea Cable", "type": "subsea_data_cable", "source": "OSM"},
                        "geometry": {"type": "LineString", "coordinates": line}
                    })
    except Exception as e:
        print(f"OSM fetch failed: {e}. Proceeding with Illustrative routes only.")
        
    return features

def main():
    print("Initiating Hybrid Global Backbone Fetch...")
    
    # 1. Fetch the live OpenStreetMap data (The highly accurate regional grids)
    print("Pulling live OSM intelligence...")
    features = fetch_osm_cables()
    
    # 2. Inject the Strategic Illustrative Routes (The 2045 Global Corridors)
    print("Injecting mathematical Great Circle global corridors...")
    features = inject_illustrative_routes(features)
    
    # 3. Compile and save
    geojson = {"type": "FeatureCollection", "features": features}
    with open("subsea_data_cables.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
        
    print(f"Saved {len(features)} total routes to subsea_data_cables.geojson")

if __name__ == "__main__":
    main()
