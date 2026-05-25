from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
REPORT = ROOT / "gridbot_reports" / "add_v3_homepage_link.md"

if not INDEX.exists():
    raise SystemExit("index.html missing")

html = INDEX.read_text(encoding="utf-8")

marker = "uk_energy_tracking_v2"
if marker not in html:
    raise SystemExit("V2 marker not found in homepage")

if "uk_energy_tracking_v3" in html:
    raise SystemExit("V3 homepage link already exists")

insert = '''

<div class="project-card">
    <h3>UK Live Grid Tracker V3</h3>
    <p>Experimental intelligence lab for native price history, diagnostics, graph accumulation and energy market comparison layers.</p>
    <a href="/uk_energy_tracking_v3/">Open V3 Experimental Build</a>
</div>
'''

html = html.replace(marker, marker + insert, 1)

INDEX.write_text(html, encoding="utf-8")

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(f'''# Add V3 homepage link report

UTC timestamp: {datetime.now(timezone.utc).isoformat()}

Changes:
- Added UK Live Grid Tracker V3 link to root homepage
- V3 described as experimental intelligence lab
- Root homepage now exposes V1/V2/V3 evolution path
''', encoding="utf-8")

print("Added V3 homepage link")
