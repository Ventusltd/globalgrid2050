#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-electrical-topology-review"

for name in ["index.html", "bess-electrical-topology-review.css", "bess-electrical-topology-review.js", "README.md"]:
    assert (APP / name).exists(), f"Missing {name}"

index = (APP / "index.html").read_text(encoding="utf-8")
css = (APP / "bess-electrical-topology-review.css").read_text(encoding="utf-8")
js = (APP / "bess-electrical-topology-review.js").read_text(encoding="utf-8")
launcher = (ROOT / "solar-bess-topology-v8" / "index.html").read_text(encoding="utf-8")
readme = (ROOT / "solar-bess-topology-v8" / "README.md").read_text(encoding="utf-8")
report = (ROOT / "gridbot_reports" / "create_v8_bess_electrical_topology_review.md").read_text(encoding="utf-8")

for token in [
    "BESS Electrical Topology Review",
    "bess_power_mw",
    "dc_voltage",
    "parallel_sets",
    "r_ohm_km",
    "x_ohm_km",
    "pcs_tx_arrangement",
    "dc_imd",
    "dc_leakage",
    "reverse_current",
    "protection_status",
    "bess_scada",
]:
    assert token in index, token

for token in [
    "function updateBessTopology",
    "function drawScada",
    "out_total_dc_current",
    "out_current_per_set",
    "out_r_path",
    "out_x_path",
    "out_z_path",
    "Protection coordination",
]:
    assert token in js, token

assert "scada-dc" in css
assert "bess-electrical-topology-review/index.html" in launcher
assert "bess-electrical-topology-review/" in readme
assert "No V7 files are modified" in report

print("V8 BESS electrical topology review checks passed.")
