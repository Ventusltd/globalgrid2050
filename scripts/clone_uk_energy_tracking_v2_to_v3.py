from pathlib import Path
from datetime import datetime, timezone
import shutil

ROOT = Path(__file__).resolve().parents[1]
V2 = ROOT / "uk_energy_tracking_v2"
V3 = ROOT / "uk_energy_tracking_v3"
SCRIPTS = ROOT / "scripts"
WORKFLOWS = ROOT / ".github" / "workflows"
REPORT = ROOT / "gridbot_reports" / "clone_uk_energy_tracking_v2_to_v3.md"

if not V2.exists():
    raise SystemExit("V2 folder missing: uk_energy_tracking_v2")

changes = []

if V3.exists():
    raise SystemExit("V3 already exists. Stop to avoid overwriting a working version.")

shutil.copytree(V2, V3)
changes.append("copied uk_energy_tracking_v2 to uk_energy_tracking_v3")

# Retarget text inside copied V3 files.
for path in V3.rglob("*"):
    if not path.is_file():
        continue
    if path.suffix.lower() not in {".md", ".json", ".geojson", ".html", ".js", ".css", ".txt"}:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    new = text.replace("uk_energy_tracking_v2", "uk_energy_tracking_v3")
    new = new.replace("/uk_energy_tracking_v2/", "/uk_energy_tracking_v3/")
    new = new.replace("UK Live Grid Tracker V2", "UK Live Grid Tracker V3")
    new = new.replace("UK ENERGY TRACKING V2", "UK ENERGY TRACKING V3")
    new = new.replace("UK Live Grid Tracker V2 Development Twin", "UK Live Grid Tracker V3 Experimental Twin")
    new = new.replace("V2 development clone", "V3 experimental clone")
    new = new.replace("V2", "V3") if path.name in {"README.md", "AI_RELOAD_INSTRUCTIONS.md", "WORK_DIARY.md"} else new
    if new != text:
        path.write_text(new, encoding="utf-8")
        changes.append(f"retargeted {path.relative_to(ROOT)}")

# Clone V2 scripts into V3 scripts.
script_pairs = [
    ("update_uk_energy_v2.py", "update_uk_energy_v3.py"),
    ("update_uk_price_v2.py", "update_uk_price_v3.py"),
    ("update_oil_prices_v2.py", "update_oil_prices_v3.py"),
    ("update_uk_fuel_prices_v2.py", "update_uk_fuel_prices_v3.py"),
]
for src_name, dst_name in script_pairs:
    src = SCRIPTS / src_name
    dst = SCRIPTS / dst_name
    if src.exists():
        text = src.read_text(encoding="utf-8")
        text = text.replace("uk_energy_tracking_v2", "uk_energy_tracking_v3")
        text = text.replace("update_uk_energy_v2", "update_uk_energy_v3")
        text = text.replace("update_uk_price_v2", "update_uk_price_v3")
        text = text.replace("update_oil_prices_v2", "update_oil_prices_v3")
        text = text.replace("update_uk_fuel_prices_v2", "update_uk_fuel_prices_v3")
        dst.write_text(text, encoding="utf-8")
        changes.append(f"created {dst.relative_to(ROOT)}")

# Create V3 grid workflow from V2 workflow.
v2_workflow = WORKFLOWS / "fetch_uk_energy_and_prices_v2.yml"
v3_workflow = WORKFLOWS / "fetch_uk_energy_and_prices_v3.yml"
if v2_workflow.exists():
    text = v2_workflow.read_text(encoding="utf-8")
    text = text.replace("fetch_uk_energy_and_prices_v2", "fetch_uk_energy_and_prices_v3")
    text = text.replace("uk-energy-tracking-v2", "uk-energy-tracking-v3")
    text = text.replace("V2", "V3")
    text = text.replace("_v2.py", "_v3.py")
    text = text.replace("uk_energy_tracking_v2", "uk_energy_tracking_v3")
    text = text.replace("2-59/5", "4-59/5")
    v3_workflow.write_text(text, encoding="utf-8")
    changes.append(f"created {v3_workflow.relative_to(ROOT)}")

# Append V3 creation entry to V3 diary.
diary = V3 / "WORK_DIARY.md"
entry = f"""

## Diary entry: {datetime.now(timezone.utc).strftime('%Y-%m-%d')} V3 clone created

V3 was cloned from V2 as a controlled experimental build.

Purpose:

```text
V1 stable reference remains untouched.
V2 remains operational transport energy prototype.
V3 becomes the diary led experimental version for price history, graphs, diagnostics and competitor tracking comparison.
```

Operating rule:

```text
No wholesale rewrites.
One feature at a time.
One workflow at a time.
GridBot execution only.
Vikram triggers, tests and approves.
```

Next intended V3 feature:

```text
native electricity price history capture
last 7 days half hourly table
native one year price graph building from captured data only
no fake backfill
```
"""
with diary.open("a", encoding="utf-8") as f:
    f.write(entry)
changes.append("appended V3 creation diary entry")

# Create or update V3 reload note.
reload_file = V3 / "AI_RELOAD_INSTRUCTIONS.md"
with reload_file.open("a", encoding="utf-8") as f:
    f.write("\n\n## V3 reload note\n\nV3 is the experimental build. New energy graph and price history work should happen here first. Do not disturb V2 unless Vikram approves promotion.\n")
changes.append("appended V3 reload instruction")

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text("# Clone UK energy tracker V2 to V3 report\n\n" + "\n".join(f"- {c}" for c in changes) + "\n", encoding="utf-8")

print("V3 clone complete")
for c in changes:
    print(c)
