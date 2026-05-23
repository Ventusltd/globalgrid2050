#!/usr/bin/env python3
"""Generate a compact V8 codebase blueprint for AI review.

Purpose:
    Create a small structural map of the V8 codebase so AI and GridBot can
    understand the app without reading every full source file.

Output:
    solar-bess-topology-v8/CODEBASE_BLUEPRINT.md

Scope:
    solar-bess-topology-v8 only. V7 is not scanned or modified.
"""

from __future__ import annotations

import datetime as dt
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "solar-bess-topology-v8"
OUTPUT = TARGET / "CODEBASE_BLUEPRINT.md"
REPORT = ROOT / "gridbot_reports" / "generate_v8_codebase_blueprint.md"

IGNORE_DIRS = {
    ".git",
    ".github",
    "node_modules",
    "__pycache__",
    "venv",
    "env",
    "dist",
    "build",
}

ALLOWED_EXTENSIONS = {
    ".html",
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".md",
    ".py",
    ".yml",
    ".yaml",
}

SIGNATURE_PATTERNS = [
    re.compile(r"^\s*function\s+[A-Za-z0-9_$]+\s*\("),
    re.compile(r"^\s*async\s+function\s+[A-Za-z0-9_$]+\s*\("),
    re.compile(r"^\s*(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?\(?.*?\)?\s*=>"),
    re.compile(r"^\s*class\s+[A-Za-z0-9_$]+"),
    re.compile(r"^\s*def\s+[A-Za-z0-9_]+\s*\("),
    re.compile(r"^\s*class\s+[A-Za-z0-9_]+\s*[:(]"),
]

HTML_ID_PATTERN = re.compile(r"id=[\"']([^\"']+)[\"']")
HTML_CLASS_PATTERN = re.compile(r"class=[\"']([^\"']+)[\"']")
SCRIPT_SRC_PATTERN = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)
CSS_LINK_PATTERN = re.compile(r"<link[^>]+href=[\"']([^\"']+)[\"']", re.IGNORECASE)
EVENT_PATTERN = re.compile(r"addEventListener\s*\(\s*[\"']([^\"']+)[\"']")
DOM_ID_PATTERN = re.compile(r"getElementById\s*\(\s*[\"']([^\"']+)[\"']")
QUERY_PATTERN = re.compile(r"querySelector(?:All)?\s*\(\s*[\"']([^\"']+)[\"']")
CSS_SELECTOR_PATTERN = re.compile(r"^\s*([.#][A-Za-z0-9_-][^{,]*)")


def iter_files() -> list[Path]:
    files: list[Path] = []
    for root, dirs, filenames in os.walk(TARGET):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        root_path = Path(root)
        for filename in filenames:
            path = root_path / filename
            if path.suffix.lower() in ALLOWED_EXTENSIONS:
                files.append(path)
    return sorted(files)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def directory_tree(files: list[Path]) -> str:
    tree: dict[str, set[str]] = {}
    for path in files:
        parent = path.parent.relative_to(TARGET).as_posix()
        tree.setdefault(parent, set()).add(path.name)

    lines = [TARGET.name + "/"]
    for parent in sorted(tree):
        level = 0 if parent == "." else parent.count("/") + 1
        indent = "    " * level
        if parent != ".":
            lines.append(f"{indent}{Path(parent).name}/")
        file_indent = "    " * (level + 1)
        for filename in sorted(tree[parent]):
            lines.append(f"{file_indent}{filename}")
    return "\n".join(lines)


def unique_sorted(values: list[str], limit: int = 80) -> list[str]:
    cleaned = sorted({v.strip() for v in values if v and v.strip()})
    return cleaned[:limit]


