#!/usr/bin/env python3
"""Create V8 BESS Electrical Topology Review app.

This is the BESS equivalent of the V7 DC AC LV topology review, but it is
created under V8 so V7 can remain stable.

Scope:
- BESS DC interface to PCS
- PCS to transformer arrangement
- cable R, X, Z placeholder and screening calculations
- protection coordination and reverse current validation flags
- leakage and insulation monitoring flags
- SCADA style topology panel
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V8 = ROOT / "solar-bess-topology-v8"
APP = V8 / "bess-electrical-topology-review"
REPORT = ROOT / "gridbot_reports" / "create_v8_bess_electrical_topology_review.md"

INDEX = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>BESS Electrical Topology Review V8 | GlobalGrid2050</title>
<link rel="stylesheet" href="./bess-electrical-topology-review.css" />
</head>
<body>
<div class="app-shell">
  <header class="app-header">
    <div>
      <div class="kicker">GlobalGrid2050 V8</div>
      <h1>BESS Electrical Topology Review</h1>
      <p>Standalone engineering review app for BESS DC interface, PCS, transformer connection, cable impedance, reverse current protection, leakage protection and protection coordination screening.</p>
    </div>
    <div class="header-links">
      <button id="btn_print" class="link-btn" type="button" onclick="window.print()">Print</button>
      <a class="link-btn" href="../index.html">Back to V8</a>
      <a class="link-btn" href="../../solar-bess-topology-v7/index.html">V7 Stable</a>
    </div>
  </header>

  <main class="main-grid">
    <section class="panel input-panel">
      <h2>1. BESS DC Interface</h2>
      <label>BESS Power MW</label><input id="bess_power_mw" type="number" value="50" min="0" step="1" />
      <label>BESS Energy MWh</label><input id="bess_energy_mwh" type="number" value="100" min="0" step="1" />
      <label>Nominal DC Voltage V</label><input id="dc_voltage" type="number" value="1500" min="1" step="50" />
      <label>Parallel DC Cable Sets</label><input id="parallel_sets" type="number" value="10" min="1" step="1" />
      <label>One Way DC Route Length m</label><input id="dc_route_m" type="number" value="30" min="0" step="1" />
      <label>Conductor Size mm²</label><input id="conductor_mm2" type="number" value="300" min="1" step="1" />
      <label>Conductor Material</label><select id="conductor_material"><option value="al" selected>Aluminium</option><option value="cu">Copper</option></select>
      <label>Resistance R ohm per km</label><input id="r_ohm_km" type="number" value="0.125" min="0" step="0.001" />
      <label>Reactance X ohm per km</label><input id="x_ohm_km" type="number" value="0.080" min="0" step="0.001" />
      <label>Installation Basis</label><select id="installation_basis"><option value="unknown">Unknown</option><option value="buried" selected>Buried or ducted underground</option><option value="trench">Open trench or trough</option><option value="free_air">Ladder or free air section</option></select>

      <h2>2. PCS and AC Interface</h2>
      <label>PCS Quantity</label><input id="pcs_qty" type="number" value="10" min="1" step="1" />
      <label>Total PCS Rating MW</label><input id="pcs_total_mw" type="number" value="50" min="0" step="1" />
      <label>PCS to Transformer Arrangement</label><select id="pcs_tx_arrangement"><option value="unknown">Unknown</option><option value="integrated" selected>Integrated PCS transformer station</option><option value="separated">Separated PCS and transformer station</option></select>
      <label>LV AC Voltage V</label><input id="ac_voltage" type="number" value="690" min="1" step="10" />
      <label>Transformer Rating MVA</label><input id="tx_mva" type="number" value="5" min="0" step="0.1" />
      <label>Transformer Impedance Confirmed</label><select id="tx_impedance_confirmed"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>

      <h2>3. Protection and Leakage Validation</h2>
      <label>DC Insulation Monitoring Confirmed</label><select id="dc_imd"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>DC Leakage Protection Confirmed</label><select id="dc_leakage"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>Reverse Current Protection Confirmed</label><select id="reverse_current"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>DC Disconnector Rating Confirmed</label><select id="dc_disconnector"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>DC Short Circuit Withstand Confirmed</label><select id="dc_fault_withstand"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>Cable R and X Confirmed From Datasheet</label><select id="rx_confirmed"><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label>Protection Coordination Status</label><select id="protection_status"><option value="not_started">Not started</option><option value="data_missing">Data missing</option><option value="preliminary">Preliminary check</option><option value="formal_required" selected>Formal study required</option><option value="validated">Validated by engineer</option></select>
    </section>

    <section class="panel results-panel">
      <h2>Topology Results</h2>
      <div class="stat"><span>Total DC Current</span><strong id="out_total_dc_current">0 A</strong></div>
      <div class="stat"><span>Current per DC Cable Set</span><strong id="out_current_per_set">0 A</strong></div>
      <div class="stat"><span>Energy Duration</span><strong id="out_duration">0 h</strong></div>
      <div class="stat"><span>MW per PCS</span><strong id="out_mw_per_pcs">0 MW</strong></div>
      <div class="stat"><span>Estimated DC R Path</span><strong id="out_r_path">0 ohm</strong></div>
      <div class="stat"><span>Estimated DC X Path</span><strong id="out_x_path">0 ohm</strong></div>
      <div class="stat"><span>Estimated DC Z Path</span><strong id="out_z_path">0 ohm</strong></div>
      <div class="stat"><span>Indicative DC Voltage Drop</span><strong id="out_vdrop">0 %</strong></div>
      <div class="stat"><span>PCS Match Status</span><strong id="out_pcs_match">Check</strong></div>
      <div class="stat"><span>Electrical Validation Status</span><strong id="out_validation_status">Check</strong></div>
      <div id="status_box" class="status-box">Ready.</div>

      <div class="note">
        Screening only. This app does not replace formal load flow, short circuit calculation, protection grading, insulation coordination, earthing design, harmonic study, manufacturer interface review, cable thermal study or IFC design.
      </div>

      <h2>Required formal studies</h2>
      <ul id="required_studies"></ul>
    </section>

    <section class="panel diagram-panel">
      <div class="diagram-title">SCADA Style BESS Topology Panel</div>
      <svg id="bess_scada" viewBox="0 0 1200 720" role="img" aria-label="BESS electrical topology diagram"></svg>
      <div class="diagram-footer"><span>BESS DC terminals</span><span>PCS</span><span>Transformer</span><span>MV Grid Interface</span></div>
    </section>
  </main>
</div>
<script src="./bess-electrical-topology-review.js"></script>
</body>
</html>
"""

