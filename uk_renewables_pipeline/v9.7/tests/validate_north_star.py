#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from north_star_checks import run_gate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the V7 North Star before or after one feature build.")
    parser.add_argument("--phase", choices=("pre", "post"), required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parents[3]
    contract_path = root / "uk_renewables_pipeline/v7/contracts/north-star.v1.json"
    contract_bytes = contract_path.read_bytes()
    contract = json.loads(contract_bytes)
    gate = run_gate(root, contract, args.phase)
    report = {
        "schema": "globalgrid2050.v7.north-star-report.v1",
        "phase": args.phase,
        "target_release": contract["target_release"],
        "feature": contract["feature"],
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "contract_sha256": hashlib.sha256(contract_bytes).hexdigest(),
        "result": "PASS" if gate.passed else "FAIL",
        "metrics": gate.metrics,
        "checks": gate.checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    failures = [check for check in gate.checks if not check["passed"]]
    print(f"North Star {args.phase}: {report['result']} ({len(gate.checks)} checks, {len(failures)} failures)")
    for failure in failures:
        print(f"FAIL: {failure['name']} actual={failure.get('actual')} expected={failure.get('expected')}")
    return 0 if gate.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
