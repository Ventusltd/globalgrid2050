#!/usr/bin/env python3
"""
V6 Complex Upgrade Installer

Safe scaffold controller for future V6 upgrade manifests.

Current behaviour:
- Reads manifest from solar-bess-topology-v6/upgrades/<upgrade_id>/manifest.yml
- Validates upgrade_id
- Validates target_app
- Validates allowed paths
- Refuses unsafe paths
- Refuses changes outside solar-bess-topology-v6 unless manifest explicitly allows it
- Writes a report into gridbot_reports/
- Does not apply complex operations yet
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
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

APP_PATHS = {
    "gis-sld-financial-sandbox": V6_ROOT / "gis-sld-financial-sandbox",
    "module-layout": V6_ROOT / "module-layout",
    "dc-ac-lv-topology-review": V6_ROOT / "dc-ac-lv-topology-review",
    "cable-geometry-visualiser": V6_ROOT / "cable-geometry-visualiser",
    "launcher": V6_ROOT,
    "docs": V6_ROOT / "docs",
}

SAFE_UPGRADE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")


class UpgradeError(Exception):
    pass


def parse_bool(value: str | bool) -> bool:
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


def load_manifest(upgrade_id: str) -> tuple[Path, dict[str, Any]]:
    manifest_path = UPGRADES_ROOT / upgrade_id / "manifest.yml"
    if not is_inside(manifest_path, UPGRADES_ROOT):
        raise UpgradeError("Manifest path resolved outside approved V6 upgrades directory. Refusing to continue.")
    if not manifest_path.exists():
        raise UpgradeError(f"Missing manifest: {rel(manifest_path)}")
    with manifest_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise UpgradeError("Manifest must be a YAML mapping.")
    return manifest_path, data


def validate_allowed_paths(manifest: dict[str, Any]) -> list[str]:
    allowed_paths = normalise_list(manifest.get("allowed_paths"), "allowed_paths")
    if not allowed_paths:
        raise UpgradeError("Manifest allowed_paths is empty. Refusing broad or undefined write scope.")

    allow_outside_v6 = bool(manifest.get("allow_outside_v6", False))
    validated: list[str] = []

    for raw_path in allowed_paths:
        if not isinstance(raw_path, str) or not raw_path.strip():
            raise UpgradeError("allowed_paths entries must be non empty strings.")
        candidate_text = raw_path.strip()
        candidate_parts = Path(candidate_text).parts
        if candidate_text.startswith("/") or ".." in candidate_parts:
            raise UpgradeError(f"Unsafe allowed path refused: {candidate_text}")
        candidate = REPO_ROOT / candidate_text
        if not allow_outside_v6 and not is_inside(candidate, V6_ROOT):
            raise UpgradeError(f"allowed_path outside solar-bess-topology-v6 refused: {candidate_text}")
        validated.append(candidate_text)

    return validated


def validate_manifest(manifest: dict[str, Any], upgrade_id: str, target_app: str) -> tuple[list[str], list[Any], list[Any]]:
    manifest_upgrade_id = str(manifest.get("upgrade_id", "")).strip()
    manifest_target_app = str(manifest.get("target_app", "")).strip()

    if manifest_upgrade_id != upgrade_id:
        raise UpgradeError(f"Manifest upgrade_id mismatch. Input={upgrade_id}, manifest={manifest_upgrade_id or 'missing'}")
    if manifest_target_app != target_app:
        raise UpgradeError(f"Manifest target_app mismatch. Input={target_app}, manifest={manifest_target_app or 'missing'}")

    allowed_paths = validate_allowed_paths(manifest)
    operations = normalise_list(manifest.get("operations"), "operations")
    checks = normalise_list(manifest.get("checks"), "checks")

    return allowed_paths, operations, checks


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

    if allowed_paths:
        lines.extend([f"- {path}" for path in allowed_paths])
    else:
        lines.append("- none")

    lines.extend([
        "",
        "## Operations",
        "",
        f"Operations declared: {len(operations)}",
        "",
        "This scaffold validates operations but does not execute them yet.",
        "",
        "## Checks",
        "",
        f"Checks declared: {len(checks)}",
        "",
        "## Controller stance",
        "",
        "No broad rewrite.",
        "No automatic execution on push.",
        "No app code changes are performed by this scaffold.",
        "Formal upgrade operations require a later approved controller layer.",
        "",
    ])

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def run(args: argparse.Namespace) -> int:
    manifest_path: Path | None = None
    allowed_paths: list[str] = []
    operations: list[Any] = []
    checks: list[Any] = []

    try:
        validate_upgrade_id(args.upgrade_id)
        validate_target_app(args.target_app)
        manifest_path, manifest = load_manifest(args.upgrade_id)
        allowed_paths, operations, checks = validate_manifest(manifest, args.upgrade_id, args.target_app)
        message = "Manifest read, target app validated, paths validated and report written. No operations executed in scaffold phase."
        status = "PASS"
        exit_code = 0
    except UpgradeError as exc:
        message = str(exc)
        status = "FAIL"
        exit_code = 1

    report_path = write_report(
        upgrade_id=args.upgrade_id or "unknown",
        target_app=args.target_app or "unknown",
        dry_run=args.dry_run,
        status=status,
        manifest_path=manifest_path,
        allowed_paths=allowed_paths,
        operations=operations,
        checks=checks,
        message=message,
    )

    print(f"Report written: {rel(report_path)}")
    print(message)
    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and report a V6 complex upgrade manifest.")
    parser.add_argument("--upgrade-id", required=True, help="Upgrade folder name under solar-bess-topology-v6/upgrades/")
    parser.add_argument("--target-app", required=True, choices=sorted(APP_PATHS), help="Approved V6 target app")
    parser.add_argument("--dry-run", type=parse_bool, default=True, help="Dry run flag. Scaffold phase validates only.")
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
