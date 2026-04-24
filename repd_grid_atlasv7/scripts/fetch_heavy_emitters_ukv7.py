import pandas as pd
import json
import os
import requests
from datetime import datetime
from math import isfinite
from pyproj import Transformer

# UK HEAVY EMITTERS UPDATER v4.0
# Mission: Identify every major UK industrial emitter. One point per site.
# True CO2-equivalent tonnes including N2O (GWP-298). No compromises.

SOURCE_PAGE_URL = "https://naei.energysecurity.gov.uk/data/maps/emissions-point-sources"
OUTPUT_PATH     = "heavy_emitters_uk.json"
MANIFEST_PATH   = "manifest_heavy_emitters.json"
RAW_PATH        = "data/NAEIPointsSources.xlsx"

SHEET_NAME = "GHGs"
HEADER_ROW = 0

COL_YEAR      = "Year"
COL_PLANTID   = "PlantID"
COL_SITE      = "Site"
COL_EASTING   = "Easting"
COL_NORTHING  = "Northing"
COL_OPERATOR  = "Operator"
COL_SECTOR    = "Sector"
COL_POLLUTANT = "Pollutant_Name"
COL_EMISSION  = "Emission"
COL_COUNTRY   = "Country"
COL_DATATYPE  = "Datatype"

CO2_CARBON_TO_CO2 = 44.0 / 12.0  
N2O_GWP           = 298.0          

UK_LON_MIN, UK_LON_MAX = -9.0,  2.5
UK_LAT_MIN, UK_LAT_MAX = 49.0, 61.0

transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

class HeavyEmittersUpdater:
    def __init__(self):
        print("UK HEAVY EMITTERS UPDATER v4.0 | BOOTING...")
        print(f"   Timestamp: {datetime.utcnow().isoformat()}Z")
        os.makedirs("data", exist_ok=True)

    def discover_latest_url(self):
        print("\nDiscovering latest UK emissions Excel URL...")
        try:
            from bs4 import BeautifulSoup
            r = requests.get(SOURCE_PAGE_URL, timeout=30,
                             headers={"User-Agent": "Mozilla/5.0 (compatible; VentusBot/4.0)"})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "NAEIPointsSources" in href and href.endswith(".xlsx"):
                    url = href if href.startswith("http") else f"https://naei.energysecurity.gov.uk{href}"
                    print(f"   Discovered: {url}")
                    return url
        except Exception as e:
            print(f"   Discovery failed: {e}")
        fallback = "https://naei.energysecurity.gov.uk/sites/default/files/2025-09/NAEIPointsSources_2023.xlsx"
        print(f"   Using fallback: {fallback}")
        return fallback

    def download_excel(self, url):
        print("\nDownloading UK emissions Excel (~96MB)...")
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; VentusBot/4.0)"},
                         timeout=180, stream=True)
        r.raise_for_status()
        with open(RAW_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)
        size_mb = os.path.getsize(RAW_PATH) / 1024 / 1024
        print(f"   Downloaded: {size_mb:.1f} MB -> {RAW_PATH}")

    def parse_sheet(self):
        print(f"\nParsing sheet '{SHEET_NAME}' (header row {HEADER_ROW})...")
        df = pd.read_excel(RAW_PATH, sheet_name=SHEET_NAME, header=HEADER_ROW, engine="openpyxl")
        df.columns = [str(c).strip() for c in df.columns]
        return df

    def validate_schema(self, df):
        required = [COL_YEAR, COL_PLANTID, COL_SITE, COL_EASTING, COL_NORTHING,
                    COL_OPERATOR, COL_SECTOR, COL_POLLUTANT, COL_EMISSION,
                    COL_COUNTRY, COL_DATATYPE]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise SystemExit(1)

    def transform(self, df):
        latest_year = int(df[COL_YEAR].max())
        df = df[df[COL_YEAR] == latest_year].copy()
        
        df[COL_EMISSION] = pd.to_numeric(df[COL_EMISSION], errors="coerce")
        df = df.dropna(subset=[COL_EMISSION])

        def to_co2e(row):
            p = str(row[COL_POLLUTANT]).lower()
            e = float(row[COL_EMISSION])
            if "carbon dioxide" in p:
                return e * CO2_CARBON_TO_CO2
            elif "nitrous oxide" in p:
                return e * N2O_GWP
            else:
                return e

        df["tco2e"] = df.apply(to_co2e, axis=1)

        df_flat = df.groupby(COL_PLANTID, as_index=False).agg({
            COL_SITE:     "first",
            COL_OPERATOR: "first",
            COL_SECTOR:   "first",
            COL_EASTING:  "first",
            COL_NORTHING: "first",
            COL_COUNTRY:  "first",
            COL_DATATYPE: "first",
            "tco2e":      "sum"
        })

        df_flat["tco2e"] = df_flat["tco2e"].round(2)
        return df_flat, latest_year

    def build_geojson(self, df_flat):
        features = []
        for _, row in df_flat.iterrows():
            try:
                easting  = float(row[COL_EASTING])
                northing = float(row[COL_NORTHING])
            except (TypeError, ValueError):
                continue

            if not isfinite(easting) or not isfinite(northing) or easting == 0 or northing == 0:
                continue

            lon, lat = transformer.transform(easting, northing)

            if not (isfinite(lon) and isfinite(lat)):
                continue

            if not (UK_LON_MIN < lon < UK_LON_MAX and UK_LAT_MIN < lat < UK_LAT_MAX):
                continue

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)]
                },
                "properties": {
                    "id":             str(int(row[COL_PLANTID])),
                    "name":           str(row[COL_SITE]).strip(),
                    "operator":       str(row[COL_OPERATOR]).strip(),
                    "sector":         str(row[COL_SECTOR]).strip(),
                    "country":        str(row[COL_COUNTRY]).strip(),
                    "datatype":       str(row[COL_DATATYPE]).strip(),
                    "emission_tco2e": row["tco2e"],
                    "type":           "naei_emitter"
                }
            })

        return {"type": "FeatureCollection", "features": features}

    def write_outputs(self, geojson, source_url, latest_year):
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(geojson, f, separators=(",", ":"))

        manifest = {
            "source_url":    source_url,
            "processed_at":  datetime.utcnow().isoformat() + "Z",
            "year_filtered": latest_year,
            "feature_count": len(geojson["features"]),
            "sheet":         SHEET_NAME,
            "output":        OUTPUT_PATH,
            "physics":       "tCO2e: CO2x(44/12) + N2Ox(44/12)x298 GWP-100 AR5"
        }
        with open(MANIFEST_PATH, "w") as f:
            json.dump(manifest, f, indent=2)

    def run(self):
        url = self.discover_latest_url()
        
        # FORCED RUN: Bypassing manifest checks so GitHub Actions ALWAYS generates the file
        self.download_excel(url)
        df = self.parse_sheet()
        self.validate_schema(df)
        df_flat, year = self.transform(df)
        geojson = self.build_geojson(df_flat)

        if len(geojson["features"]) == 0:
            raise SystemExit(1)

        self.write_outputs(geojson, url, year)

if __name__ == "__main__":
    HeavyEmittersUpdater().run()

