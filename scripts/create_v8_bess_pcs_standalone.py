#!/usr/bin/env python3
"""Create V8 BESS PCS standalone study app from stable V7 GIS SLD sandbox.

This script is intentionally conservative:
- It does not modify V7.
- It copies the V7 GIS SLD sandbox into a new V8 BESS folder.
- It renames the copied app and adds a simple BESS to PCS screening panel.
- It writes a V8 launcher, README and GridBot report.
"""

from __future__ import annotations

import datetime as dt
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
V8 = ROOT / "solar-bess-topology-v8"
DEST = V8 / "bess-pcs-standalone"
REPORT = ROOT / "gridbot_reports" / "create_v8_bess_pcs_standalone.md"

REQUIRED = [
    "index.html",
    "gis-sld-v5.css",
    "gis-sld-v5-config.js",
    "gis-sld-v5-helpers.js",
    "gis-sld-v5-state.js",
    "gis-sld-v5-substations.js",
    "gis-sld-v5-map.js",
    "gis-sld-v5-calculations.js",
    "gis-sld-v5-finance.js",
    "gis-sld-v5-ui-core.js",
    "gis-sld-v5-drawing.js",
    "gis-sld-v5-export.js",
    "gis-sld-v5-ui.js",
]


def ensure_source() -> None:
    missing = [name for name in REQUIRED if not (SRC / name).exists()]
    if missing:
        raise SystemExit("Missing V7 source files: " + ", ".join(missing))


def copy_app() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for name in REQUIRED:
        shutil.copy2(SRC / name, DEST / name)


def patch_index() -> None:
    index = DEST / "index.html"
    text = index.read_text(encoding="utf-8")

    text = text.replace(
        "<title>GIS SLD Financial Sandbox V7</title>",
        "<title>BESS PCS Standalone V8</title>",
    )
    text = text.replace(
        "Solar Photovoltaic (PV) Development, Engineering, Procurement and Construction (EPC) and Grid Analysis",
        "BESS PCS Standalone Study V8",
        1,
    )

    bess_panel = """

    <div class="stat-box" id="bess_pcs_study_box">
        <h3>BESS to PCS Screening</h3>
        <div class="ux-note">Standalone V8 study panel for the DC link between a battery energy storage system and power conversion system. This is a screening tool only. Formal cable sizing requires project specific thermal study, installation data and protection review.</div>
        <div class="input-group"><label>BESS Power (MW)</label><input type="number" id="bess_power_mw" value="50" step="1" min="0" /></div>
        <div class="input-group"><label>DC Voltage (V)</label><input type="number" id="bess_dc_voltage" value="1500" step="50" min="1" /></div>
        <div class="input-group"><label>Parallel DC Cable Sets</label><input type="number" id="bess_parallel_sets" value="10" step="1" min="1" /></div>
        <div class="input-group"><label>Route Length (m)</label><input type="number" id="bess_route_length_m" value="30" step="1" min="0" /></div>
        <div class="input-group"><label>Conductor Size (mm2)</label><input type="number" id="bess_conductor_mm2" value="300" step="1" min="1" /></div>
        <div class="input-group">
            <label>Installation Basis</label>
            <select id="bess_installation_basis">
                <option value="buried">Direct buried or ducted underground</option>
                <option value="trench">Open trench or trough</option>
                <option value="ladder">Ladder or free air section</option>
                <option value="unknown">Unknown, study required</option>
            </select>
        </div>
        <div class="stat-row"><span>Total DC Current:</span><span class="stat-val cyan" id="bess_out_total_current">0 A</span></div>
        <div class="stat-row"><span>Current per Cable Set:</span><span class="stat-val cyan" id="bess_out_set_current">0 A</span></div>
        <div class="stat-row"><span>Study Flag:</span><span class="stat-val orange" id="bess_out_study_flag">Formal thermal study required</span></div>
    </div>
"""

    marker = "    <div class=\"tab-container\">"
    if bess_panel not in text:
        if marker not in text:
            raise SystemExit("Could not find tab container marker in copied V8 index.html")
        text = text.replace(marker, bess_panel + "\n" + marker, 1)

    bess_script = """
<script>
function updateBessPcsStudy() {
    const powerMw = parseFloat(document.getElementById('bess_power_mw')?.value || '0');
    const voltage = parseFloat(document.getElementById('bess_dc_voltage')?.value || '0');
    const sets = Math.max(1, parseFloat(document.getElementById('bess_parallel_sets')?.value || '1'));
    const lengthM = parseFloat(document.getElementById('bess_route_length_m')?.value || '0');
    const installation = document.getElementById('bess_installation_basis')?.value || 'unknown';
    const totalCurrent = voltage > 0 ? (powerMw * 1000000) / voltage : 0;
    const setCurrent = totalCurrent / sets;
    const totalOut = document.getElementById('bess_out_total_current');
    const setOut = document.getElementById('bess_out_set_current');
    const flagOut = document.getElementById('bess_out_study_flag');
    if (totalOut) totalOut.textContent = Math.round(totalCurrent).toLocaleString() + ' A';
    if (setOut) setOut.textContent = Math.round(setCurrent).toLocaleString() + ' A';
    if (flagOut) {
        if (!powerMw || !voltage || installation === 'unknown') {
            flagOut.textContent = 'Input or installation assumption incomplete';
        } else if (setCurrent > 300 || lengthM > 100) {
            flagOut.textContent = 'Formal IEC 60287 or equivalent thermal study required';
        } else {
            flagOut.textContent = 'Screening only, engineering review still required';
        }
    }
}
['bess_power_mw','bess_dc_voltage','bess_parallel_sets','bess_route_length_m','bess_conductor_mm2','bess_installation_basis'].forEach(function(id) {
    document.addEventListener('input', function(event) {
        if (event.target && event.target.id === id) updateBessPcsStudy();
    });
    document.addEventListener('change', function(event) {
        if (event.target && event.target.id === id) updateBessPcsStudy();
    });
});
document.addEventListener('DOMContentLoaded', updateBessPcsStudy);
</script>
"""

    if "function updateBessPcsStudy" not in text:
        text = text.replace("\n</body>", "\n" + bess_script + "\n</body>", 1)

    index.write_text(text, encoding="utf-8")


