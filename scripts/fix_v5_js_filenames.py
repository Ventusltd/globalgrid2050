from pathlib import Path
from datetime import datetime, timezone
import shutil

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "solar-bess-topology-v5"
REPORT = ROOT / "gridbot_reports" / "v5_js_filename_repair.md"

SUFFIXES = [
    "config",
    "helpers",
    "state",
    "substations",
    "map",
    "calculations",
    "finance",
    "ui-core",
    "drawing",
    "export",
    "ui",
]


def main():
    if not V5.exists():
        raise SystemExit(f"Missing V5 folder: {V5}")

    actions = []
    for suffix in SUFFIXES:
        src = V5 / f"gis-sld-v4-{suffix}.js"
        dst = V5 / f"gis-sld-v5-{suffix}.js"
        if src.exists():
            shutil.copyfile(src, dst)
            actions.append(f"copied {src.name} to {dst.name}")
        elif dst.exists():
            actions.append(f"already present {dst.name}")
        else:
            actions.append(f"missing both source and target for {suffix}")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 JavaScript Filename Repair\n\n"
        f"UTC created: {datetime.now(timezone.utc).isoformat()}\n\n"
        "Purpose:\n"
        "Repair V5 clone filename mismatch where the V5 HTML referenced gis-sld-v5 JavaScript files but the clone retained several gis-sld-v4 JavaScript filenames inside the V5 folder.\n\n"
        "Actions:\n\n"
        + "\n".join(f"- {a}" for a in actions)
        + "\n\nResult:\nThe V5 HTML dependency chain should now resolve against V5 named JavaScript files. V4 remains untouched.\n",
        encoding="utf-8"
    )


if __name__ == "__main__":
    main()
