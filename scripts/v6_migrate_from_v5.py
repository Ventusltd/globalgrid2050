from pathlib import Path
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "solar-bess-topology-v5"
V6 = ROOT / "solar-bess-topology-v6"
REPORTS = ROOT / "gridbot_reports"

APP_FOLDERS = {
    "gis-sld-financial-sandbox": {
        "html": "indexforgis-sld-v5.html",
        "copy": [
            "gis-sld-v5.css",
            "gis-sld-v5-config.js",
            "gis-sld-v5-helpers.js",
            "gis-sld-v5-state.js",
            "gis-sld-v5-substations.js",
            "gis-sld-v5-map.js",
            "gis-sld-v5-calculations.js",
            "gis-sld-v5-finance.js",
            "gis-sld-v5-ui-core.js",
            "gis-sld-v5-drawing.js",
            "gis-sld-v5-export.js",
            "gis-sld-v5-ui.js",
        ],
        "title": "GIS SLD Financial Sandbox",
        "description": "Main GIS, SLD, financial and grid screening application."
    },
    "module-layout": {
        "html": "module-layout-v5.html",
        "copy": [
            "gis-sld-v5.css",
            "module-layout-v5.css",
            "gis-sld-v5-config.js",
            "gis-sld-v5-helpers.js",
            "module-layout-v5.js",
        ],
        "title": "Physical Solar Module Layout",
        "description": "Separate module footprint, row, pitch and layout visualiser."
    },
    "dc-ac-lv-topology-review": {
        "html": "dc-ac-lv-topology-review-v5.html",
        "copy": [
            "gis-sld-v5.css",
            "module-layout-v5.css",
            "dc-ac-lv-topology-review-v5.css",
            "dc-ac-lv-topology-review-v5.js",
        ],
        "title": "DC AC LV Topology Review",
        "description": "Separate low voltage and DC topology screening application."
    },
    "cable-geometry-visualiser": {
        "html": "cable-geometry-visualiser-v5.html",
        "copy": [],
        "title": "Cable Geometry Visualiser",
        "description": "Cable formation, trench, bend and geometry visualiser. To be modularised next."
    },
}

