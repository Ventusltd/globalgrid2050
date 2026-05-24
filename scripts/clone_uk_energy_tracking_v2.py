from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "uk_energy_tracking" / "index.md"
DST_DIR = ROOT / "uk_energy_tracking_v2"
DST = DST_DIR / "index.md"

text = SRC.read_text(encoding="utf-8")
text = text.replace("title: UK Live Grid Tracker", "title: UK Live Grid Tracker V2")
text = text.replace("permalink: /uk_energy_tracking/", "permalink: /uk_energy_tracking_v2/")
text = text.replace("UK LIVE GRID TRACKER", "UK LIVE GRID TRACKER V2", 1)

# V2 is a UI test clone. It reads stable V1 data feeds until V2 pipelines are explicitly added.
text = text.replace('var ENERGY="./live_grid_energy.json", PRICE="./live_grid_price.json", OIL="./live_oil_prices.json", OIL_HISTORY="./oil_price_history.geojson", POLL=5*60*1000;',
                    'var ENERGY="/uk_energy_tracking/live_grid_energy.json", PRICE="/uk_energy_tracking/live_grid_price.json", OIL="/uk_energy_tracking/live_oil_prices.json", OIL_HISTORY="/uk_energy_tracking/oil_price_history.geojson", POLL=5*60*1000;')

marker = '<p class="scada-intro">'
note = '<p class="scada-intro" style="border:1px solid var(--gg-orange);padding:10px 12px;border-radius:4px;color:var(--gg-orange);">V2 development clone. Original tracker remains protected at /uk_energy_tracking/. This page uses V1 live feeds until V2 data pipelines are approved.</p>\n\n  '
if note not in text and marker in text:
    text = text.replace(marker, note + marker, 1)

DST_DIR.mkdir(parents=True, exist_ok=True)
DST.write_text(text, encoding="utf-8")
print(f"Cloned {SRC} to {DST}")
