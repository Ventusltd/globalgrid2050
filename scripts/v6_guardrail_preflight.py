#!/usr/bin/env python3
"""
V6 guardrail preflight checker.

This script is intended to be used as a required GitHub status check.
It does not repair V6. It prevents uncontrolled V6 edits by failing when
V6 application files are changed without the documented repair workflow shape.

Required for any V6 app repair:
- AI_START_HERE.md exists
- uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md exists
- uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md exists
- changed files include scripts/repair_v6_<name>.py
- changed files include .github/workflows/repair_v6_<name>.yml
- changed files include uk_energy_tracking_v6/V6_REPAIR_<NAME>_REPORT.md

Allowed without repair bundle:
- comparison report generation
- architectural integrity protocol generation
- guardrail scripts and workflows themselves
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_BOOT_FILES = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
]

ALLOWED_V6_NON_APP_PATTERNS = [
    re.compile(r"^uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT\.md$"),
    re.compile(r"^uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL\.md$"),
    re.compile(r"^uk_energy_tracking_v6/V6_REPAIR_[A-Z0-9_]+_REPORT\.md$"),
]

ALLOWED_INFRA_PATTERNS = [
    re.compile(r"^scripts/compare_uk_energy_v5_v6\.py$"),
    re.compile(r"^scripts/generate_v6_architectural_integrity_protocol\.py$"),
    re.compile(r"^scripts/v6_guardrail_preflight\.py$"),
    re.compile(r"^\.github/workflows/compare_uk_energy_v5_v6\.yml$"),
    re.compile(r"^\.github/workflows/generate_v6_architectural_integrity_protocol\.yml$"),
    re.compile(r"^\.github/workflows/v6_guardrail_preflight\.yml$"),
]


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=ROOT, text=True).strip()


def changed_files() -> list[str]:
    base = os.environ.get("BASE_SHA")
    head = os.environ.get("HEAD_SHA")
    if base and head:
        out = run(["git", "diff", "--name-only", base, head])
    else:
        out = run(["git", "diff", "--name-only", "HEAD~1", "HEAD"])
    return [line.strip() for line in out.splitlines() if line.strip()]


def matches_any(path: str, patterns: list[re.Pattern[str]]) -> bool:
    return any(p.match(path) for p in patterns)


def is_v6_app_file(path: str) -> bool:
    if not path.startswith("uk_energy_tracking_v6/"):
        return False
    if matches_any(path, ALLOWED_V6_NON_APP_PATTERNS):
        return False
    return True


def is_allowed_infra(path: str) -> bool:
    if matches_any(path, ALLOWED_INFRA_PATTERNS):
        return True
    if re.match(r"^scripts/repair_v6_[a-z0-9_]+\.py$", path):
        return True
    if re.match(r"^\.github/workflows/repair_v6_[a-z0-9_]+\.yml$", path):
        return True
    return False


def main() -> int:
    errors: list[str] = []
    changed = changed_files()

    print("V6 guardrail preflight")
    print("Changed files:")
    for item in changed:
        print(f"- {item}")

    for required in REQUIRED_BOOT_FILES:
        if not (ROOT / required).exists():
            errors.append(f"Missing required boot file: {required}")

    v6_app_changes = [p for p in changed if is_v6_app_file(p)]
    repair_scripts = [p for p in changed if re.match(r"^scripts/repair_v6_[a-z0-9_]+\.py$", p)]
    repair_workflows = [p for p in changed if re.match(r"^\.github/workflows/repair_v6_[a-z0-9_]+\.yml$", p)]
    repair_reports = [p for p in changed if re.match(r"^uk_energy_tracking_v6/V6_REPAIR_[A-Z0-9_]+_REPORT\.md$", p)]

    if v6_app_changes:
        print("V6 app files changed:")
        for item in v6_app_changes:
            print(f"- {item}")
        if not repair_scripts:
            errors.append("V6 app files changed but no scripts/repair_v6_<name>.py file changed.")
        if not repair_workflows:
            errors.append("V6 app files changed but no .github/workflows/repair_v6_<name>.yml file changed.")
        if not repair_reports:
            errors.append("V6 app files changed but no uk_energy_tracking_v6/V6_REPAIR_<NAME>_REPORT.md file changed.")

    uncontrolled = []
    for path in changed:
        if path.startswith("uk_energy_tracking_v6/"):
            continue
        if path.startswith("scripts/") or path.startswith(".github/workflows/"):
            if not is_allowed_infra(path):
                uncontrolled.append(path)
    if uncontrolled:
        errors.append("Unexpected scripts or workflow changes detected: " + ", ".join(uncontrolled))

    if errors:
        print("\nV6 GUARDRAIL FAILED")
        for err in errors:
            print(f"ERROR: {err}")
        print("\nRequired sequence: read guardrails, create named repair script, create named repair workflow, write V6 repair report, then commit intended V6 file changes.")
        return 1

    print("\nV6 GUARDRAIL PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
