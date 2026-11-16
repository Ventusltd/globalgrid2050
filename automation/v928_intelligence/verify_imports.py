"""Verify selected corrected News/Grid import bytes; never fetch or publish."""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args(argv)
    root = args.repo.resolve()
    manifest = json.loads(Path(__file__).with_name("import-pins.json").read_text(encoding="utf-8"))
    failures = []
    for row in manifest["files"]:
        path = root / row["path"]
        if not path.is_file():
            failures.append({"path": row["path"], "reason": "missing"})
        elif sha256(path.read_bytes()).hexdigest() != row["sha256"]:
            failures.append({"path": row["path"], "reason": "source bytes differ"})
    for name in manifest["existing_dependency_paths"]:
        if not (root / name).is_file():
            failures.append({"path": name, "reason": "existing dependency missing"})
    print(json.dumps({"result": "FAIL" if failures else "PASS",
                      "selected_files": len(manifest["files"]), "failures": failures,
                      "scope": "Selected source-byte identity only; no evidence, rights, browser or publication acceptance."}, indent=2))
    return 2 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
