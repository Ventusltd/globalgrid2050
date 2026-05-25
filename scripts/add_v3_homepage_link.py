from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
V3_INDEX = ROOT / "uk_energy_tracking_v3" / "index.md"
REPORT = ROOT / "gridbot_reports" / "add_v3_homepage_link.md"

if not INDEX.exists():
    raise SystemExit("index.html missing")

if not V3_INDEX.exists():
    raise SystemExit("V3 page missing: uk_energy_tracking_v3/index.md")

html = INDEX.read_text(encoding="utf-8")

if "./uk_energy_tracking_v3/" in html or "uk_energy_tracking_v3" in html:
    raise SystemExit("V3 homepage link already exists")

v2_row = '  <tr><td><a href="./uk_energy_tracking_v2/">UK Live Grid Tracker V2, Transport Energy Test Clone</a></td></tr>'
v3_row = '  <tr><td><a href="./uk_energy_tracking_v3/">UK Live Grid Tracker V3, Experimental Intelligence Lab</a></td></tr>'

if v2_row not in html:
    raise SystemExit("Exact V2 homepage row not found. Stop rather than guessing.")

html = html.replace(v2_row, v2_row + "\n" + v3_row, 1)

INDEX.write_text(html, encoding="utf-8")

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(f"""# Add V3 homepage link report

UTC timestamp: {datetime.now(timezone.utc).isoformat()}

Changes:
- Confirmed V3 exists at `uk_energy_tracking_v3/index.md`
- Added root homepage row for `./uk_energy_tracking_v3/`
- Inserted V3 directly after V2 in the directory table
- No stable tracker files changed
""", encoding="utf-8")

print("Added V3 homepage link")