CSS = """* { box-sizing: border-box; }
:root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --warn:#ff9900; --bad:#ff3333; }
body { margin:0; background:var(--bg); color:var(--text); font-family:'Courier New', monospace; }
.app-shell { padding:24px; }
.app-header { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; border:1px solid var(--line); background:rgba(10,10,10,.96); border-radius:14px; padding:20px; margin-bottom:18px; }
.kicker { color:var(--accent); letter-spacing:.14em; text-transform:uppercase; font-size:12px; }
h1 { margin:8px 0 8px 0; font-size:28px; }
h2 { color:var(--accent); font-size:18px; margin:20px 0 10px 0; border-bottom:1px solid var(--line); padding-bottom:6px; }
p, .note { color:var(--muted); line-height:1.55; }
.header-links { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
.link-btn { border:1px solid var(--accent); color:var(--accent); background:#050505; border-radius:6px; padding:9px 12px; text-decoration:none; font-family:inherit; cursor:pointer; }
.main-grid { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
.panel { border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:18px; }
.input-panel label { display:block; color:var(--muted); font-size:13px; margin:10px 0 4px 0; }
input, select { width:100%; background:#050505; color:#fff; border:1px solid #444; border-radius:5px; padding:9px; font-family:inherit; }
.stat { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #222; }
.stat span { color:var(--muted); }
.stat strong { color:var(--ok); text-align:right; }
.status-box { margin-top:14px; padding:14px; border-radius:10px; border:1px solid var(--warn); color:var(--warn); background:rgba(255,153,0,.08); line-height:1.5; }
.status-box.good { border-color:var(--ok); color:var(--ok); background:rgba(0,255,136,.08); }
.status-box.bad { border-color:var(--bad); color:var(--bad); background:rgba(255,51,51,.08); }
.note { margin-top:14px; border:1px dashed #444; padding:12px; border-radius:10px; }
ul { color:var(--muted); line-height:1.6; }
.diagram-panel { grid-column:1 / -1; }
.diagram-title { color:var(--accent); font-weight:bold; margin-bottom:12px; }
svg { width:100%; height:auto; background:#030303; border:1px solid #222; border-radius:10px; }
.diagram-footer { display:flex; justify-content:space-between; color:var(--muted); font-size:13px; margin-top:8px; }
.scada-box { fill:#081018; stroke:#00ffff; stroke-width:2; }
.scada-warn { fill:#1b1205; stroke:#ff9900; stroke-width:2; }
.scada-bad { fill:#190505; stroke:#ff3333; stroke-width:2; }
.scada-text { fill:#ffffff; font-family:'Courier New', monospace; font-size:22px; font-weight:bold; }
.scada-small { fill:#a6adbb; font-family:'Courier New', monospace; font-size:16px; }
.scada-line { stroke:#00ff88; stroke-width:4; fill:none; }
.scada-dc { stroke:#ff9900; stroke-width:5; fill:none; }
@media (max-width: 900px) { .app-shell { padding:14px; } .app-header { flex-direction:column; } .main-grid { grid-template-columns:1fr; } }
@media print { body { background:#fff; color:#000; } .app-header, .panel { border-color:#000; background:#fff; } .link-btn { display:none; } }
"""

