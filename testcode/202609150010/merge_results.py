#!/usr/bin/env python3
"""Fail-closed merger for independently computed local and CI results."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def merge(local: dict[str, Any], ci: dict[str, Any]) -> dict[str, Any]:
    if local.get("lane") != "local" or ci.get("lane") != "ci":
        raise ValueError("expected local and ci lanes")
    local_hash = hashlib.sha256(canonical(local["payload"])).hexdigest()
    ci_hash = hashlib.sha256(canonical(ci["payload"])).hexdigest()
    if local_hash != local.get("payload_sha256") or ci_hash != ci.get("payload_sha256"):
        raise ValueError("a lane payload does not match its declared hash")
    if local_hash != ci_hash or local["payload"] != ci["payload"]:
        raise ValueError(f"local/CI divergence: {local_hash} != {ci_hash}")
    if not local["payload"].get("all_checks_pass"):
        raise ValueError("shared payload contains failed checks")
    return {
        "schema": "globalgrid2050.dual-compute-merge.v1",
        "agreement": True,
        "merged_utc": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "payload_sha256": local_hash,
        "lanes": {
            "local": {k: local[k] for k in ("generated_utc", "runner", "git_commit")},
            "ci": {k: ci[k] for k in ("generated_utc", "runner", "git_commit")},
        },
        "payload": local["payload"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=Path, required=True)
    parser.add_argument("--ci", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = merge(json.loads(args.local.read_text(encoding="utf-8")), json.loads(args.ci.read_text(encoding="utf-8")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"agreement": True, "payload_sha256": result["payload_sha256"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
