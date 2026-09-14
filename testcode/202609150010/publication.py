#!/usr/bin/env python3
"""Write the candidate's non-self-referential byte and SHA-256 manifest."""

import hashlib
import json
import subprocess
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
owned = [
    p for p in sorted(HERE.rglob("*"))
    if p.is_file() and p.name not in {"publication.json"} and "__pycache__" not in p.parts
]
files = []
for path in owned:
    data = path.read_bytes()
    files.append({
        "path": path.relative_to(ROOT).as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    })
payload = {
    "schema": "globalgrid2050.testcode-publication.v1",
    "stamp": "202609150010",
    "status": "test-only candidate; not promoted",
    "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "files": files,
}
(HERE / "publication.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": len(files), "publication": str(HERE / "publication.json")}, indent=2))
