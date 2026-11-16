"""Load exactly the immutable V9.24 Solar-1000, validating all official rows."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

RELEASE_ID = "202611161244"
MANIFEST_SHA256 = "c625edbb9c471a1e9a9034a1afe99881fbfabb1fcadcf0623355931f5b6aed1f"
BUILD_MANIFEST_SHA256 = "eb59fee0ab9bd4bf304cf7957755e69647038ad2360eabe680848d14e636c304"
ROOT = Path(__file__).resolve().parents[3]


def _read_pinned(path, digest):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"Immutable V9.24 input changed: {path}")
    return json.loads(data)


def load_seed_projects(repo_root=None):
    """Return 1,000 original project dicts plus an `id` alias, never reselection."""
    release = Path(repo_root or ROOT) / "uk_renewables_pipeline" / RELEASE_ID
    seed = _read_pinned(release / "solar1000/manifest.json", MANIFEST_SHA256)
    manifest = _read_pinned(release / "data/v9.1/build_manifest.json", BUILD_MANIFEST_SHA256)
    ids = seed["ids"]
    if len(ids) != 1000 or len(set(ids)) != 1000 or seed["selection_count"] != 1000:
        raise ValueError("Solar-1000 selection count changed")
    projects = []
    for part in manifest["project_partitions"]:
        data = _read_pinned(release / part["path"], part["sha256"])
        if len(data["projects"]) != part["record_count"]:
            raise ValueError("REPD partition count changed")
        projects.extend(data["projects"])
    index = {p["repd_ref"]: p for p in projects}
    solar_ids = sorted((p["repd_ref"] for p in projects if p["technology"] == "solar"), key=int)
    if len(projects) != 7775 or len(index) != 7775 or len(solar_ids) != 3604:
        raise ValueError("Official REPD population changed")
    if ids != solar_ids[:1000]:
        raise ValueError("Solar-1000 differs from V9.24 selection")
    return [dict(index[ref], id=ref) for ref in ids]


if __name__ == "__main__":
    print(f"V9.24 REPD: 7775; immutable Solar-1000: {len(load_seed_projects())}")
