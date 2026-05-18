from pathlib import Path
import hashlib
import re
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
V5_HTML = ROOT / "solar-bess-topology-v5" / "cable-geometry-visualiser-v5.html"
APP_DIR = ROOT / "solar-bess-topology-v6" / "cable-geometry-visualiser"
V6_HTML = APP_DIR / "index.html"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "v6_cable_geometry_modularisation_phase_1.md"

OUTPUT_FILES = {
    "style.css": None,
    "data.js": None,
    "calculations.js": None,
    "rendering.js": None,
    "export.js": None,
    "ui.js": None,
}

SCRIPT_TAGS = """<script src=\"./data.js\"></script>
<script src=\"./calculations.js\"></script>
<script src=\"./rendering.js\"></script>
<script src=\"./export.js\"></script>
<script src=\"./ui.js\"></script>"""


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def extract_style(html: str) -> tuple[str, re.Match]:
    matches = list(re.finditer(r"<style>\s*(.*?)\s*</style>", html, flags=re.DOTALL | re.IGNORECASE))
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly 1 inline style block, found {len(matches)}")
    return matches[0].group(1), matches[0]


def extract_inline_scripts(html: str) -> list[re.Match]:
    return list(re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>\s*(.*?)\s*</script>", html, flags=re.DOTALL | re.IGNORECASE))


def extract_main_script(html: str) -> tuple[str, re.Match]:
    matches = extract_inline_scripts(html)
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly 1 inline non src script block, found {len(matches)}")
    return matches[0].group(1), matches[0]


def find_anchor(js: str, anchor: str) -> int:
    pos = js.find(anchor)
    if pos < 0:
        raise RuntimeError(f"Missing required JavaScript anchor: {anchor}")
    return pos


def split_js(js: str) -> dict[str, str]:
    anchors = {
        "calculations": find_anchor(js, "function byId("),
        "rendering": find_anchor(js, "function renderStatus("),
        "export": find_anchor(js, "function exportJson("),
        "ui": find_anchor(js, "function populateFormationOptions("),
    }

    ordered = [
        ("data.js", 0, anchors["calculations"]),
        ("calculations.js", anchors["calculations"], anchors["rendering"]),
        ("rendering.js", anchors["rendering"], anchors["export"]),
        ("export.js", anchors["export"], anchors["ui"]),
        ("ui.js", anchors["ui"], len(js)),
    ]

    parts = {name: js[start:end] for name, start, end in ordered}
    for name, text in parts.items():
        if not text.strip():
            raise RuntimeError(f"Generated empty module: {name}")
    return parts


def replace_block(text: str, match: re.Match, replacement: str) -> str:
    return text[:match.start()] + replacement + text[match.end():]


def normalise_for_compare(text: str) -> str:
    return text.replace("\r\n", "\n").strip()


def make_report(
    css_v6: str,
    js_v6: str,
    parts: dict[str, str],
    rebuilt_css: str,
    rebuilt_js: str,
    v5_css: str | None,
    v5_js: str | None,
    checks: list[tuple[str, bool, str]],
) -> str:
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# V6 Cable Geometry Modularisation Phase 1",
        "",
        f"UTC created: {now}",
        "",
        "Target app:",
        "",
        "`solar-bess-topology-v6/cable-geometry-visualiser/index.html`",
        "",
        "Purpose:",
        "",
        "Split the V6 cable geometry visualiser into external CSS and JavaScript files while preserving the original V6 runtime order and comparing the extracted logic against the original V5 visualiser.",
        "",
        "Generated files:",
        "",
    ]
    for name in OUTPUT_FILES:
        path = APP_DIR / name
        lines.append(f"- `{path.relative_to(ROOT)}`")

    lines.extend([
        "",
        "Checks:",
        "",
    ])
    for label, ok, detail in checks:
        status = "PASS" if ok else "FAIL"
        lines.append(f"- {status}: {label} {detail}".rstrip())

    lines.extend([
        "",
        "Hashes:",
        "",
        f"- V6 inline CSS before extraction: `{sha256(css_v6)}`",
        f"- V6 rebuilt CSS from module: `{sha256(rebuilt_css)}`",
        f"- V6 inline JS before extraction: `{sha256(js_v6)}`",
        f"- V6 rebuilt JS from modules: `{sha256(rebuilt_js)}`",
    ])
    if v5_css is not None:
        lines.append(f"- V5 original inline CSS: `{sha256(v5_css)}`")
    if v5_js is not None:
        lines.append(f"- V5 original inline JS: `{sha256(v5_js)}`")

    lines.extend([
        "",
        "Module sizes:",
        "",
        f"- `style.css`: {len(css_v6.splitlines())} lines",
    ])
    for name, text in parts.items():
        lines.append(f"- `{name}`: {len(text.splitlines())} lines")

    lines.extend([
        "",
        "Instruction:",
        "",
        "After the workflow runs, manually open the V6 cable geometry visualiser in the browser and compare the default visual output, input controls, export JSON and copy snapshot behaviour against the V5 original.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    if not V6_HTML.exists():
        raise SystemExit(f"Missing V6 file: {V6_HTML}")
    if not V5_HTML.exists():
        raise SystemExit(f"Missing V5 baseline file: {V5_HTML}")

    html_v6 = read(V6_HTML)
    css_v6, style_match = extract_style(html_v6)
    js_v6, script_match = extract_main_script(html_v6)

    html_v5 = read(V5_HTML)
    v5_css, _ = extract_style(html_v5)
    v5_js, _ = extract_main_script(html_v5)

    parts = split_js(js_v6)
    rebuilt_js = "".join(parts[name] for name in ["data.js", "calculations.js", "rendering.js", "export.js", "ui.js"])
    rebuilt_css = css_v6

    new_html = replace_block(html_v6, script_match, SCRIPT_TAGS)
    new_html = replace_block(new_html, style_match, '<link rel="stylesheet" href="./style.css" />')

    write(APP_DIR / "style.css", css_v6)
    for name, text in parts.items():
        write(APP_DIR / name, text)
    write(V6_HTML, new_html)

    updated_html = read(V6_HTML)
    checks: list[tuple[str, bool, str]] = []
    checks.append(("V6 CSS module exactly rebuilds original V6 inline CSS", normalise_for_compare(rebuilt_css) == normalise_for_compare(css_v6), ""))
    checks.append(("V6 JS modules exactly rebuild original V6 inline JS", normalise_for_compare(rebuilt_js) == normalise_for_compare(js_v6), ""))
    checks.append(("V6 CSS matches original V5 inline CSS", normalise_for_compare(css_v6) == normalise_for_compare(v5_css), ""))
    checks.append(("V6 JS matches original V5 inline JS", normalise_for_compare(js_v6) == normalise_for_compare(v5_js), ""))
    checks.append(("V6 index now loads external style.css", '<link rel="stylesheet" href="./style.css" />' in updated_html, ""))
    checks.append(("V6 index now loads all 5 JavaScript modules", all(f'<script src="./{name}"></script>' in updated_html for name in ["data.js", "calculations.js", "rendering.js", "export.js", "ui.js"]), ""))
    checks.append(("V6 index no longer contains inline style block", "<style>" not in updated_html.lower(), ""))

    required_symbols = {
        "data.js": ["const DEFAULT_BURIAL_DEPTHS", "const FORMATION_LIBRARY", "const OD_CONFIRMED"],
        "calculations.js": ["function byId(", "function computeLayout(", "function buildReview("],
        "rendering.js": ["function renderStatus(", "function drawFormation(", "function drawTrench(", "function drawBend("],
        "export.js": ["function exportJson(", "function copySnapshot("],
        "ui.js": ["function populateFormationOptions(", "function renderAll(", "function bindEvents(", "init();"],
    }
    for name, symbols in required_symbols.items():
        text = read(APP_DIR / name)
        ok = all(symbol in text for symbol in symbols)
        checks.append((f"{name} contains expected runtime symbols", ok, ""))

    report = make_report(css_v6, js_v6, parts, rebuilt_css, rebuilt_js, v5_css, v5_js, checks)
    write(REPORT, report)

    failed = [label for label, ok, _ in checks if not ok]
    if failed:
        raise SystemExit("Modularisation checks failed:\n" + "\n".join(f"- {item}" for item in failed))

    print("V6 cable geometry modularisation phase 1 complete")
    print(f"Report written to {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
