#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "solar-bess-topology-v3"
HTML_PATH = APP_DIR / "indexforgis-sld-v3.html"

MODULES = {
    "gis-sld-v3-map.js": ("// MAP", "// AGGREGATE STATS"),
    "gis-sld-v3-calculations.js": ("// AGGREGATE STATS", "// FINANCIALS"),
    "gis-sld-v3-finance.js": ("// FINANCIALS", "// RENDER TECHNICAL SUMMARY"),
    "gis-sld-v3-ui-core.js": ("// RENDER TECHNICAL SUMMARY", "// DRAWING"),
    "gis-sld-v3-drawing.js": ("// DRAWING", "// EXPORT"),
    "gis-sld-v3-export.js": ("// EXPORT", "// TAB SWITCHING"),
    "gis-sld-v3-ui.js": ("// TAB SWITCHING", None),
}

MODULE_ORDER = [
    "gis-sld-v3-map.js",
    "gis-sld-v3-calculations.js",
    "gis-sld-v3-finance.js",
    "gis-sld-v3-ui-core.js",
    "gis-sld-v3-drawing.js",
    "gis-sld-v3-export.js",
    "gis-sld-v3-ui.js",
]

HEAD_REPLACEMENTS = {
    "GIS SLD Financial Sandbox V2": "GIS SLD Financial Sandbox V3",
    "gis-sld-v2-config.js": "gis-sld-v3-config.js",
    "gis-sld-v2-helpers.js": "gis-sld-v3-helpers.js",
    "gis-sld-v2-state.js": "gis-sld-v3-state.js",
    "gis-sld-v2-substations.js": "gis-sld-v3-substations.js",
    "gis-sld-v2.css": "gis-sld-v3.css",
}


def fail(message: str) -> None:
    raise SystemExit(f"[modularize_v3] ERROR: {message}")


def normalise_identity(text: str) -> str:
    for old, new in HEAD_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def extract_inline_script(html: str) -> tuple[str, str]:
    start_marker = "\n<script>\n\"use strict\";"
    start = html.find(start_marker)
    if start < 0:
        fail("inline app script start not found")

    script_content_start = start + len("\n<script>\n")
    end = html.find("\n</script>", script_content_start)
    if end < 0:
        fail("inline app script end not found")

    script_text = html[script_content_start:end]
    html_without = html[:start] + "\n__V3_MODULE_SCRIPT_TAGS__\n" + html[end + len("\n</script>"):]
    return html_without, script_text


def slice_section(script: str, start_marker: str, end_marker: str | None) -> str:
    start = script.find(start_marker)
    if start < 0:
        fail(f"section start not found: {start_marker}")

    if end_marker is None:
        end = len(script)
    else:
        end = script.find(end_marker, start + len(start_marker))
        if end < 0:
            fail(f"section end not found: {end_marker}")

    return script[start:end].strip() + "\n"


def write_modules(script: str) -> None:
    script = script.strip()
    if script.startswith('"use strict";'):
        script = script[len('"use strict";'):].lstrip()

    for filename, (start_marker, end_marker) in MODULES.items():
        body = slice_section(script, start_marker, end_marker)
        output = '"use strict";\n\n' + body
        (APP_DIR / filename).write_text(output, encoding="utf-8")


def module_tags() -> str:
    lines = ["<!-- V3 modular app scripts -->"]
    for filename in MODULE_ORDER:
        lines.append("<" + f"script src=\"{filename}\"></" + "script>")
    return "\n".join(lines)


def remove_v2_duplicates() -> None:
    for path in APP_DIR.glob("gis-sld-v2*"):
        if path.is_file():
            path.unlink()


def verify() -> None:
    required = [
        "index.html",
        "indexforgis-sld-v3.html",
        "gis-sld-v3.css",
        "gis-sld-v3-config.js",
        "gis-sld-v3-helpers.js",
        "gis-sld-v3-state.js",
        "gis-sld-v3-substations.js",
        *MODULE_ORDER,
    ]
    missing = [name for name in required if not (APP_DIR / name).exists()]
    if missing:
        fail("missing files: " + ", ".join(missing))

    html = HTML_PATH.read_text(encoding="utf-8")
    forbidden = ["gis-sld-v2", "Financial Sandbox V2", "__V3_MODULE_SCRIPT_TAGS__"]
    bad = [item for item in forbidden if item in html]
    if bad:
        fail("Forbidden V3 HTML text remains: " + ", ".join(bad))

    inline_start = "\n<script>\n\"use strict\";"
    if inline_start in html:
        fail("original inline app script still present in V3 HTML")

    for filename in MODULE_ORDER:
        if filename not in html:
            fail("module tag missing from V3 HTML: " + filename)


def main() -> int:
    if not HTML_PATH.exists():
        fail(f"missing HTML: {HTML_PATH}")

    html = HTML_PATH.read_text(encoding="utf-8")
    html = normalise_identity(html)

    if "__V3_MODULE_SCRIPT_TAGS__" in html:
        fail("placeholder already present before extraction")

    html_without_script, script = extract_inline_script(html)
    write_modules(script)

    final_html = html_without_script.replace("__V3_MODULE_SCRIPT_TAGS__", module_tags())
    HTML_PATH.write_text(final_html, encoding="utf-8")

    remove_v2_duplicates()
    verify()

    print("[modularize_v3] V3 modularisation complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
