from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "solar-bess-topology-v6"
REPORTS = ROOT / "gridbot_reports"

REPLACEMENTS = {
    "GlobalGrid2050 V5": "GlobalGrid2050 V6",
    "GIS SLD Financial Sandbox V5": "GIS SLD Financial Sandbox V6",
    "Module Layout V5": "Module Layout V6",
    "DC AC LV Topology Review V5": "DC AC LV Topology Review V6",
    "Cable Geometry Visualiser V5": "Cable Geometry Visualiser V6",
    "Back to GIS SLD V5": "Back to GIS SLD V6",
    "<!-- V5 modular app scripts -->": "<!-- V6 migrated modular app scripts -->",
}

# Keep file names unchanged in this first V6 migration. This preserves dependency behaviour and avoids breaking V5-derived scripts.
TEXT_TYPES = {".html", ".css", ".js", ".md"}


def main():
    actions = []
    if not V6.exists():
        raise SystemExit("solar-bess-topology-v6 not found")

    for path in sorted(V6.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_TYPES:
            continue
        text = path.read_text(encoding="utf-8")
        old = text
        for a, b in REPLACEMENTS.items():
            text = text.replace(a, b)
        if text != old:
            path.write_text(text, encoding="utf-8")
            actions.append(str(path.relative_to(ROOT)))

    REPORTS.mkdir(parents=True, exist_ok=True)
    report = REPORTS / "v6_sanity_label_fix.md"
    report.write_text(
        "# V6 Sanity Label Fix\n\n"
        f"UTC created: {datetime.now(timezone.utc).isoformat()}\n\n"
        "Updated V6 visible labels while deliberately keeping migrated V5 file names unchanged so dependencies remain stable.\n\n"
        "Files changed:\n\n" + ("\n".join(f"- {a}" for a in actions) if actions else "- none") + "\n",
        encoding="utf-8"
    )
    print("V6 sanity label fix complete")

if __name__ == "__main__":
    main()
