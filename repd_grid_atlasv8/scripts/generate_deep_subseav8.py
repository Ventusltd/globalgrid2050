import json

def generate_deep_subsea_routes():
    # Multi-point waypoints for deep ocean crossings
    # Coordinates are [Longitude, Latitude]
    corridors = [
        {
            "name": "Trans-Pacific Deep Subsea (Illustrative)",
            "operator": "Strategic Corridor",
            "waypoints": [
                [151.20, -33.86],  # Sydney, Australia
                [174.76, -36.84],  # Auckland, NZ
                [-157.85, 21.30],  # Honolulu, Hawaii
                [-118.24, 34.05]   # Los Angeles, US
            ]
        },
        {
            "name": "Oceania-Asia Deep Subsea (Illustrative)",
            "operator": "Strategic Corridor",
            "waypoints": [
                [115.86, -31.95],  # Perth, Australia
                [106.84, -6.20],   # Jakarta, Indonesia
                [103.81, 1.35],    # Singapore
                [114.16, 22.28]    # Hong Kong
            ]
        },
        {
            "name": "Africa-Europe-Asia Deep Subsea (Illustrative)",
            "operator": "Strategic Corridor",
            "waypoints": [
                [5.36, 43.29],     # Marseille, France
                [32.30, 31.20],    # Port Said, Egypt
                [39.19, 21.48],    # Jeddah, Saudi Arabia
                [43.33, 11.58],    # Djibouti
                [39.66, -4.04],    # Mombasa, Kenya
                [32.58, -25.96],   # Maputo, Mozambique
                [18.42, -33.92],   # Cape Town, South Africa
                [13.23, -8.83],    # Luanda, Angola
                [3.37, 6.52],      # Lagos, Nigeria
                [-17.46, 14.71],   # Dakar, Senegal
                [-9.13, 38.72]     # Lisbon, Portugal
            ]
        },
        {
            "name": "South Atlantic Deep Subsea (Illustrative)",
            "operator": "Strategic Corridor",
            "waypoints": [
                [13.23, -8.83],    # Luanda, Angola
                [-38.52, -3.73],   # Fortaleza, Brazil
                [-80.19, 25.76]    # Miami, US
            ]
        }
    ]

    features = []
    for route in corridors:
        features.append({
            "type": "Feature",
            "properties": {
                "name": route["name"],
                "operator": route["operator"],
                "type": "deep_subsea_illustrative",
                "source": "Ventus Deep Subsea (Illustrative)"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": route["waypoints"]
            }
        })

    geojson = {"type": "FeatureCollection", "features": features}
    
    # Save with the new naming convention
    with open("deep_subsea_illustrative.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated {len(corridors)} routes to deep_subsea_illustrative.geojson")

if __name__ == "__main__":
    print("Initiating standalone Deep Subsea Illustrative generation...")
    generate_deep_subsea_routes()
