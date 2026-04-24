import json

def generate_unification_routes():
    # The 12 massive global macro-corridors
    corridors = [
        {"name": "Trans-Atlantic North (US-UK/EU)", "waypoints": [[-74.00, 40.71], [-5.54, 50.11]]},
        {"name": "Trans-Atlantic South (US-EU)", "waypoints": [[-75.97, 36.85], [-3.01, 43.36]]},
        {"name": "Trans-Pacific North (US-Japan)", "waypoints": [[-123.98, 45.92], [-165.00, 45.00], [140.40, 36.30]]},
        {"name": "Trans-Pacific South (US-Oceania)", "waypoints": [[-118.24, 34.05], [-157.85, 21.30], [144.75, 13.44], [151.20, -33.86], [174.76, -36.84]]},
        {"name": "Intra-Asia Backbone", "waypoints": [[140.40, 36.30], [121.56, 25.03], [114.16, 22.28], [103.81, 1.35]]},
        {"name": "Europe-Middle East-India-Asia", "waypoints": [[5.36, 43.29], [32.30, 31.20], [32.55, 29.96], [39.19, 21.48], [43.33, 11.58], [58.38, 23.58], [72.82, 18.97], [80.27, 13.08], [103.81, 1.35]]},
        {"name": "Africa West Coast Ring", "waypoints": [[-9.13, 38.72], [-17.46, 14.71], [3.37, 6.52], [13.23, -8.83], [18.42, -33.92]]},
        {"name": "Africa East Coast Ring", "waypoints": [[18.42, -33.92], [32.58, -25.96], [39.66, -4.04], [43.33, 11.58]]},
        {"name": "South America East Coast", "waypoints": [[-80.19, 25.76], [-38.52, -3.73], [-43.17, -22.90], [-56.71, -36.53]]},
        {"name": "South America West Coast", "waypoints": [[-118.24, 34.05], [-79.51, 8.98], [-77.04, -12.04], [-71.61, -33.04]]},
        {"name": "South Atlantic Crossing", "waypoints": [[-38.52, -3.73], [-8.86, 37.95]]},
        {"name": "Indian Ocean Crossing", "waypoints": [[115.86, -31.95], [106.84, -6.20], [103.81, 1.35]]}
    ]

    features = []
    for route in corridors:
        features.append({
            "type": "Feature",
            "properties": {
                "name": route["name"],
                "operator": "Unification Estimates",
                "type": "unification_estimates",
                "source": "Ventus Strategic Unification"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": route["waypoints"]
            }
        })

    geojson = {"type": "FeatureCollection", "features": features}
    
    with open("unification_deep_subsea_estimates.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated {len(corridors)} routes to unification_deep_subsea_estimates.geojson")

if __name__ == "__main__":
    generate_unification_routes()
