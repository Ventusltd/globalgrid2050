from pathlib import Path
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "solar-bess-topology-v4"
DST = ROOT / "solar-bess-topology-v5"
REPORT = ROOT / "gridbot_reports" / "v5_clone_from_v4_report.md"
CHANGELOG = DST / "V5_CHANGELOG_AND_ROADMAP.md"

TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml"}

FILES = [
    "indexforgis-sld", "gis-sld-config", "gis-sld-helpers", "gis-sld-state",
    "gis-sld-substations", "gis-sld", "gis-sld-map", "gis-sld-calculations",
    "gis-sld-finance", "gis-sld-ui-core", "gis-sld-drawing", "gis-sld-export",
    "gis-sld-ui", "module-layout"
]

RENAME_PAIRS = []
for name in FILES:
    if name == "gis-sld":
        RENAME_PAIRS.append(("gis-sld-v4.css", "gis-sld-v5.css"))
    elif name == "module-layout":
        RENAME_PAIRS.extend([
            ("module-layout-v4.html", "module-layout-v5.html"),
            ("module-layout-v4.css", "module-layout-v5.css"),
            ("module-layout-v4.js", "module-layout-v5.js"),
        ])
    else:
        ext = ".html" if name == "indexforgis-sld" else ".js"
        RENAME_PAIRS.append((f"{name}-v4{ext}", f"{name}-v5{ext}"))

TEXT_REPLACE_PAIRS = [("solar-bess-topology-v4", "solar-bess-topology-v5"), ("V4", "V5"), ("v4", "v5")]

CHANGELOG_TEXT = """# GlobalGrid2050 V5 Change Record and Roadmap

UTC created: {created_at}

## Purpose

V5 is cloned from the stabilised V4 application so V4 can remain available for users while future development continues in a separate working version.

V4 is now the public user baseline. V5 is the development track.

## V3 baseline

V3 was the first serious modular version of the GIS SLD Financial Sandbox. It separated the application into HTML, CSS and multiple JavaScript files. It established map display, substation reference data, string inverter topology, central inverter topology, technical quantity outputs, logistics estimates, baseline project economics, GeoJSON export and the separate physical module layout page.

## What changed in V4

V4 was created by cloning V3 into a new folder and renaming the main files and references from V3 to V4. V4 then became a separate deployable version. It retained the modular structure but added stronger project qualification language, expanded Financial Model Logic, a detailed screening disclaimer, a stronger GeoJSON export note and a CSS fix so the cyan explainer box could display the long disclaimer properly.

## Why V4 changed

The sandbox had moved beyond a visual prototype. It now combines land, grid proximity, topology, cable assumptions, BESS assumptions, CAPEX, revenue and exportable GIS context. That means users need clear boundaries. V4 explains that the tool is for early stage screening and learning, not construction design, grid approval, EPC pricing, financial advice or bankable technical due diligence.

## Possible V5 projects

1. Add a V5 development badge and a link back to stable V4.
2. Make long explainer and disclaimer sections collapsible.
3. Add scenario save and load using JSON.
4. Improve cashflow, profit and risk adjusted financial terminology.
5. Add project comparison mode.
6. Improve BESS modelling.
7. Add clearer cable loss and cable route cost assumptions.
8. Improve GeoJSON export structure.
9. Add CSV export.
10. Add report export.
11. Add public data source provenance notes.
12. Add validation warnings for unusual engineering or financial assumptions.
13. Use GridBot feature manifests for all future V5 changes.

## Governance principle

V4 remains stable for users. V5 is where new ideas are tested, documented and only later promoted when useful, stable and approved.
"""


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
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            text = path.read_text(encoding="utf-8")
            original = text
            for old, new in TEXT_REPLACE_PAIRS:
                text = text.replace(old, new)
            if text != original:
                path.write_text(text, encoding="utf-8")
                changed_files.append(str(path.relative_to(ROOT)))

    created_at = datetime.now(timezone.utc).isoformat()
    CHANGELOG.write_text(CHANGELOG_TEXT.format(created_at=created_at), encoding="utf-8")

    files = sorted(str(p.relative_to(ROOT)) for p in DST.rglob("*") if p.is_file())
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = [
        "# V5 Clone from V4 Report", "", f"UTC created: {created_at}", "",
        "Source: solar-bess-topology-v4/", "Destination: solar-bess-topology-v5/", "",
        "Main V5 URLs after GitHub Pages deploy:", "",
        "https://globalgrid2050.com/solar-bess-topology-v5/",
        "https://globalgrid2050.com/solar-bess-topology-v5/indexforgis-sld-v5.html",
        "https://globalgrid2050.com/solar-bess-topology-v5/module-layout-v5.html", "",
        "Change record: solar-bess-topology-v5/V5_CHANGELOG_AND_ROADMAP.md", "",
        "Renamed files:", "",
    ]
    report.extend(f"- {old} -> {new}" for old, new in renamed)
    report.extend(["", "Files with V4 to V5 text references updated:", ""])
    report.extend(f"- {f}" for f in changed_files)
    report.extend(["", "Files cloned:", ""])
    report.extend(f"- {f}" for f in files)
    report.extend(["", "Rollback: delete solar-bess-topology-v5/ and this report. V4 remains untouched."])
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
