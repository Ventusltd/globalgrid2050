#!/usr/bin/env python3
"""
V7 Migrate From V6

Creates a brand new V7 folder from the current V6 workspace.

Purpose:
- Preserve V6 as the working version history baseline.
- Create solar-bess-topology-v7 as the next development workspace.
- Copy the full V6 folder, including apps, docs, training, learning objectives and upgrade manifests.
- Relabel safe user-facing V6 references to V7.
- Keep internal legacy file names where changing them would create break risk.
- Write a GridBot migration report.

This script does not edit V6.
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "solar-bess-topology-v6"
V7 = ROOT / "solar-bess-topology-v7"
REPORTS = ROOT / "gridbot_reports"

SAFE_TEXT_EXTENSIONS = {
    ".html",
    ".md",
    ".yml",
    ".yaml",
    ".txt",
    ".css",
    ".js",
}

# Conservative replacements only. Do not rename legacy v5 file names.
REPLACEMENTS = {
    "GlobalGrid2050 V6": "GlobalGrid2050 V7",
    "GIS SLD Financial Sandbox V6": "GIS SLD Financial Sandbox V7",
    "V6 Training Index": "V7 Training Index",
    "V6 Learning Objectives": "V7 Learning Objectives",
    "V6 progress": "V7 progress",
    "V6 Progress": "V7 Progress",
    "V6 workspace": "V7 workspace",
    "V6 Workspace": "V7 Workspace",
    "V6 folder": "V7 folder",
    "V6 Folder": "V7 Folder",
    "V6 is": "V7 is",
    "V6 remains": "V7 remains",
    "V6 should": "V7 should",
    "V6 must": "V7 must",
    "V6 gives": "V7 gives",
    "Future V6": "Future V7",
    "future V6": "future V7",
    "Current V6": "Current V7",
    "current V6": "current V7",
    "solar-bess-topology-v6": "solar-bess-topology-v7",
    "V6": "V7",
}

PRESERVE_NOTE = """

## V7 migration note

V7 was created as a full workspace copy from V6.

V6 remains preserved as the previous working baseline.

Internal legacy file names may still contain older version labels where renaming them would create unnecessary break risk. This is intentional. User facing documentation, launcher labels and development notes are relabelled to V7 where safe.
""".strip()


def rel(path: Path) -> str:
    try:
        return str(path.resolve(strict=False).relative_to(ROOT.resolve(strict=False)))
    except ValueError:
        return str(path)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_text(text: str) -> tuple[str, int]:
    count = 0
    for old, new in REPLACEMENTS.items():
        occurrences = text.count(old)
        if occurrences:
            text = text.replace(old, new)
            count += occurrences
    return text, count


def patch_v7_files() -> list[str]:
    actions: list[str] = []
    for path in sorted(V7.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SAFE_TEXT_EXTENSIONS:
            continue
        try:
            original = read_text(path)
        except UnicodeDecodeError:
            actions.append(f"skipped binary or non utf8 file: {rel(path)}")
            continue
        patched, count = patch_text(original)
        if patched != original:
            write_text(path, patched)
            actions.append(f"patched {count} label references in {rel(path)}")

    readme = V7 / "README.md"
    if readme.exists():
        text = read_text(readme)
        if "## V7 migration note" not in text:
            write_text(readme, text.rstrip() + "\n\n" + PRESERVE_NOTE + "\n")
            actions.append("added V7 migration note to README.md")
    return actions


def write_report(actions: list[str], overwrite: bool) -> Path:
    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = REPORTS / "v7_migration_from_v6.md"
    lines = [
        "# V7 Migration From V6",
        "",
        f"UTC created: {timestamp}",
        f"Source: `{rel(V6)}`",
        f"Target: `{rel(V7)}`",
        f"Overwrite used: {overwrite}",
        "",
        "## Purpose",
        "",
        "Create a full V7 workspace from the current V6 workspace while preserving V6 as the prior working baseline.",
        "",
        "## Migration stance",
        "",
        "- V6 is not edited.",
        "- V7 is a new version folder.",
        "- Internal legacy file names are not renamed unless deliberately handled later.",
        "- Safe user facing labels and documentation references are relabelled from V6 to V7.",
        "- A separate workflow should be used for future V7 upgrades.",
        "",
        "## Actions",
        "",
    ]
    lines.extend([f"- {action}" for action in actions] or ["- no file label changes required"])
    lines.extend([
        "",
        "## Next steps",
        "",
        "1. Test `solar-bess-topology-v7/index.html` locally through GitHub Pages.",
        "2. Test each V7 app route.",
        "3. Do not add V7 to the public homepage until manual checks pass.",
        "4. Use V7 for the next phase of controlled upgrades.",
        "",
    ])
    write_text(report, "\n".join(lines))
    return report


def migrate(overwrite: bool) -> None:
    if not V6.exists():
        raise SystemExit(f"Source folder missing: {rel(V6)}")

    if V7.exists():
        if not overwrite:
            raise SystemExit(f"Target folder already exists: {rel(V7)}. Re-run with --overwrite if intentional.")
        shutil.rmtree(V7)

    shutil.copytree(V6, V7)
    actions = [f"copied full folder {rel(V6)} to {rel(V7)}"]
    actions.extend(patch_v7_files())
    report = write_report(actions, overwrite)
    print(f"V7 migration complete. Report: {rel(report)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create solar-bess-topology-v7 from solar-bess-topology-v6.")
    parser.add_argument("--overwrite", action="store_true", help="Delete and recreate existing V7 folder if it already exists.")
    args = parser.parse_args()
    migrate(overwrite=args.overwrite)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
