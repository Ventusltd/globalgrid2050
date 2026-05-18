#!/usr/bin/env python3
"""
V6 Complex Upgrade Installer

Controlled controller for V6 upgrade manifests.

Behaviour:
- Reads active upgrade pointer or explicit arguments
- Reads manifest from solar-bess-topology-v6/upgrades/<upgrade_id>/manifest.yml
- Validates upgrade_id
- Validates target_app
- Validates allowed_paths
- Refuses unsafe paths
- Refuses changes outside solar-bess-topology-v6 unless explicitly allowed
- Applies approved manifest operations when dry_run is false
- Writes a report into gridbot_reports/
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:
    raise SystemExit("PyYAML is required. Install with: pip install pyyaml") from exc

REPO_ROOT = Path(__file__).resolve().parents[1]
V6_ROOT = REPO_ROOT / "solar-bess-topology-v6"
UPGRADES_ROOT = V6_ROOT / "upgrades"
REPORTS_ROOT = REPO_ROOT / "gridbot_reports"
DEFAULT_ACTIVE_FILE = UPGRADES_ROOT / "ACTIVE_UPGRADE.yml"

APP_PATHS = {
    "gis-sld-financial-sandbox": V6_ROOT / "gis-sld-financial-sandbox",
    "module-layout": V6_ROOT / "module-layout",
    "dc-ac-lv-topology-review": V6_ROOT / "dc-ac-lv-topology-review",
    "cable-geometry-visualiser": V6_ROOT / "cable-geometry-visualiser",
    "launcher": V6_ROOT,
    "docs": V6_ROOT / "docs",
}

SAFE_UPGRADE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")
SUPPORTED_OPERATIONS = {
    "replace",
    "regex_replace",
    "insert_after",
    "insert_before",
    "assert_contains",
}


class UpgradeError(Exception):
    pass


def parse_bool(value: str | bool | None, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    v = str(value).strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")


def rel(path: Path) -> str:
    try:
        return str(path.resolve(strict=False).relative_to(REPO_ROOT.resolve(strict=False)))
    except ValueError:
        return str(path)


def is_inside(child: Path, parent: Path) -> bool:
    child_resolved = child.resolve(strict=False)
    parent_resolved = parent.resolve(strict=False)
    try:
        child_resolved.relative_to(parent_resolved)
        return True
    except ValueError:
        return False


def safe_repo_path(path_text: str) -> Path:
    if not isinstance(path_text, str) or not path_text.strip():
        raise UpgradeError("Path is empty or not a string.")
    text = path_text.strip()
    parts = Path(text).parts
    if text.startswith("/") or ".." in parts:
        raise UpgradeError(f"Unsafe path refused: {text}")
    return REPO_ROOT / text


def read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise UpgradeError(f"Missing YAML file: {rel(path)}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise UpgradeError(f"YAML file must be a mapping: {rel(path)}")
    return data


def normalise_list(value: Any, field_name: str) -> list[Any]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise UpgradeError(f"Manifest field '{field_name}' must be a list.")
    return value


def validate_upgrade_id(upgrade_id: str) -> None:
    if not upgrade_id or not upgrade_id.strip():
        raise UpgradeError("upgrade_id is empty. Refusing to continue.")
    if not SAFE_UPGRADE_ID.match(upgrade_id):
        raise UpgradeError("upgrade_id contains unsafe characters. Use letters, numbers, dot, underscore or hyphen only.")
    if ".." in upgrade_id or "/" in upgrade_id or "\\" in upgrade_id:
        raise UpgradeError("upgrade_id must be a folder name only. Path traversal is refused.")


def validate_target_app(target_app: str) -> Path:
    if target_app not in APP_PATHS:
        allowed = ", ".join(sorted(APP_PATHS))
        raise UpgradeError(f"Unknown target_app '{target_app}'. Allowed values: {allowed}")
    target_path = APP_PATHS[target_app]
    if not target_path.exists():
        raise UpgradeError(f"target_app path does not exist: {rel(target_path)}")
    if not is_inside(target_path, V6_ROOT):
        raise UpgradeError("target_app resolved outside solar-bess-topology-v6. Refusing to continue.")
    return target_path


def read_active_file(active_file: Path) -> dict[str, Any]:
    if not is_inside(active_file, UPGRADES_ROOT):
        raise UpgradeError("Active upgrade pointer must live inside solar-bess-topology-v6/upgrades.")
    return read_yaml(active_file)


def load_manifest(upgrade_id: str) -> tuple[Path, Path, dict[str, Any]]:
    upgrade_dir = UPGRADES_ROOT / upgrade_id
    manifest_path = upgrade_dir / "manifest.yml"
    if not is_inside(manifest_path, UPGRADES_ROOT):
        raise UpgradeError("Manifest path resolved outside approved V6 upgrades directory. Refusing to continue.")
    manifest = read_yaml(manifest_path)
    return upgrade_dir, manifest_path, manifest


def validate_allowed_paths(manifest: dict[str, Any]) -> tuple[list[str], list[Path]]:
    allowed_paths = normalise_list(manifest.get("allowed_paths"), "allowed_paths")
    if not allowed_paths:
        raise UpgradeError("Manifest allowed_paths is empty. Refusing broad or undefined write scope.")

    allow_outside_v6 = parse_bool(manifest.get("allow_outside_v6"), False)
    validated_text: list[str] = []
    validated_paths: list[Path] = []

    for raw_path in allowed_paths:
        candidate = safe_repo_path(str(raw_path))
        if not allow_outside_v6 and not is_inside(candidate, V6_ROOT):
            raise UpgradeError(f"allowed_path outside solar-bess-topology-v6 refused: {raw_path}")
        validated_text.append(str(raw_path).strip())
        validated_paths.append(candidate)

    return validated_text, validated_paths


def path_allowed(path: Path, allowed_paths: list[Path]) -> bool:
    return any(path.resolve(strict=False) == allowed.resolve(strict=False) or is_inside(path, allowed) for allowed in allowed_paths)


def validate_write_path(path_text: str, allowed_paths: list[Path], allow_outside_v6: bool) -> Path:
    candidate = safe_repo_path(path_text)
    if not allow_outside_v6 and not is_inside(candidate, V6_ROOT):
        raise UpgradeError(f"Operation path outside V6 refused: {path_text}")
    if not path_allowed(candidate, allowed_paths):
        raise UpgradeError(f"Operation path is not inside manifest allowed_paths: {path_text}")
    return candidate


def validate_manifest(manifest: dict[str, Any], upgrade_id: str, target_app: str) -> tuple[list[str], list[Path], list[Any], list[Any]]:
    manifest_upgrade_id = str(manifest.get("upgrade_id", "")).strip()
    manifest_target_app = str(manifest.get("target_app", "")).strip()

    if manifest_upgrade_id != upgrade_id:
        raise UpgradeError(f"Manifest upgrade_id mismatch. Input={upgrade_id}, manifest={manifest_upgrade_id or 'missing'}")
    if manifest_target_app != target_app:
        raise UpgradeError(f"Manifest target_app mismatch. Input={target_app}, manifest={manifest_target_app or 'missing'}")

    validate_target_app(target_app)
    allowed_text, allowed_paths = validate_allowed_paths(manifest)
    operations = normalise_list(manifest.get("operations"), "operations")
    checks = normalise_list(manifest.get("checks"), "checks")

    for op in operations:
        if not isinstance(op, dict):
            raise UpgradeError("Each operation must be a YAML mapping.")
        op_type = str(op.get("type", "")).strip()
        if op_type not in SUPPORTED_OPERATIONS:
            raise UpgradeError(f"Unsupported operation type: {op_type}")
        if op_type != "assert_contains" and "file" not in op:
            raise UpgradeError(f"Operation '{op_type}' requires a file field.")

    return allowed_text, allowed_paths, operations, checks


def apply_overlay_files(upgrade_dir: Path, allowed_paths: list[Path], allow_outside_v6: bool, dry_run: bool) -> list[str]:
    files_dir = upgrade_dir / "files"
    changes: list[str] = []
    if not files_dir.exists():
        return changes

    for source in sorted(files_dir.rglob("*")):
        if source.is_dir():
            continue
        relative_target = source.relative_to(files_dir)
        target = validate_write_path(str(relative_target), allowed_paths, allow_outside_v6)
        changes.append(f"overlay: {rel(target)}")
        if not dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    return changes


def read_text_file(path: Path) -> str:
    if not path.exists():
        raise UpgradeError(f"File missing: {rel(path)}")
    return path.read_text(encoding="utf-8")


def write_text_file(path: Path, text: str, dry_run: bool) -> None:
    if not dry_run:
        path.write_text(text, encoding="utf-8")


def apply_operation(op: dict[str, Any], allowed_paths: list[Path], allow_outside_v6: bool, dry_run: bool) -> str:
    op_type = str(op.get("type", "")).strip()
    file_path = validate_write_path(str(op.get("file", "")), allowed_paths, allow_outside_v6)

    if op_type == "replace":
        find = str(op.get("find", ""))
        replace = str(op.get("replace", ""))
        if not find:
            raise UpgradeError("replace operation requires non empty find text.")
        text = read_text_file(file_path)
        count = text.count(find)
        if count == 0:
            raise UpgradeError(f"Text not found in {rel(file_path)}: {find[:120]}")
        limit = int(op.get("count", 0) or 0)
        new_text = text.replace(find, replace, limit if limit > 0 else -1)
        write_text_file(file_path, new_text, dry_run)
        return f"replace: {rel(file_path)} | {count} match"

    if op_type == "regex_replace":
        pattern = str(op.get("pattern", ""))
        replace = str(op.get("replace", ""))
        if not pattern:
            raise UpgradeError("regex_replace operation requires a pattern.")
        flags_text = str(op.get("flags", ""))
        flags = 0
        if "i" in flags_text:
            flags |= re.IGNORECASE
        if "m" in flags_text:
            flags |= re.MULTILINE
        if "s" in flags_text:
            flags |= re.DOTALL
        text = read_text_file(file_path)
        new_text, count = re.subn(pattern, replace, text, flags=flags)
        if count == 0:
            raise UpgradeError(f"Regex did not match in {rel(file_path)}: {pattern[:120]}")
        write_text_file(file_path, new_text, dry_run)
        return f"regex_replace: {rel(file_path)} | {count} match"

    if op_type == "insert_after":
        marker = str(op.get("marker", ""))
        insert = str(op.get("insert", ""))
        if not marker:
            raise UpgradeError("insert_after operation requires marker.")
        text = read_text_file(file_path)
        index = text.find(marker)
        if index < 0:
            raise UpgradeError(f"Marker not found in {rel(file_path)}: {marker[:120]}")
        position = index + len(marker)
        write_text_file(file_path, text[:position] + insert + text[position:], dry_run)
        return f"insert_after: {rel(file_path)}"

    if op_type == "insert_before":
        marker = str(op.get("marker", ""))
        insert = str(op.get("insert", ""))
        if not marker:
            raise UpgradeError("insert_before operation requires marker.")
        text = read_text_file(file_path)
        index = text.find(marker)
        if index < 0:
            raise UpgradeError(f"Marker not found in {rel(file_path)}: {marker[:120]}")
        write_text_file(file_path, text[:index] + insert + text[index:], dry_run)
        return f"insert_before: {rel(file_path)}"

    if op_type == "assert_contains":
        required = str(op.get("text", ""))
        if not required:
            raise UpgradeError("assert_contains operation requires text.")
        text = read_text_file(file_path)
        if required not in text:
            raise UpgradeError(f"Assertion failed. Missing text in {rel(file_path)}: {required[:120]}")
        return f"assert_contains: {rel(file_path)}"

    raise UpgradeError(f"Unsupported operation type: {op_type}")


def run_checks(checks: list[Any], allowed_paths: list[Path], allow_outside_v6: bool) -> list[str]:
    results: list[str] = []
    for check in checks:
        if isinstance(check, str):
            results.append(f"note: {check}")
            continue
        if not isinstance(check, dict):
            raise UpgradeError("Each check must be a string or YAML mapping.")
        check_type = str(check.get("type", "")).strip()
        if check_type == "assert_contains":
            results.append(apply_operation(check, allowed_paths, allow_outside_v6, dry_run=True))
        else:
            raise UpgradeError(f"Unsupported check type: {check_type}")
    return results


def write_report(
    *,
    upgrade_id: str,
    target_app: str,
    dry_run: bool,
    status: str,
    manifest_path: Path | None,
    allowed_paths: list[str],
    operations: list[Any],
    checks: list[Any],
    applied_changes: list[str],
    check_results: list[str],
    message: str,
) -> Path:
    REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", upgrade_id) or "unknown"
    report_path = REPORTS_ROOT / f"v6_complex_upgrade_{safe_name}_{timestamp}.md"

    lines = [
        f"# V6 Complex Upgrade Report: {upgrade_id}",
        "",
        f"Status: {status}",
        f"UTC timestamp: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        f"Target app: {target_app}",
        f"Dry run: {dry_run}",
        f"Manifest: {rel(manifest_path) if manifest_path else 'not loaded'}",
        "",
        "## Message",
        "",
        message,
        "",
        "## Allowed paths validated",
        "",
    ]

    lines.extend([f"- {path}" for path in allowed_paths] or ["- none"])

    lines.extend(["", "## Operations", "", f"Operations declared: {len(operations)}", ""])
    lines.extend([f"- {change}" for change in applied_changes] or ["- none"])

    lines.extend(["", "## Checks", "", f"Checks declared: {len(checks)}", ""])
    lines.extend([f"- {result}" for result in check_results] or ["- none"])

    lines.extend([
        "",
        "## Controller stance",
        "",
        "No broad rewrite.",
        "No automatic execution on push.",
        "Only manifest approved paths are writable.",
        "V6 remains the testing and modularisation workspace.",
        "V5 remains untouched.",
        "",
    ])

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def resolve_inputs(args: argparse.Namespace) -> tuple[str, str, bool]:
    if args.active_file:
        active_file = safe_repo_path(args.active_file)
        active = read_active_file(active_file)
        upgrade_id = str(active.get("upgrade_id", "")).strip()
        target_app = str(active.get("target_app", "")).strip()
        dry_run = parse_bool(active.get("dry_run"), False)
        return upgrade_id, target_app, dry_run

    if args.upgrade_id and args.target_app:
        return args.upgrade_id, args.target_app, parse_bool(args.dry_run, False)

    if DEFAULT_ACTIVE_FILE.exists():
        active = read_active_file(DEFAULT_ACTIVE_FILE)
        upgrade_id = str(active.get("upgrade_id", "")).strip()
        target_app = str(active.get("target_app", "")).strip()
        dry_run = parse_bool(active.get("dry_run"), False)
        return upgrade_id, target_app, dry_run

    raise UpgradeError("No active upgrade file and no explicit upgrade arguments supplied.")


def run(args: argparse.Namespace) -> int:
    manifest_path: Path | None = None
    allowed_text: list[str] = []
    allowed_paths: list[Path] = []
    operations: list[Any] = []
    checks: list[Any] = []
    applied_changes: list[str] = []
    check_results: list[str] = []
    upgrade_id = "unknown"
    target_app = "unknown"
    dry_run = True

    try:
        upgrade_id, target_app, dry_run = resolve_inputs(args)
        validate_upgrade_id(upgrade_id)
        validate_target_app(target_app)
        upgrade_dir, manifest_path, manifest = load_manifest(upgrade_id)
        allowed_text, allowed_paths, operations, checks = validate_manifest(manifest, upgrade_id, target_app)
        allow_outside_v6 = parse_bool(manifest.get("allow_outside_v6"), False)

        applied_changes.extend(apply_overlay_files(upgrade_dir, allowed_paths, allow_outside_v6, dry_run))
        for op in operations:
            applied_changes.append(apply_operation(op, allowed_paths, allow_outside_v6, dry_run))
        check_results.extend(run_checks(checks, allowed_paths, allow_outside_v6))

        mode = "validated" if dry_run else "installed"
        message = f"Manifest read, target app validated, paths validated and upgrade {mode}."
        status = "PASS"
        exit_code = 0
    except UpgradeError as exc:
        message = str(exc)
        status = "FAIL"
        exit_code = 1

    report_path = write_report(
        upgrade_id=upgrade_id,
        target_app=target_app,
        dry_run=dry_run,
        status=status,
        manifest_path=manifest_path,
        allowed_paths=allowed_text,
        operations=operations,
        checks=checks,
        applied_changes=applied_changes,
        check_results=check_results,
        message=message,
    )

    print(f"Report written: {rel(report_path)}")
    print(message)
    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Install or validate an approved V6 complex upgrade manifest.")
    parser.add_argument("--active-file", help="Active upgrade pointer YAML under solar-bess-topology-v6/upgrades/")
    parser.add_argument("--upgrade-id", help="Upgrade folder name under solar-bess-topology-v6/upgrades/")
    parser.add_argument("--target-app", choices=sorted(APP_PATHS), help="Approved V6 target app")
    parser.add_argument("--dry-run", default=None, help="Override dry run flag when explicit upgrade arguments are used.")
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
