#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


V8 = Path(__file__).resolve().parents[1]
ROOT = V8.parents[1]
V7 = ROOT / "uk_renewables_pipeline/v7"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main() -> int:
    contract = json.loads((V8 / "contracts/fallback.v8.0.json").read_text(encoding="utf-8"))
    source = contract["source"]

    source_tree = git("rev-parse", f"{source['commit']}:uk_renewables_pipeline/v7")
    assert source_tree == source["v7_tree"], (source_tree, source["v7_tree"])
    assert subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", "uk_renewables_pipeline/v7"],
        cwd=ROOT,
        check=False,
    ).returncode == 0, "V7 working tree changed"

    allowed = set(contract["allowed_inherited_differences"])
    tracked = git(
        "ls-tree",
        "-r",
        "--name-only",
        f"{source['commit']}:uk_renewables_pipeline/v7",
    ).splitlines()
    compared = 0
    for relative in tracked:
        if relative in allowed:
            continue
        old = V7 / relative
        new = V8 / relative
        assert new.is_file(), f"missing inherited V8 file: {relative}"
        assert sha256(new) == sha256(old), f"unexpected V8.0 divergence: {relative}"
        compared += 1

    index = (V8 / "index.html").read_text(encoding="utf-8")
    root_index = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "V8.0 TEST" in index
    assert 'href="../v7/"' in index
    assert 'url:"./uk_renewables_pipeline/v8/"' in root_index

    projects = json.loads((V8 / "data/v7.2/projects.json").read_text(encoding="utf-8"))
    geojson = json.loads((V8 / "data/v7.2/projects.geojson").read_text(encoding="utf-8"))
    coordinates = json.loads((V8 / "fixtures/v7.2/repd_q2_coordinates.json").read_text(encoding="utf-8"))
    expected = contract["canonical_checkpoint"]
    assert projects["project_count"] == expected["project_count"] == len(projects["projects"])
    assert projects["solar_count"] == expected["solar_count"]
    assert projects["bess_count"] == expected["bess_count"]
    assert projects["development_count"] == expected["development_count"]
    assert projects["geometry_count"] == expected["geometry_count"] == len(geojson["features"])
    assert len(coordinates["records"]) == expected["coordinate_record_count"]
    assert all(project.get("geometry_status") for project in projects["projects"])

    print(
        "V8.0 baseline: PASS "
        f"({compared} inherited files, {projects['project_count']} projects, "
        f"{len(geojson['features'])} geometries, V7 fallback unchanged)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
