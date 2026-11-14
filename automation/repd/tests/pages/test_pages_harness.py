"""pytest entry points for the page harness (synthetic fixtures only, no network)."""
import csv
import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_standin  # noqa: E402

HEADER = ["Old Ref ID", "Ref ID", "Site Name", "Technology Type", "Installed Capacity (MWelec)",
          "Mounting Type for Solar", "Development Status", "Development Status (short)", "X-coordinate", "Y-coordinate",
          "Planning Permission Granted"]


def _staged(tmp_path, rows, bom=True):
    buf = io.StringIO(newline="")
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(HEADER)
    w.writerows(rows)
    p = tmp_path / "staged.csv"
    p.write_bytes(("﻿" if bom else "").encode() + buf.getvalue().encode("utf-8"))
    return p


ROWS = [
    ["", "1", "Bat Op", "Battery", "50", "", "Operational", "Operational", "1", "1", ""],
    ["", "2", "Bat Refused", "Battery", "50", "", "Application Refused", "Application Refused", "1", "1", ""],
    ["", "3", "Bat Appeal", "Battery", "", "", "Appeal Lodged", "Appeal Lodged", "1", "1", ""],
    ["", "4", "Sol Ground 2", "Solar Photovoltaics", "2", "Ground ", "Operational", "Operational", "1", "1", ""],
    ["", "5", "Sol Float 5", "Solar Photovoltaics", "5", "Floating", "Operational", "Operational", "1", "1", ""],
    ["", "6", "Sol blank cap", "Solar Photovoltaics", "", "Ground", "Operational", "Operational", "1", "1", ""],
    ["", "7", "Sol exactly 1", "Solar Photovoltaics", "1", "Roof", "Operational", "Operational", "1", "1", ""],
    ["", "8", "Sol Roof 4.5 café", "Solar Photovoltaics", "4.5", "Roof", "Operational", "Operational", "1", "1", ""],
]


def test_filters_and_encoding(tmp_path):
    out = tmp_path / "out"
    make_standin.main(["--staged", str(_staged(tmp_path, ROWS)), "--out", str(out)])
    counts = json.loads((out / "STANDIN_COUNTS.json").read_text())
    assert counts == {"repd.csv": 8, "repd-grid-batteries.csv": 2, "repd-solar-operational.csv": 2,
                      "repd-solar-operational-over-4mw.csv": 2}
    for f in ("repd.csv", "repd-grid-batteries.csv", "repd-solar-operational.csv", "repd-solar-operational-over-4mw.csv"):
        b = (out / f).read_bytes()
        assert not b.startswith(b"\xef\xbb\xbf"), f
        b.decode("utf-8")
        assert b"\r\n" not in b
    so = (out / "repd-solar-operational.csv").read_text(encoding="utf-8")
    assert "Sol Ground 2" in so and "café" in so and "blank cap" not in so and "exactly 1" not in so
    so4 = (out / "repd-solar-operational-over-4mw.csv").read_text(encoding="utf-8")
    assert "Sol Float 5" in so4 and "Sol Roof 4.5" in so4


def test_columns_like_subset(tmp_path):
    like = tmp_path / "like.csv"
    like.write_text("Ref ID,Site Name,Are they re-applying (Old REPD Ref) \n", encoding="utf-8")
    with pytest.raises(SystemExit):
        make_standin.main(["--staged", str(_staged(tmp_path, ROWS)), "--out", str(tmp_path / "o"), "--columns-like", str(like)])
    like.write_text("Ref ID,Site Name,Planning Permission  Granted\n", encoding="utf-8")   # double space matches
    make_standin.main(["--staged", str(_staged(tmp_path, ROWS)), "--out", str(tmp_path / "o2"), "--columns-like", str(like)])
    head = (tmp_path / "o2" / "repd-solar-operational.csv").read_text(encoding="utf-8").splitlines()[0]
    assert head == "Ref ID,Site Name,Planning Permission Granted"


def test_missing_column_fails_closed(tmp_path):
    p = tmp_path / "bad.csv"
    p.write_text("Ref ID,Site Name\n1,a\n", encoding="utf-8")
    with pytest.raises(SystemExit):
        make_standin.main(["--staged", str(p), "--out", str(tmp_path / "o")])


@pytest.mark.skipif(shutil.which("node") is None or not (HERE / "node_modules" / "papaparse").exists(),
                    reason="node or node_modules (npm ci) not available")
def test_node_harness_unit_tests():
    r = subprocess.run(["node", "--test", "harness.test.js"], cwd=HERE, capture_output=True, text=True, timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr
