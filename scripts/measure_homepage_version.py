#!/usr/bin/env python3
"""Measure homepage snapshot files for reversible public homepage edits.

This script is intentionally small and dependency-free so it can run in GitHub
Actions and locally without setup. It reports line, word, character, byte and
SHA-256 counts for one or more files.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def measure(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    return {
        "file": str(path),
        "lines": len(text.splitlines()),
        "words": len(text.split()),
        "characters": len(text),
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: measure_homepage_version.py <file> [<file> ...]", file=sys.stderr)
        return 1

    paths = [Path(arg) for arg in sys.argv[1:]]
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        print("missing file(s): " + ", ".join(missing), file=sys.stderr)
        return 2

    results = [measure(path) for path in paths]
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
