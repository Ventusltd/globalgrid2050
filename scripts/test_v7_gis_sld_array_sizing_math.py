#!/usr/bin/env python3
"""Static and maths checks for V7 GIS SLD array MWp sizing."""
from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"


def string_sizing(target_mwp, mod_wp, x_mods, z_strings, y_invs, current_skids_per_ring):
    dc_per_skid = (mod_wp * x_mods * z_strings * y_invs) / 1_000_000
    desired_skids = max(1, math.ceil(target_mwp / dc_per_skid))
    rings = max(1, math.ceil(desired_skids / current_skids_per_ring))
    skids_per_ring = max(1, math.ceil(desired_skids / rings))
    actual_skids = skids_per_ring * rings
    actual_mwp = actual_skids * dc_per_skid
    return dc_per_skid, desired_skids, skids_per_ring, rings, actual_skids, actual_mwp


def central_sizing(target_mwp, inv_dc_mwp, inv_per_skid, current_skids_per_ring):
    desired_inverters = max(1, math.ceil(target_mwp / inv_dc_mwp))
    desired_skids = max(1, math.ceil(desired_inverters / inv_per_skid))
    rings = max(1, math.ceil(desired_skids / current_skids_per_ring))
    skids_per_ring = max(1, math.ceil(desired_skids / rings))
    actual_inverters = inv_per_skid * skids_per_ring * rings
    actual_mwp = actual_inverters * inv_dc_mwp
    return desired_inverters, desired_skids, skids_per_ring, rings, actual_inverters, actual_mwp


def main():
    index = (APP / "index.html").read_text(encoding="utf-8")
    ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
    drawing = (APP / "gis-sld-v5-drawing.js").read_text(encoding="utf-8")
    state = (APP / "gis-sld-v5-state.js").read_text(encoding="utf-8")

    for token in ["btn_array_toggle", "map_target_dc_mwp", "target_dc_mwp", "target_dc_mwp_c"]:
        assert token in index, token
    for token in ["toggleArrayVisibility", "applyTargetDcMwpFromActiveTab", "wireArraySizingControls"]:
        assert token in ui, token
    assert "arrayVisible: true" in state
    assert "setTopologyLayerVisibility?.(state.arrayVisible !== false);" in drawing

    # Default string mode maths: 660 W, 28 modules, 18 strings, 28 inverters.
    dc_per_skid, desired_skids, skids_per_ring, rings, actual_skids, actual_mwp = string_sizing(
        100, 660, 28, 18, 28, 5
    )
    assert round(dc_per_skid, 6) == round((660 * 28 * 18 * 28) / 1_000_000, 6)
    assert actual_skids >= desired_skids
    assert actual_mwp >= 100
    assert skids_per_ring >= 1 and rings >= 1

    # Default central mode maths: 5.28 MWdc inverter, 1 inverter per skid, 4 skids per ring.
    desired_inv, desired_skids, skids_per_ring, rings, actual_inv, actual_mwp = central_sizing(
        100, 5.28, 1, 4
    )
    assert actual_inv >= desired_inv
    assert actual_mwp >= 100
    assert skids_per_ring >= 1 and rings >= 1

    print("V7 GIS SLD array sizing static and maths checks passed.")


if __name__ == "__main__":
    main()