JS = """function num(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function val(id) {
  return document.getElementById(id)?.value || 'unknown';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function updateBessTopology() {
  const bessMw = num('bess_power_mw');
  const bessMwh = num('bess_energy_mwh');
  const dcV = num('dc_voltage', 1500);
  const sets = Math.max(1, num('parallel_sets', 1));
  const routeM = num('dc_route_m');
  const rKm = num('r_ohm_km');
  const xKm = num('x_ohm_km');
  const pcsQty = Math.max(1, num('pcs_qty', 1));
  const pcsMw = num('pcs_total_mw');

  const totalCurrent = dcV > 0 ? (bessMw * 1000000) / dcV : 0;
  const currentPerSet = totalCurrent / sets;
  const duration = bessMw > 0 ? bessMwh / bessMw : 0;
  const mwPerPcs = pcsMw / pcsQty;

  const km = routeM / 1000;
  const rPath = sets > 0 ? (2 * rKm * km) / sets : 0;
  const xPath = sets > 0 ? (2 * xKm * km) / sets : 0;
  const zPath = Math.sqrt((rPath * rPath) + (xPath * xPath));
  const vdrop = dcV > 0 ? ((totalCurrent * rPath) / dcV) * 100 : 0;

  setText('out_total_dc_current', fmt(totalCurrent, 0) + ' A');
  setText('out_current_per_set', fmt(currentPerSet, 0) + ' A');
  setText('out_duration', fmt(duration, 2) + ' h');
  setText('out_mw_per_pcs', fmt(mwPerPcs, 2) + ' MW');
  setText('out_r_path', fmt(rPath, 5) + ' ohm');
  setText('out_x_path', fmt(xPath, 5) + ' ohm');
  setText('out_z_path', fmt(zPath, 5) + ' ohm');
  setText('out_vdrop', fmt(vdrop, 3) + ' %');

  const pcsMismatch = Math.abs(pcsMw - bessMw) > Math.max(1, bessMw * 0.05);
  setText('out_pcs_match', pcsMismatch ? 'PCS and BESS MW mismatch' : 'PCS rating aligned');

  const required = [];
  const warnings = [];
  const critical = [];

  if (currentPerSet > 300) warnings.push('High current per DC cable set');
  if (routeM > 100) warnings.push('Long DC route, voltage drop and thermal review required');
  if (val('installation_basis') === 'unknown') critical.push('Installation basis unknown');
  if (val('pcs_tx_arrangement') === 'separated') warnings.push('Separated PCS and transformer station needs AC cable and protection interface review');
  if (val('pcs_tx_arrangement') === 'unknown') critical.push('PCS to transformer arrangement unknown');
  if (val('dc_imd') !== 'yes') critical.push('DC insulation monitoring not confirmed');
  if (val('dc_leakage') !== 'yes') critical.push('DC leakage protection not confirmed');
  if (val('reverse_current') !== 'yes') critical.push('Reverse current protection not confirmed');
  if (val('dc_disconnector') !== 'yes') warnings.push('DC disconnector rating not confirmed');
  if (val('dc_fault_withstand') !== 'yes') critical.push('DC short circuit withstand not confirmed');
  if (val('rx_confirmed') !== 'yes') warnings.push('Cable R and X not confirmed from datasheet');
  if (val('tx_impedance_confirmed') !== 'yes') warnings.push('Transformer impedance not confirmed');
  if (val('protection_status') !== 'validated') critical.push('Protection coordination not validated');
  if (pcsMismatch) warnings.push('PCS total MW does not align with BESS MW');

  required.push('BESS to PCS DC cable thermal calculation');
  required.push('DC insulation monitoring and leakage protection review');
  required.push('Reverse current protection and battery source contribution review');
  required.push('Cable R, X, Z confirmation from manufacturer datasheet');
  required.push('PCS to transformer AC interface review');
  required.push('Short circuit and protection coordination study');

  const status = document.getElementById('status_box');
  if (status) {
    status.className = 'status-box';
    if (critical.length) {
      status.classList.add('bad');
      status.textContent = 'RED: formal BESS electrical protection and cable study required. ' + critical.join('; ') + '.';
      setText('out_validation_status', 'Red, formal study required');
    } else if (warnings.length) {
      status.textContent = 'AMBER: assumptions incomplete. ' + warnings.join('; ') + '.';
      setText('out_validation_status', 'Amber, assumptions incomplete');
    } else {
      status.classList.add('good');
      status.textContent = 'GREEN: key screening flags confirmed. Formal engineering approval is still required.';
      setText('out_validation_status', 'Green, screening flags confirmed');
    }
  }

  const list = document.getElementById('required_studies');
  if (list) list.innerHTML = required.map(item => '<li>' + item + '</li>').join('');

  drawScada({ bessMw, bessMwh, dcV, totalCurrent, currentPerSet, pcsQty, pcsMw, routeM, warnings, critical });
}

function drawScada(data) {
  const svg = document.getElementById('bess_scada');
  if (!svg) return;
  const riskClass = data.critical.length ? 'scada-bad' : (data.warnings.length ? 'scada-warn' : 'scada-box');
  svg.innerHTML = `
    <rect x="50" y="90" width="220" height="120" rx="14" class="${riskClass}" />
    <text x="160" y="135" text-anchor="middle" class="scada-text">BESS</text>
    <text x="160" y="165" text-anchor="middle" class="scada-small">${fmt(data.bessMw,1)} MW / ${fmt(data.bessMwh,1)} MWh</text>

    <path d="M270 150 L470 150" class="scada-dc" />
    <text x="370" y="120" text-anchor="middle" class="scada-small">DC cable sets</text>
    <text x="370" y="185" text-anchor="middle" class="scada-small">${fmt(data.currentPerSet,0)} A per set</text>

    <rect x="470" y="90" width="220" height="120" rx="14" class="scada-box" />
    <text x="580" y="135" text-anchor="middle" class="scada-text">PCS</text>
    <text x="580" y="165" text-anchor="middle" class="scada-small">${data.pcsQty} units / ${fmt(data.pcsMw,1)} MW</text>

    <path d="M690 150 L850 150" class="scada-line" />
    <rect x="850" y="90" width="220" height="120" rx="14" class="scada-box" />
    <text x="960" y="135" text-anchor="middle" class="scada-text">Transformer</text>
    <text x="960" y="165" text-anchor="middle" class="scada-small">LV AC to MV</text>

    <path d="M960 210 L960 330" class="scada-line" />
    <rect x="760" y="330" width="400" height="120" rx="14" class="scada-box" />
    <text x="960" y="375" text-anchor="middle" class="scada-text">MV switchgear / grid interface</text>
    <text x="960" y="405" text-anchor="middle" class="scada-small">Protection, fault level and compliance boundary</text>

    <rect x="80" y="330" width="500" height="210" rx="14" class="${riskClass}" />
    <text x="330" y="375" text-anchor="middle" class="scada-text">Validation Gate</text>
    <text x="330" y="410" text-anchor="middle" class="scada-small">Insulation monitoring</text>
    <text x="330" y="440" text-anchor="middle" class="scada-small">Leakage and reverse current protection</text>
    <text x="330" y="470" text-anchor="middle" class="scada-small">Cable R, X, Z and thermal study</text>
    <text x="330" y="500" text-anchor="middle" class="scada-small">Protection coordination</text>

    <text x="600" y="630" text-anchor="middle" class="scada-small">BESS design is not just MW and MWh. The critical boundary is DC current, cable geometry, leakage, reverse current and protection coordination.</text>
  `;
}

document.addEventListener('input', updateBessTopology);
document.addEventListener('change', updateBessTopology);
document.addEventListener('DOMContentLoaded', updateBessTopology);
"""