def extract_file_summary(path: Path) -> str:
    text = read_text(path)
    lines = text.splitlines()
    ext = path.suffix.lower()
    parts: list[str] = [f"### `{rel(path)}`", ""]
    parts.append(f"Size: `{len(text):,}` characters, `{len(lines):,}` lines")
    parts.append("")

    if ext == ".html":
        ids = unique_sorted(HTML_ID_PATTERN.findall(text))
        classes_raw = HTML_CLASS_PATTERN.findall(text)
        classes = unique_sorted([c for group in classes_raw for c in group.split()])
        scripts = unique_sorted(SCRIPT_SRC_PATTERN.findall(text))
        links = unique_sorted(CSS_LINK_PATTERN.findall(text))
        if links:
            parts.append("Linked CSS:")
            parts.extend([f"- `{item}`" for item in links])
            parts.append("")
        if scripts:
            parts.append("Linked scripts:")
            parts.extend([f"- `{item}`" for item in scripts])
            parts.append("")
        if ids:
            parts.append("HTML IDs:")
            parts.extend([f"- `{item}`" for item in ids])
            parts.append("")
        if classes:
            parts.append("HTML classes:")
            parts.extend([f"- `{item}`" for item in classes[:80]])
            parts.append("")

    if ext in {".js", ".mjs", ".py"}:
        signatures = []
        for line in lines:
            if any(pattern.search(line) for pattern in SIGNATURE_PATTERNS):
                signatures.append(line.strip())
        events = unique_sorted(EVENT_PATTERN.findall(text))
        dom_ids = unique_sorted(DOM_ID_PATTERN.findall(text))
        queries = unique_sorted(QUERY_PATTERN.findall(text))
        if signatures:
            parts.append("Signatures:")
            parts.append("```text")
            parts.extend(signatures[:120])
            parts.append("```")
            parts.append("")
        if events:
            parts.append("Events listened for:")
            parts.extend([f"- `{item}`" for item in events])
            parts.append("")
        if dom_ids:
            parts.append("DOM IDs referenced:")
            parts.extend([f"- `{item}`" for item in dom_ids])
            parts.append("")
        if queries:
            parts.append("Selectors referenced:")
            parts.extend([f"- `{item}`" for item in queries])
            parts.append("")

    if ext == ".css":
        selectors = []
        for line in lines:
            match = CSS_SELECTOR_PATTERN.search(line)
            if match:
                selectors.append(match.group(1).strip())
        selectors = unique_sorted(selectors, limit=120)
        if selectors:
            parts.append("CSS selectors:")
            parts.extend([f"- `{item}`" for item in selectors])
            parts.append("")

    if ext in {".md", ".yml", ".yaml", ".json"}:
        headings = [line.strip() for line in lines if line.strip().startswith("#")]
        if headings:
            parts.append("Headings:")
            parts.extend([f"- {item}" for item in headings[:60]])
            parts.append("")

    return "\n".join(parts)


def main() -> int:
    if not TARGET.exists():
        raise SystemExit("V8 folder does not exist. Run the V8 creation workflow first.")

    files = iter_files()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    content: list[str] = []
    content.append("# GlobalGrid2050 V8 Codebase Blueprint")
    content.append("")
    content.append(f"Generated UTC: `{now}`")
    content.append("")
    content.append("This is a compact AI review map of the V8 codebase. It records folder structure, file roles, HTML IDs, linked scripts, linked CSS, JavaScript function signatures, DOM references, event listeners and key CSS selectors.")
    content.append("")
    content.append("It is intentionally not a full source dump. Use this first, then inspect individual files only when needed.")
    content.append("")
    content.append("## Directory Structure")
    content.append("")
    content.append("```text")
    content.append(directory_tree(files))
    content.append("```")
    content.append("")
    content.append("## File Summaries")
    content.append("")

    for path in files:
        content.append(extract_file_summary(path))

    OUTPUT.write_text("\n".join(content), encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Generate V8 Codebase Blueprint",
        "",
        f"Generated UTC: `{now}`",
        "",
        "## Output",
        "",
        "```text",
        rel(OUTPUT),
        "```",
        "",
        "## Scope",
        "",
        "Scanned only:",
        "",
        "```text",
        rel(TARGET),
        "```",
        "",
        "## File count",
        "",
        str(len(files)),
        "",
        "## Purpose",
        "",
        "Create a compact code skeleton for AI and GridBot review without pasting the full raw codebase into a prompt.",
        "",
    ]), encoding="utf-8")

    print(f"Generated {rel(OUTPUT)} from {len(files)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
