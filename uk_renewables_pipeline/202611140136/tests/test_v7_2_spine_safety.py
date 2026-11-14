#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch


V7 = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(V7 / "scripts/data"))

from build_v7_2_spine import atomic_write_json, optional_float, project_feature, resolve_geometry  # noqa: E402


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        target = root / "asset.json"
        atomic_write_json(target, {"complete": True})
        assert json.loads(target.read_text(encoding="utf-8")) == {"complete": True}
        assert not list(root.glob(".*.tmp"))

        original = target.read_bytes()
        with patch("build_v7_2_spine.os.replace", side_effect=OSError("simulated replace failure")):
            try:
                atomic_write_json(target, {"complete": False})
            except OSError:
                pass
            else:
                raise AssertionError("simulated atomic replacement failure was not raised")
        assert target.read_bytes() == original
        assert not list(root.glob(".*.tmp"))

    assert optional_float(float("inf")) is None
    for easting, northing, expected in ((None, None, "missing"), (float("inf"), 100.0, "invalid"), (-1.0, 100.0, "invalid")):
        status, longitude, latitude = resolve_geometry(easting, northing)
        assert status == expected and longitude is None and latitude is None
        assert project_feature({"gg_project_id": "GG2050-TEST", "geometry_status": status, "longitude": longitude, "latitude": latitude}) is None

    status, longitude, latitude = resolve_geometry(530000.0, 180000.0)
    assert status == "valid" and longitude is not None and latitude is not None
    feature = project_feature({"gg_project_id": "GG2050-TEST", "geometry_status": status, "longitude": longitude, "latitude": latitude})
    assert feature is not None and feature["geometry"]["coordinates"] == [longitude, latitude]
    print("V7.2 spine safety: PASS (atomic replacement, missing/invalid/valid geometry)")


if __name__ == "__main__":
    main()