README = """# BESS Electrical Topology Review V8

This is the BESS equivalent of the V7 DC AC LV Topology Review app.

It feeds the future V8 main BESS frame app by validating the electrical assumptions behind the BESS to PCS and PCS to transformer interface.

## Scope

The app focuses on 4 zones:

1. BESS DC terminals to PCS.
2. PCS internal conversion boundary.
3. PCS to transformer AC interface.
4. Transformer to MV switchgear and grid interface.

## Main validation themes

- DC current calculation.
- Current per parallel DC cable set.
- Cable resistance, reactance and impedance visibility.
- Reverse current protection.
- DC insulation monitoring.
- DC leakage protection.
- DC disconnector and short circuit withstand confirmation.
- PCS to transformer arrangement, integrated or separated.
- Transformer impedance confirmation.
- Protection coordination status.

## Doctrine

BESS design is not only MW and MWh. The critical engineering boundary is the BESS to PCS DC interface and the PCS to transformer AC interface. Current, leakage, reverse current protection, cable impedance, thermal assumptions and protection coordination must be exposed before any commercial or layout conclusion is trusted.
"""

LAUNCHER = """<!DOCTYPE html>
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
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; }
.card { display:block; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:20px; text-decoration:none; color:var(--text); min-height:180px; }
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
<p>V8 is a standalone BESS study workspace. V7 is left as the stable solar and BESS GIS SLD release for now. V9 may later merge proven solar and BESS logic into one UI.</p>
<div class="warning">STATUS: TESTING AND DEVELOPMENT. Screening only. Formal cable, protection, thermal and grid studies remain required.</div>
</header>
<main class="grid">
<a class="card" href="./bess-pcs-standalone/index.html">
<h2>BESS PCS Standalone</h2>
<p>Standalone BESS to PCS DC link screening app copied from the V7 GIS SLD base for controlled study.</p>
<span>Open app</span>
</a>
<a class="card" href="./bess-electrical-topology-review/index.html">
<h2>BESS Electrical Topology Review</h2>
<p>Detailed BESS engineering review for DC leakage, reverse current protection, PCS interface, cable R, X, Z and protection coordination screening.</p>
<span>Open app</span>
</a>
</main>
</body>
</html>
"""

V8_README = """# GlobalGrid2050 V8

V8 is the standalone BESS study workspace.

V7 is to remain stable for the combined solar and BESS GIS SLD release. V8 is where standalone BESS logic can be tested safely before any future V9 merge back into a unified Solar plus BESS UI.

## Apps

```text
solar-bess-topology-v8/bess-pcs-standalone/
solar-bess-topology-v8/bess-electrical-topology-review/
```

## Doctrine

Geometry first.
Assumptions second.
Screening third.
Formal design only when verified.

## V8 scope

V8 starts with BESS to PCS and BESS electrical topology review only.

## V9 intention

V9 may merge solar and BESS into one UI after the standalone BESS logic is stable.
"""


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    write(APP / "index.html", INDEX)
    write(APP / "bess-electrical-topology-review.css", CSS)
    write(APP / "bess-electrical-topology-review.js", JS)
    write(APP / "README.md", README)
    write(V8 / "index.html", LAUNCHER)
    write(V8 / "README.md", V8_README)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Create V8 BESS Electrical Topology Review",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "Created a BESS equivalent of the V7 DC AC LV topology review app.",
        "",
        "## Destination",
        "",
        "```text",
        "solar-bess-topology-v8/bess-electrical-topology-review/",
        "```",
        "",
        "## Scope",
        "",
        "- BESS DC terminal to PCS interface.",
        "- PCS to transformer arrangement, integrated or separated.",
        "- Cable R, X, Z visibility and indicative voltage drop.",
        "- Reverse current protection validation.",
        "- DC leakage and insulation monitoring validation.",
        "- Protection coordination status flag.",
        "- SCADA style topology drawing.",
        "",
        "## V7 protection",
        "",
        "No V7 files are modified.",
        "",
    ]), encoding="utf-8")
    print("Created V8 BESS Electrical Topology Review app.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
