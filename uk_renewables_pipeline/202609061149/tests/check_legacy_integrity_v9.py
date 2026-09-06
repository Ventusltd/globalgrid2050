#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path


V9_DIR = Path(__file__).resolve().parents[1]
REPO = V9_DIR.parents[1]
CONTRACT = json.loads((V9_DIR / "contracts/legacy-integrity.v9.json").read_text())


def git_object(path: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(REPO), "rev-parse", f"HEAD:{path}"],
        text=True,
    ).strip()


checks = 0
for version, marker in CONTRACT["versions"].items():
    path = marker["path"]
    actual_object = git_object(path)
    expected_object = marker.get("git_blob") or marker.get("git_tree")
    assert actual_object == expected_object, f"{version} Git object changed: {actual_object}"
    checks += 1
    if "sha256" in marker:
        actual_sha = hashlib.sha256((REPO / path).read_bytes()).hexdigest()
        assert actual_sha == marker["sha256"], f"{version} SHA-256 changed: {actual_sha}"
        checks += 1

assert CONTRACT["policy"]["prior_versions_are_read_only"] is True
assert CONTRACT["policy"]["history_is_evidence_not_ai_memory"] is True
print(f"V9 legacy integrity: PASS ({checks} immutable V1–V8 markers)")
