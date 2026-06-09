from pathlib import Path
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "uk_energy_tracking_v6" / "generation_history"
DST = ROOT / "uk_energy_tracking_v6_2" / "generation_history"
REPORT = ROOT / "gridbot_reports" / "clone_generation_history_v6_to_v6_2.md"
INDEX = ROOT / "index.html"

TEXT_EXTS = {".md", ".html", ".js", ".css", ".json", ".geojson", ".csv", ".txt", ".yml", ".yaml"}

REPLACEMENTS = [
    ("/uk_energy_tracking_v6/generation_history/", "/uk_energy_tracking_v6_2/generation_history/"),
    ("./uk_energy_tracking_v6/generation_history/", "./uk_energy_tracking_v6_2/generation_history/"),
    ("uk_energy_tracking_v6/generation_history", "uk_energy_tracking_v6_2/generation_history"),
    ("UK Generation History V6 Module", "UK Generation History V6 2 Module"),
    ("GLOBALGRID2050 · ISOLATED V6 MODULE", "GLOBALGRID2050 · ISOLATED V6 2 MODULE"),
    ("V6GenerationHistoryConfig", "V62GenerationHistoryConfig"),
    ("V6LoadGenerationHistoryData", "V62LoadGenerationHistoryData"),
    ("V6RenderGenerationHistoryChart", "V62RenderGenerationHistoryChart"),
    ("V6ControlGenerationHistory", "V62ControlGenerationHistory"),
    ("V6LoadGenerationMwhAggregates", "V62LoadGenerationMwhAggregates"),
    ("V6RenderGenerationMwhAggregates", "V62RenderGenerationMwhAggregates"),
    ("V6ControlGenerationMwhAggregates", "V62ControlGenerationMwhAggregates"),
]


def copy_tree():
    if not SRC.exists():
        raise SystemExit(f"Missing source folder: {SRC}")
    if DST.exists():
        shutil.rmtree(DST)
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
        if "uk_energy_tracking_v6_2_2" in text or "V6 2 2" in text or "V622" in text:
            raise SystemExit(f"Unsafe double rewrite detected in {path.relative_to(ROOT)}")
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed.append(path.relative_to(ROOT).as_posix())
    return changed


def update_homepage():
    row = '  <tr><td><a href="./uk_energy_tracking_v6_2/generation_history/">UK Generation History V6 2 Module</a> <span class="dev-status">(in development)</span></td></tr>'
    if not INDEX.exists():
        return False
    text = INDEX.read_text(encoding="utf-8")
    if row in text:
        return False
    anchor = '  <tr><td><a href="./uk_energy_tracking_v6/generation_history/">UK Generation History V6 Module</a></td></tr>'
    if anchor in text:
        text = text.replace(anchor, anchor + "\n" + row)
    else:
        text = text.replace("</table>", row + "\n</table>")
    INDEX.write_text(text, encoding="utf-8")
    return True


def write_report(copied, changed, homepage_changed):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y %m %d %H:%M UTC")
    changed_files = "\n".join(f"* {x}" for x in changed[:300]) or "* No text replacements required"
    REPORT.write_text(f"""# Clone Generation History V6 to V6 2

Generated: {now}

## Purpose

Create `uk_energy_tracking_v6_2/generation_history` as a controlled clone of the current V6 generation history module. V6 remains preserved as the live reference. V6 2 becomes the working module for FUELHH browser slim wiring, PV Live routing, reconciliation checks and user interface hardening.

## Source

* `uk_energy_tracking_v6/generation_history/`

## Destination

* `uk_energy_tracking_v6_2/generation_history/`

## Files copied

{len(copied)} files copied from V6 generation history to V6 2 generation history.

## Homepage

Root `index.html` V6 2 generation history link added: {homepage_changed}

## Text paths rewritten

{changed_files}

## Operating rule

V6 remains the live reference module. V6 2 is the working clone for safer data wiring and evidence closure. Future changes should land on V6 2 first, then be promoted only after human review.
""", encoding="utf-8")


def main():
    copied = copy_tree()
    changed = rewrite_text_files()
    homepage_changed = update_homepage()
    write_report(copied, changed, homepage_changed)
    print(f"Cloned {len(copied)} files from generation history V6 to V6 2")
    print(f"Text replacements: {len(changed)}")
    print(f"Homepage changed: {homepage_changed}")


if __name__ == "__main__":
    main()