SHARED_DOCS = [
    "ARCHITECTURE.md",
    "README_FOR_AI_AND_HUMANS.md",
    "V5_CHANGELOG_AND_ROADMAP.md",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def copy_file(src: Path, dst: Path):
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def patch_links(html: str, app_name: str) -> str:
    # Basic V6 navigation rewrite only. File names are otherwise kept unchanged so the migration stays low risk.
    replacements = {
        './indexforgis-sld-v5.html': '../gis-sld-financial-sandbox/index.html',
        './module-layout-v5.html': '../module-layout/index.html',
        './dc-ac-lv-topology-review-v5.html': '../dc-ac-lv-topology-review/index.html',
        './cable-geometry-visualiser-v5.html': '../cable-geometry-visualiser/index.html',
        'Back to GIS SLD V5': 'Back to GIS SLD V6',
        'Module Layout V5': 'Module Layout V6',
        'GlobalGrid2050 V5': 'GlobalGrid2050 V6',
        'DC AC LV Topology Review V5': 'DC AC LV Topology Review V6',
    }
    for old, new in replacements.items():
        html = html.replace(old, new)

    # Keep existing cache busting harmless but mark the V6 migration.
    html = html.replace('dc-ac-lv-topology-review-v5.js?v=stable-live-update-1', 'dc-ac-lv-topology-review-v5.js?v=v6-migration-1')
    return html


def launcher_html() -> str:
    cards = []
    for folder, meta in APP_FOLDERS.items():
        cards.append(f'''
            <a class="card" href="./{folder}/index.html">
                <h2>{meta["title"]}</h2>
                <p>{meta["description"]}</p>
                <span>Open app</span>
            </a>''')
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GlobalGrid2050 V6</title>
    <style>
        :root {{ --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; }}
        * {{ box-sizing:border-box; }}
        body {{ margin:0; padding:28px; background:var(--bg); color:var(--text); font-family:"Courier New", monospace; }}
        header {{ max-width:1180px; margin:0 auto 24px auto; border:1px solid var(--line); background:rgba(10,10,10,.96); padding:22px; border-radius:14px; }}
        .kicker {{ color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }}
        h1 {{ margin:8px 0 10px 0; font-size:28px; }}
        p {{ color:var(--muted); line-height:1.55; }}
        main {{ max-width:1180px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:18px; }}
        .card {{ display:block; min-height:190px; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:20px; text-decoration:none; color:var(--text); }}
        .card:hover {{ border-color:var(--accent); }}
        .card h2 {{ margin:0 0 10px 0; color:var(--accent); font-size:18px; }}
        .card span {{ color:var(--ok); font-weight:bold; }}
        footer {{ max-width:1180px; margin:22px auto 0 auto; color:var(--muted); font-size:12px; }}
    </style>
</head>
<body>
    <header>
        <div class="kicker">GlobalGrid2050 V6</div>
        <h1>Separated Application Workspace</h1>
        <p>V6 starts by migrating the working V5 applications into separate folders so each app has its own HTML, CSS and JavaScript context. V5 remains untouched as the stable reference.</p>
    </header>
    <main>{''.join(cards)}
    </main>
    <footer>Generated from V5 on {datetime.now(timezone.utc).isoformat()}.</footer>
</body>
</html>
'''


def readme_text() -> str:
    return '''# GlobalGrid2050 V6

V6 is a separated application workspace copied from the stable V5 folder.

Purpose:

1. Keep V5 stable.
2. Place each application in its own folder.
3. Make it obvious which scripts belong to which app.
4. Prepare the cable geometry visualiser for modularisation without risking the GIS SLD sandbox or DC AC LV topology app.

Folder structure:

```text
solar-bess-topology-v6/
  index.html
  gis-sld-financial-sandbox/
  module-layout/
  dc-ac-lv-topology-review/
  cable-geometry-visualiser/
  docs/
  tools/
```

Rules for future AI or human work:

1. Do not edit V5 when working on V6.
2. Do not mix scripts between apps unless they are deliberately placed in a shared folder later.
3. Keep each app working independently inside its own folder.
4. Use small workflows and small commits.
5. For the cable geometry visualiser, split only after the copied V6 app is confirmed working.

Next planned work:

Modularise `cable-geometry-visualiser/index.html` into separate CSS, data, calculation, rendering, UI and export files.
'''


def migrate():
    if not V5.exists():
        raise SystemExit("V5 folder not found")

    if V6.exists():
        shutil.rmtree(V6)
    V6.mkdir(parents=True, exist_ok=True)

    actions = []

    for folder, meta in APP_FOLDERS.items():
        app_dir = V6 / folder
        app_dir.mkdir(parents=True, exist_ok=True)
        src_html = V5 / meta["html"]
        if src_html.exists():
            html = patch_links(read(src_html), folder)
            write(app_dir / "index.html", html)
            actions.append(f"created {folder}/index.html from {meta['html']}")
        else:
            actions.append(f"missing {meta['html']}")
        for fname in meta["copy"]:
            ok = copy_file(V5 / fname, app_dir / fname)
            actions.append(("copied " if ok else "missing ") + f"{fname} to {folder}")

    write(V6 / "index.html", launcher_html())
    write(V6 / "README.md", readme_text())

    docs_dir = V6 / "docs"
    for doc in SHARED_DOCS:
        if copy_file(V5 / doc, docs_dir / doc):
            actions.append(f"copied doc {doc}")

    tools_dir = V6 / "tools" / "legacy-v5-installers"
    for py in sorted(V5.glob("install_*.py")):
        copy_file(py, tools_dir / py.name)
        actions.append(f"copied legacy installer {py.name}")

    REPORTS.mkdir(parents=True, exist_ok=True)
    report = REPORTS / "v6_migration_from_v5.md"
    write(report, "# V6 Migration From V5\n\n" +
          f"UTC created: {datetime.now(timezone.utc).isoformat()}\n\n" +
          "Created `solar-bess-topology-v6` as a separated application workspace.\n\n" +
          "V5 remains the stable baseline.\n\n" +
          "Actions:\n\n" + "\n".join(f"- {a}" for a in actions) + "\n")

    print("V6 migration complete")


if __name__ == "__main__":
    migrate()
