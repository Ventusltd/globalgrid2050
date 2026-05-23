#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT = ROOT / "solar-bess-topology-v8" / "CODEBASE_BLUEPRINT.md"
REPORT = ROOT / "gridbot_reports" / "generate_v8_codebase_blueprint.md"

assert BLUEPRINT.exists(), "Missing V8 CODEBASE_BLUEPRINT.md"
assert REPORT.exists(), "Missing GridBot report"

text = BLUEPRINT.read_text(encoding="utf-8")
report = REPORT.read_text(encoding="utf-8")

for token in [
    "# GlobalGrid2050 V8 Codebase Blueprint",
    "## Directory Structure",
    "## File Summaries",
    "solar-bess-topology-v8/",
    "bess-pcs-standalone/",
    "bess-electrical-topology-review/",
    "HTML IDs:",
    "Signatures:",
    "DOM IDs referenced:",
]:
    assert token in text, token

assert "solar-bess-topology-v8/CODEBASE_BLUEPRINT.md" in report
assert "Create a compact code skeleton" in report

print("V8 codebase blueprint checks passed.")
