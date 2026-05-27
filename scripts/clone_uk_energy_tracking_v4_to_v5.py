from pathlib import Path
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "uk_energy_tracking_v4"
DST = ROOT / "uk_energy_tracking_v5"
REPORT = ROOT / "gridbot_reports" / "clone_uk_energy_tracking_v4_to_v5.md"
INDEX = ROOT / "index.html"

TEXT_EXTS = {".md", ".html", ".js", ".css", ".json", ".geojson", ".csv", ".txt"}

REPLACEMENTS = [
    ("/uk_energy_tracking_v4/", "/uk_energy_tracking_v5/"),
    ("uk_energy_tracking_v4", "uk_energy_tracking_v5"),
    ("UK Live Grid Tracker V4", "UK Live Grid Tracker V5"),
    ("UK LIVE GRID TRACKER V4", "UK LIVE GRID TRACKER V5"),
    ("V4", "V5"),
    ("v4", "v5"),
]

MACHINE_BLOCK = """
      <div class=\"gg-machine-note\">
        <strong>Grid intelligence machine:</strong>
        <span><b>Inputs:</b> Elexon prices, live demand, carbon data, oil and fuel data, time windows, day and night filters.</span>
        <span><b>Mechanism:</b> lazy loading, event detection, high and low marker logic, date windowing, chart rendering, mobile full screen controls.</span>
        <span><b>Outputs:</b> price volatility insight, peak and trough timing, market spread visibility, battery opportunity signals, future circuit sizing logic.</span>
      </div>
"""

MACHINE_STYLE = """
#electricity-price-history-panel .gg-machine-note {
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.018);
  color: var(--gg-muted);
  font-size: 10.5px;
  line-height: 1.45;
  letter-spacing: .04em;
  padding: 8px 10px;
  margin: 8px 0 10px;
  border-radius: 5px;
}
#electricity-price-history-panel .gg-machine-note strong {
  color: var(--gg-cyan);
  text-transform: uppercase;
  letter-spacing: .10em;
  display: block;
  margin-bottom: 4px;
}
#electricity-price-history-panel .gg-machine-note span {
  display: block;
}
#electricity-price-history-panel .gg-machine-note b {
  color: var(--gg-text);
}
"""


def copy_tree():
    if not SRC.exists():
        raise SystemExit(f"Missing source folder: {SRC}")
    DST.mkdir(parents=True, exist_ok=True)
    copied = []
    for src_path in SRC.rglob("*"):
        rel = src_path.relative_to(SRC)
        dst_path = DST / rel
        if src_path.is_dir():
            dst_path.mkdir(parents=True, exist_ok=True)
            continue
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dst_path)
        copied.append(dst_path.relative_to(ROOT).as_posix())
    return copied


def rewrite_text_files():
    changed = []
    for path in DST.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed.append(path.relative_to(ROOT).as_posix())
    return changed


def add_machine_statement():
    index = DST / "index.md"
    if not index.exists():
        return False
    text = index.read_text(encoding="utf-8")
    changed = False
    if ".gg-machine-note" not in text:
        text = text.replace("</style>", MACHINE_STYLE + "\n</style>")
        changed = True
    if "Grid intelligence machine:" not in text:
        marker = '<canvas id="price-history-canvas" width="900" height="720"></canvas>'
        if marker in text:
            text = text.replace(marker, MACHINE_BLOCK + "\n" + marker)
            changed = True
    if changed:
        index.write_text(text, encoding="utf-8")
    return changed


def update_homepage():
    row = '  <tr><td><a href="./uk_energy_tracking_v5/">UK Live Grid Tracker V5, Electricity Market Intelligence Machine</a> <span class="dev-status">(in development)</span></td></tr>'
    if not INDEX.exists():
        return False
    text = INDEX.read_text(encoding="utf-8")
    if './uk_energy_tracking_v5/' in text:
        return False
    anchor = '  <tr><td><a href="./uk_energy_tracking_v3/">UK Live Grid Tracker V3, Experimental Intelligence Lab</a></td></tr>'
    if anchor in text:
        text = text.replace(anchor, anchor + "\n" + row)
    else:
        text = text.replace("</table>", row + "\n</table>")
    INDEX.write_text(text, encoding="utf-8")
    return True


def write_report(copied, changed, machine_changed, homepage_changed):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    changed_files = "\n".join(f"- {x}" for x in changed[:200]) or "- No text replacements required"
    REPORT.write_text(f"""# Clone UK Energy Tracking V4 to V5

Generated: {now}

## Purpose

Create `uk_energy_tracking_v5` as the next working clone of the current V4 electricity market intelligence tracker. V4 remains preserved as the digital twin and rollback reference.

## Source

- `uk_energy_tracking_v4/`

## Destination

- `uk_energy_tracking_v5/`

## Files copied

{len(copied)} files copied from V4 to V5.

## Homepage

Root `index.html` V5 link added: {homepage_changed}

## Machine statement

Small graph print added to V5: {machine_changed}

## Text paths rewritten

{changed_files}

## Operating rule

V4 is now the frozen twin. V5 is the working branch for the next round of chart, data pipeline, battery sizing and market intelligence development.
""", encoding="utf-8")


def main():
    copied = copy_tree()
    changed = rewrite_text_files()
    machine_changed = add_machine_statement()
    homepage_changed = update_homepage()
    write_report(copied, changed, machine_changed, homepage_changed)
    print(f"Cloned {len(copied)} files from V4 to V5")
    print(f"Text replacements: {len(changed)}")
    print(f"Machine statement changed: {machine_changed}")
    print(f"Homepage changed: {homepage_changed}")


if __name__ == "__main__":
    main()
