import pandas as pd
import json
import os
import requests
from datetime import datetime
from math import isfinite

# ── NAEI POINT SOURCES UPDATER v1.0 ──────────────────────────────────────────
# Downloads the NAEI Point Sources Excel from energysecurity.gov.uk
# Parses to GeoJSON with coordinates, site name, sector, and emissions.
# Outputs: dist/naei_point_sources.json
# Schedule: annual (data updates ~September each year)
# ─────────────────────────────────────────────────────────────────────────────

NAEI_URL = "https://naei.energysecurity.gov.uk/sites/default/files/2025-09/NAEIPointsSources_2023.xlsx"
OUTPUT_PATH = "dist/naei_point_sources.json"
RAW_PATH    = "data/NAEIPointsSources.xlsx"

UK_LON_MIN, UK_LON_MAX = -9.0,  2.5
UK_LAT_MIN, UK_LAT_MAX = 49.0, 61.0

def download_excel():
    os.makedirs("data", exist_ok=True)
    print(f"⬇️  Downloading NAEI Point Sources Excel (~96MB)...")
    headers = {"User-Agent": "Mozilla/5.0 (compatible; VentusBot/1.0)"}
    r = requests.get(NAEI_URL, headers=headers, timeout=120, stream=True)
    r.raise_for_status()
    with open(RAW_PATH, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
    size_mb = os.path.getsize(RAW_PATH) / 1024 / 1024
    print(f"✅ Downloaded: {size_mb:.1f} MB → {RAW_PATH}")

def discover_sheets():
    xl = pd.ExcelFile(RAW_PATH, engine="openpyxl")
    print(f"📋 Sheets found: {xl.sheet_names}")
    return xl.sheet_names

def parse_sheet(sheet_name):
    print(f"📊 Parsing sheet: {sheet_name}")
    df = pd.read_excel(RAW_PATH, sheet_name=sheet_name, engine="openpyxl")
    print(f"   Shape: {df.shape}")
    print(f"   Columns: {list(df.columns)}")
    return df

def safe_float(val):
    try:
        v = float(val)
        return v if isfinite(v) else None
    except (TypeError, ValueError):
        return None

def clean_str(val):
    s = str(val).strip() if val is not None else ""
    return "" if s.lower() in ("nan", "none", "") else s

def build_geojson(df, lat_col, lon_col, name_col, sector_col, pollutant_cols):
    features = []
    skipped = 0
    for _, row in df.iterrows():
        lat = safe_float(row.get(lat_col))
        lon = safe_float(row.get(lon_col))
        if lat is None or lon is None:
            skipped += 1
            continue
        if not (UK_LAT_MIN <= lat <= UK_LAT_MAX and UK_LON_MIN <= lon <= UK_LON_MAX):
            skipped += 1
            continue
        props = {
            "name":    clean_str(row.get(name_col, "")),
            "sector":  clean_str(row.get(sector_col, "")),
        }
        # Add each pollutant column if present
        for col in pollutant_cols:
            if col in df.columns:
                v = safe_float(row.get(col))
                if v is not None:
                    props[col.lower().replace(" ", "_").replace("(", "").replace(")", "")] = v
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": props
        })
    print(f"✅ Built {len(features)} features ({skipped} skipped - no coords or outside UK)")
    return {"type": "FeatureCollection", "features": features}

def write_geojson(geojson):
    os.makedirs("dist", exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"💾 Written: {OUTPUT_PATH} ({size_kb:.0f} KB, {len(geojson['features'])} features)")

def main():
    print("🏭 NAEI POINT SOURCES UPDATER v1.0 | BOOTING...")
    print(f"   Timestamp: {datetime.utcnow().isoformat()}Z")

    download_excel()
    sheets = discover_sheets()

    # Start small: parse just the first sheet to understand the structure
    df = parse_sheet(sheets[0])

    # Auto-detect coordinate columns (NAEI uses Easting/Northing or Lat/Lon)
    cols_lower = {c.lower(): c for c in df.columns}
    print(f"\n🔍 Detecting coordinate columns...")

    # Try WGS84 lat/lon first
    lat_col = next((cols_lower[k] for k in cols_lower if "lat" in k), None)
    lon_col = next((cols_lower[k] for k in cols_lower if "lon" in k or "lng" in k), None)

    if lat_col and lon_col:
        print(f"   Found WGS84 columns: lat={lat_col}, lon={lon_col}")
    else:
        print(f"   ⚠️  No WGS84 columns found - printing all columns for inspection:")
        for c in df.columns:
            print(f"      {c}")
        print("\n⚠️  Cannot build GeoJSON without coordinate columns.")
        print("   Update lat_col/lon_col in this script after inspecting output above.")
        return

    # Auto-detect name and sector columns
    name_col   = next((cols_lower[k] for k in cols_lower if "name" in k or "site" in k), df.columns[0])
    sector_col = next((cols_lower[k] for k in cols_lower if "sector" in k or "source" in k or "activity" in k), "")

    # Auto-detect emission columns (CO2, NOx, SO2, PM, CH4 etc.)
    pollutant_keywords = ["co2", "nox", "sox", "so2", "pm", "ch4", "n2o", "nh3", "nmvoc", "emission", "tonne"]
    pollutant_cols = [c for c in df.columns if any(kw in c.lower() for kw in pollutant_keywords)]
    print(f"   Name col:      {name_col}")
    print(f"   Sector col:    {sector_col}")
    print(f"   Pollutant cols found: {pollutant_cols[:10]}")

    geojson = build_geojson(df, lat_col, lon_col, name_col, sector_col, pollutant_cols)
    write_geojson(geojson)
    print("\n✅ NAEI POINT SOURCES UPDATE COMPLETE")

if __name__ == "__main__":
    main()
