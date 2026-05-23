#!/usr/bin/env python3
"""Generate full code reports for V7 and V8 GIS SLD apps.

Purpose:
- Produce one Markdown analysis file inside the V7 GIS SLD folder.
- Produce one Markdown analysis file inside the V8 BESS GIS SLD folder.
- Include the full source code of the local app files in a deterministic order.
- Help future AI, LLM and GridBot sessions read the complete app context before making small controlled module changes.

These reports are analysis artefacts only. They are not linked from the public homepage.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]

APPS = [
    {
        "name": "V7 GIS SLD Financial Sandbox",
        "version": "V7",
        "folder": ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox",
        "output": "GIS_SLD_FULL_CODE_REPORT_V7.md",
        "summary": "Working V7 Solar BESS GIS SLD Financial Sandbox reference frame.",
    },
    {
        "name": "V8 BESS GIS SLD Financial Sandbox",
        "version": "V8",
        "folder": ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox",
        "output": "GIS_SLD_FULL_CODE_REPORT_V8.md",
        "summary": "V8 standalone BESS GIS SLD development frame.",
    },
]

REPORT = ROOT / "gridbot_reports" / "generate_gis_sld_full_code_reports.md"

ALLOWED_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".md",
    ".json",
    ".geojson",
    ".yml",
    ".yaml",
    ".txt",
}

EXCLUDE_NAMES = {
    "GIS_SLD_FULL_CODE_REPORT_V7.md",
    "GIS_SLD_FULL_CODE_REPORT_V8.md",
    "CODEBASE_BLUEPRINT.md",
}

EXCLUDE_PARTS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".DS_Store",
}

LANG_BY_SUFFIX = {
    ".html": "html",
    ".css": "css",
    ".js": "javascript",
    ".json": "json",
    ".geojson": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".md": "markdown",
    ".txt": "text",
}


def should_include(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return False
    if any(part in EXCLUDE_PARTS for part in path.parts):
        return False
    if not path.is_file():
        return False
    return path.suffix.lower() in ALLOWED_SUFFIXES


def sort_key(path: Path) -> tuple[int, str]:
    order = {
        "README.md": 0,
        "index.html": 1,
        "gis-sld-v5-config.js": 2,
        "gis-sld-v5-helpers.js": 3,
        "gis-sld-v5-state.js": 4,
        "gis-sld-v5-substations.js": 5,
        "gis-sld-v5-map.js": 6,
        "gis-sld-v5-calculations.js": 7,
        "gis-sld-v5-finance.js": 8,
        "gis-sld-v5-ui-core.js": 9,
        "gis-sld-v5-drawing.js": 10,
        "gis-sld-v5-export.js": 11,
        "gis-sld-v5-ui.js": 12,
        "gis-sld-v5.css": 13,
    }
    return (order.get(path.name, 100), str(path).lower())


def iter_source_files(folder: Path) -> list[Path]:
    if not folder.exists():
        raise FileNotFoundError(f"Missing folder: {folder}")
    files = [path for path in folder.rglob("*") if should_include(path)]
    return sorted(files, key=sort_key)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def fence_lang(path: Path) -> str:
    return LANG_BY_SUFFIX.get(path.suffix.lower(), "text")


def make_tree(folder: Path, files: Iterable[Path]) -> str:
    lines = []
    for file in files:
        rel = file.relative_to(folder)
        lines.append(str(rel))
    return "\n".join(lines)


def make_report(app: dict[str, object]) -> tuple[Path, int, int]:
    folder = app["folder"]
    assert isinstance(folder, Path)
    files = iter_source_files(folder)
    output_path = folder / str(app["output"])
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    chunks: list[str] = []
    chunks.append(f"# {app['name']} Full Code Report")
    chunks.append("")
    chunks.append(f"Generated UTC: {now}")
    chunks.append("")
    chunks.append("## Purpose")
    chunks.append("")
    chunks.append(str(app["summary"]))
    chunks.append("")
    chunks.append("This file is an AI and GridBot analysis artefact. Read it before modifying this GIS SLD app. It is not linked from the public homepage and should be treated as an internal development reference in the public repository.")
    chunks.append("")
    chunks.append("## Read first")
    chunks.append("")
    chunks.append("Future AI, LLM and GridBot workflows should read this report before editing this app. Changes should then be made in small controlled steps, preferably 1 module at a time, with a dedicated script, test and workflow.")
    chunks.append("")
    chunks.append("## Scope boundary")
    chunks.append("")
    if app["version"] == "V8":
        chunks.append("V8 is the standalone BESS development frame. It should not destabilise V7. Cable sizing, R, X, Z impedance, leakage, reverse current and protection coordination should remain in the advanced topology review unless deliberately promoted in a controlled future feature.")
    else:
        chunks.append("V7 is the working GIS SLD reference frame. Treat it as the stable baseline. Do not make broad replacements. Study V7 first, then port small proven behaviours into V8.")
    chunks.append("")
    chunks.append("## File inventory")
    chunks.append("")
    chunks.append("```text")
    chunks.append(make_tree(folder, files))
    chunks.append("```")
    chunks.append("")
    chunks.append("## Full source code")
    chunks.append("")

    total_lines = 0
    for file in files:
        rel = file.relative_to(folder)
        text = read_text(file)
        line_count = len(text.splitlines())
        total_lines += line_count
        chunks.append(f"### `{rel}`")
        chunks.append("")
        chunks.append(f"Lines: {line_count}")
        chunks.append("")
        chunks.append(f"```{fence_lang(file)}")
        chunks.append(text.rstrip())
        chunks.append("```")
        chunks.append("")

    output_path.write_text("\n".join(chunks), encoding="utf-8")
    return output_path, len(files), total_lines


def main() -> int:
    results = []
    for app in APPS:
        output_path, file_count, line_count = make_report(app)
        results.append((app["version"], output_path, file_count, line_count))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    report_lines = [
        "# Generate GIS SLD Full Code Reports",
        "",
        f"Generated UTC: {now}",
        "",
        "## Outputs",
        "",
    ]
    for version, output_path, file_count, line_count in results:
        report_lines.extend([
            f"### {version}",
            "",
            "```text",
            str(output_path.relative_to(ROOT)),
            "```",
            "",
            f"Files included: {file_count}",
            "",
            f"Source lines included: {line_count}",
            "",
        ])
    report_lines.extend([
        "## Notes",
        "",
        "The files are Markdown analysis reports for future AI and GridBot work. They are not linked from the public homepage.",
        "",
    ])
    REPORT.write_text("\n".join(report_lines), encoding="utf-8")
    print("Generated GIS SLD full code reports.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
