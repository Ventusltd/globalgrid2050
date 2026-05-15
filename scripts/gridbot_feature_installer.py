#!/usr/bin/env python3

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "gridbot_reports"


def log(message: str) -> None:
    print(f"[GridBot] {message}")


def fail(message: str) -> None:
    print(f"[GridBot ERROR] {message}", file=sys.stderr)
    raise SystemExit(1)


def safe_rel(path_text: str) -> Path:
    path = Path(path_text)

    if not path_text or path.is_absolute() or ".." in path.parts:
        fail(f"Unsafe path rejected: {path_text}")

    return path


def read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        fail(f"Missing manifest: {path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}

    if not isinstance(data, dict):
        fail(f"Manifest must be a YAML mapping: {path}")

    return data


def copy_version(source: Path, target: Path, overwrite: bool) -> None:
    source = source.resolve()
    target = target.resolve()

    if not source.exists():
        fail(f"Source folder missing: {source}")

    if source == target:
        log("Source and target are the same folder. Copy step skipped.")
        return

    if target.exists():
        if not overwrite:
            log(f"Target already exists, keeping it: {target.relative_to(REPO_ROOT)}")
            return
        shutil.rmtree(target)

    shutil.copytree(source, target)
    log(f"Copied {source.relative_to(REPO_ROOT)} to {target.relative_to(REPO_ROOT)}")


def apply_overlay_files(feature_dir: Path) -> list[str]:
    installed: list[str] = []
    files_dir = feature_dir / "files"

    if not files_dir.exists():
        return installed

    for source in sorted(files_dir.rglob("*")):
        if source.is_dir():
            continue

        rel = source.relative_to(files_dir)
        target = REPO_ROOT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        installed.append(str(rel))

    return installed


def replace_text(op: dict[str, Any]) -> str:
    file_path = REPO_ROOT / safe_rel(str(op["file"]))
    find = str(op["find"])
    replace = str(op["replace"])

    if not file_path.exists():
        fail(f"File missing: {file_path.relative_to(REPO_ROOT)}")

    text = file_path.read_text(encoding="utf-8")
    count = text.count(find)

    if count == 0:
        fail(f"Text not found in {file_path.relative_to(REPO_ROOT)}: {find[:120]}")

    limit = int(op.get("count", 0) or 0)
    new_text = text.replace(find, replace, limit if limit > 0 else -1)
    file_path.write_text(new_text, encoding="utf-8")

    return f"replace: {file_path.relative_to(REPO_ROOT)} | {count} match"


def regex_replace(op: dict[str, Any]) -> str:
    file_path = REPO_ROOT / safe_rel(str(op["file"]))
    pattern = str(op["pattern"])
    replace = str(op["replace"])
    flags_text = str(op.get("flags", ""))

    if not file_path.exists():
        fail(f"File missing: {file_path.relative_to(REPO_ROOT)}")

    flags = 0
    if "i" in flags_text:
        flags |= re.IGNORECASE
    if "m" in flags_text:
        flags |= re.MULTILINE
    if "s" in flags_text:
        flags |= re.DOTALL

    text = file_path.read_text(encoding="utf-8")
    new_text, count = re.subn(pattern, replace, text, flags=flags)

    if count == 0:
        fail(f"Regex did not match in {file_path.relative_to(REPO_ROOT)}: {pattern[:120]}")

    file_path.write_text(new_text, encoding="utf-8")
    return f"regex_replace: {file_path.relative_to(REPO_ROOT)} | {count} match"


def insert_after(op: dict[str, Any]) -> str:
    file_path = REPO_ROOT / safe_rel(str(op["file"]))
    marker = str(op["marker"])
    insert = str(op["insert"])

    if not file_path.exists():
        fail(f"File missing: {file_path.relative_to(REPO_ROOT)}")

    text = file_path.read_text(encoding="utf-8")
    index = text.find(marker)

    if index < 0:
        fail(f"Marker not found in {file_path.relative_to(REPO_ROOT)}: {marker[:120]}")

    position = index + len(marker)
    new_text = text[:position] + insert + text[position:]
    file_path.write_text(new_text, encoding="utf-8")

    return f"insert_after: {file_path.relative_to(REPO_ROOT)}"


def insert_before(op: dict[str, Any]) -> str:
    file_path = REPO_ROOT / safe_rel(str(op["file"]))
    marker = str(op["marker"])
    insert = str(op["insert"])

    if not file_path.exists():
        fail(f"File missing: {file_path.relative_to(REPO_ROOT)}")

    text = file_path.read_text(encoding="utf-8")
    index = text.find(marker)

    if index < 0:
        fail(f"Marker not found in {file_path.relative_to(REPO_ROOT)}: {marker[:120]}")

    new_text = text[:index] + insert + text[index:]
    file_path.write_text(new_text, encoding="utf-8")

    return f"insert_before: {file_path.relative_to(REPO_ROOT)}"


def assert_contains(op: dict[str, Any]) -> str:
    file_path = REPO_ROOT / safe_rel(str(op["file"]))
    required = str(op["text"])

    if not file_path.exists():
        fail(f"File missing: {file_path.relative_to(REPO_ROOT)}")

    text = file_path.read_text(encoding="utf-8")

    if required not in text:
        fail(f"Assertion failed. Missing text in {file_path.relative_to(REPO_ROOT)}: {required[:120]}")

    return f"assert_contains: {file_path.relative_to(REPO_ROOT)}"


def run_command(command: list[str]) -> None:
    log("Running: " + " ".join(command))
    result = subprocess.run(command, cwd=REPO_ROOT, text=True)
    if result.returncode != 0:
        fail(f"Command failed: {' '.join(command)}")


def install_feature(feature_dir: Path) -> list[str]:
    manifest = read_yaml(feature_dir / "manifest.yml")
    changes: list[str] = []

    log(f"Installing feature: {manifest.get('name', feature_dir.name)}")

    for installed in apply_overlay_files(feature_dir):
        changes.append(f"overlay: {installed}")

    operations = manifest.get("operations", [])

    if not isinstance(operations, list):
        fail(f"operations must be a list in {feature_dir / 'manifest.yml'}")

    for op in operations:
        if not isinstance(op, dict):
            fail("Each operation must be a YAML mapping")

        op_type = str(op.get("type", ""))

        if op_type == "replace":
            changes.append(replace_text(op))
        elif op_type == "regex_replace":
            changes.append(regex_replace(op))
        elif op_type == "insert_after":
            changes.append(insert_after(op))
        elif op_type == "insert_before":
            changes.append(insert_before(op))
        elif op_type == "assert_contains":
            changes.append(assert_contains(op))
        else:
            fail(f"Unsupported operation type: {op_type}")

    return changes


def write_report(target: str, features: list[str], changes: list[str]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    report = REPORT_DIR / f"gridbot_install_{timestamp}.md"

    body = [
        "# GridBot Install Report",
        "",
        f"UTC: {dt.datetime.utcnow().isoformat(timespec='seconds')}Z",
        f"Target: `{target}`",
        "",
        "## Features",
        "",
    ]

    for feature in features:
        body.append(f"- `{feature}`")

    body.extend(["", "## Changes", ""])

    for change in changes:
        body.append(f"- {change}")

    body.append("")
    report.write_text("\n".join(body), encoding="utf-8")
    log(f"Report written: {report.relative_to(REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="GridBot feature installer")
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--features-root", default="feature_requests")
    parser.add_argument("--feature", action="append")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--run-tests", action="store_true")

    args = parser.parse_args()

    source = REPO_ROOT / safe_rel(args.source)
    target = REPO_ROOT / safe_rel(args.target)
    features_root = REPO_ROOT / safe_rel(args.features_root)

    copy_version(source, target, args.overwrite)

    if not features_root.exists():
        fail(f"Feature request folder missing: {features_root}")

    if args.feature:
        feature_dirs = [features_root / name for name in args.feature]
    else:
        feature_dirs = sorted([p for p in features_root.iterdir() if p.is_dir()])

    if not feature_dirs:
        fail("No feature folders found")

    changes: list[str] = []
    installed_names: list[str] = []

    for feature_dir in feature_dirs:
        if not feature_dir.exists():
            fail(f"Feature folder missing: {feature_dir}")

        installed_names.append(feature_dir.name)
        changes.extend(install_feature(feature_dir))

    if args.run_tests:
        run_command(["python", "-m", "compileall", "scripts"])

    write_report(args.target, installed_names, changes)

    log("GridBot install complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