def write_v8_launcher() -> None:
    V8.mkdir(parents=True, exist_ok=True)
    (V8 / "index.html").write_text("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GlobalGrid2050 V8</title>
<style>
:root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --danger:#ff3333; }
* { box-sizing:border-box; }
body { margin:0; padding:28px; background:var(--bg); color:var(--text); font-family:"Courier New", monospace; }
header, main { max-width:1180px; margin:0 auto 24px auto; }
header { border:1px solid var(--line); background:rgba(10,10,10,.96); padding:22px; border-radius:14px; }
.kicker { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }
h1 { margin:8px 0 10px 0; font-size:28px; }
p { color:var(--muted); line-height:1.55; }
.card { display:block; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:20px; text-decoration:none; color:var(--text); max-width:460px; }
.card:hover { border-color:var(--accent); }
.card h2 { color:var(--accent); margin:0 0 10px 0; }
.card span { color:var(--ok); font-weight:bold; }
.warning { margin-top:14px; padding:14px; border:1px solid var(--danger); border-radius:10px; color:var(--danger); background:rgba(255,51,51,.08); font-weight:bold; }
</style>
</head>
<body>
<header>
<div class="kicker">GlobalGrid2050 V8</div>
<h1>BESS Standalone Study Workspace</h1>
<p>V8 starts as a standalone BESS to PCS study workspace. V7 is left as the stable solar and BESS GIS SLD release for now.</p>
<div class="warning">STATUS: TESTING AND DEVELOPMENT. Screening only. Formal cable, protection, thermal and grid studies remain required.</div>
</header>
<main>
<a class="card" href="./bess-pcs-standalone/index.html">
<h2>BESS PCS Standalone</h2>
<p>Standalone BESS to PCS DC link screening app copied from the V7 GIS SLD base for controlled study.</p>
<span>Open app</span>
</a>
</main>
</body>
</html>
""", encoding="utf-8")

    (V8 / "README.md").write_text("""# GlobalGrid2050 V8

V8 is the standalone BESS to PCS study workspace.

V7 is to remain stable for the combined solar and BESS GIS SLD release. V8 is where standalone BESS logic can be tested safely before any future V9 merge back into a unified Solar plus BESS UI.

## Current app

```text
solar-bess-topology-v8/bess-pcs-standalone/
```

## Doctrine

Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.

## Scope

V8 starts with the BESS to PCS DC link only:

```text
BESS DC terminals -> parallel DC cable sets -> PCS DC input
```

The first screening logic converts BESS MW and DC voltage into total DC current, then divides that current by the number of parallel DC cable sets.

Formal IEC 60287 or equivalent thermal study remains required for real projects.

## V9 intention

V9 may merge solar and BESS into one UI after the standalone BESS logic is stable.
""", encoding="utf-8")


def write_report() -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("""# Create V8 BESS PCS Standalone

Created a standalone V8 BESS to PCS study workspace.

## Source

Copied from:

```text
solar-bess-topology-v7/gis-sld-financial-sandbox/
```

## Destination

```text
solar-bess-topology-v8/bess-pcs-standalone/
```

## Purpose

Leave V7 stable and create a separate V8 app for BESS to PCS logic.

## First logic added

```text
BESS power MW / DC voltage = total DC current
Total DC current / parallel cable sets = current per cable set
```

## Next safe step

Test V8 standalone in the browser before removing any inherited solar UI sections.
""", encoding="utf-8")


def main() -> int:
    ensure_source()
    copy_app()
    patch_index()
    write_v8_launcher()
    write_report()
    print("Created V8 BESS PCS standalone workspace.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
