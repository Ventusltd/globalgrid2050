from pathlib import Path
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "solar-bess-topology-v3"
DST = ROOT / "solar-bess-topology-v4"
REPORT = ROOT / "gridbot_reports" / "v4_clone_from_v3_report.md"

TEXT_SUFFIXES = {
    ".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml"
}

RENAME_PAIRS = [
    ("indexforgis-sld-v3.html", "indexforgis-sld-v4.html"),
    ("gis-sld-v3-config.js", "gis-sld-v4-config.js"),
    ("gis-sld-v3-helpers.js", "gis-sld-v4-helpers.js"),
    ("gis-sld-v3-state.js", "gis-sld-v4-state.js"),
    ("gis-sld-v3-substations.js", "gis-sld-v4-substations.js"),
    ("gis-sld-v3.css", "gis-sld-v4.css"),
    ("gis-sld-v3-map.js", "gis-sld-v4-map.js"),
    ("gis-sld-v3-calculations.js", "gis-sld-v4-calculations.js"),
    ("gis-sld-v3-finance.js", "gis-sld-v4-finance.js"),
    ("gis-sld-v3-ui-core.js", "gis-sld-v4-ui-core.js"),
    ("gis-sld-v3-drawing.js", "gis-sld-v4-drawing.js"),
    ("gis-sld-v3-export.js", "gis-sld-v4-export.js"),
    ("gis-sld-v3-ui.js", "gis-sld-v4-ui.js"),
    ("module-layout-v3.html", "module-layout-v4.html"),
    ("module-layout-v3.css", "module-layout-v4.css"),
    ("module-layout-v3.js", "module-layout-v4.js"),
]

TEXT_REPLACE_PAIRS = [
    ("solar-bess-topology-v3", "solar-bess-topology-v4"),
    ("GIS SLD Financial Sandbox V3", "GIS SLD Financial Sandbox V4"),
    ("GlobalGrid2050 V3", "GlobalGrid2050 V4"),
    ("Module Layout V3", "Module Layout V4"),
    ("Physical Solar Module Layout", "Physical Solar Module Layout"),
    ("indexforgis-sld-v3.html", "indexforgis-sld-v4.html"),
    ("gis-sld-v3-config.js", "gis-sld-v4-config.js"),
    ("gis-sld-v3-helpers.js", "gis-sld-v4-helpers.js"),
    ("gis-sld-v3-state.js", "gis-sld-v4-state.js"),
    ("gis-sld-v3-substations.js", "gis-sld-v4-substations.js"),
    ("gis-sld-v3.css", "gis-sld-v4.css"),
    ("gis-sld-v3-map.js", "gis-sld-v4-map.js"),
    ("gis-sld-v3-calculations.js", "gis-sld-v4-calculations.js"),
    ("gis-sld-v3-finance.js", "gis-sld-v4-finance.js"),
    ("gis-sld-v3-ui-core.js", "gis-sld-v4-ui-core.js"),
    ("gis-sld-v3-drawing.js", "gis-sld-v4-drawing.js"),
    ("gis-sld-v3-export.js", "gis-sld-v4-export.js"),
    ("gis-sld-v3-ui.js", "gis-sld-v4-ui.js"),
    ("module-layout-v3.html", "module-layout-v4.html"),
    ("module-layout-v3.css", "module-layout-v4.css"),
    ("module-layout-v3.js", "module-layout-v4.js"),
    ("V3", "V4"),
    ("v3", "v4"),
]


def main():
    if not SRC.exists():
        raise SystemExit(f"Source folder missing: {SRC}")

    if DST.exists():
        shutil.rmtree(DST)

    shutil.copytree(SRC, DST)

    renamed = []
    for old, new in RENAME_PAIRS:
        old_path = DST / old
        new_path = DST / new
        if old_path.exists():
            old_path.rename(new_path)
            renamed.append((old, new))

    changed_files = []
    for path in DST.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in TEXT_REPLACE_PAIRS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed_files.append(str(path.relative_to(ROOT)))

    files = sorted(str(p.relative_to(ROOT)) for p in DST.rglob("*") if p.is_file())

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = [
        "# V4 Clone from V3 Report",
        "",
        f"UTC created: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Purpose:",
        "Clone the current V3 application into a separate V4 folder so V3 becomes the safety baseline and future development can continue in V4.",
        "",
        "Source:",
        "solar-bess-topology-v3/",
        "",
        "Destination:",
        "solar-bess-topology-v4/",
        "",
        "Main V4 test URLs after GitHub Pages deploy:",
        "",
        "https://globalgrid2050.com/solar-bess-topology-v4/",
        "https://globalgrid2050.com/solar-bess-topology-v4/indexforgis-sld-v4.html",
        "https://globalgrid2050.com/solar-bess-topology-v4/module-layout-v4.html",
        "",
        "Files cloned:",
        "",
    ]
    report.extend(f"- {f}" for f in files)
    report.extend([
        "",
        "Renamed files:",
        "",
    ])
    report.extend(f"- {old} -> {new}" for old, new in renamed)
    report.extend([
        "",
        "Files with V3 to V4 text references updated:",
        "",
    ])
    report.extend(f"- {f}" for f in changed_files)
    report.extend([
        "",
        "Rollback method:",
        "",
        "Delete solar-bess-topology-v4/ and this report if the clone is not wanted. V3 is not changed by this clone operation.",
        "",
        "Validation checklist:",
        "",
        "1. Open the V4 main app URL.",
        "2. Confirm the map loads.",
        "3. Confirm String and Central tabs work.",
        "4. Draw a grid.",
        "5. Test export cable length, pick up array, rotation and waypoint routing.",
        "6. Open module-layout-v4.html and test physical module layout.",
        "7. Confirm V3 remains unchanged.",
    ])
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
