from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "solar-bess-topology" / "index.html"
V5 = ROOT / "solar-bess-topology-v5"
DST = V5 / "cable-geometry-visualiser-v5.html"
MODULE_LAYOUT = V5 / "module-layout-v5.html"
REPORT = ROOT / "gridbot_reports" / "v5_geometry_visualiser_migration.md"


def replace_once(text, old, new, label, actions):
    if old not in text:
        actions.append(f"SKIP: {label}")
        return text
    actions.append(f"OK: {label}")
    return text.replace(old, new, 1)


def migrate_geometry_app(actions):
    if not SRC.exists():
        raise SystemExit(f"Missing source file: {SRC}")

    html = SRC.read_text(encoding="utf-8")

    html = html.replace("<title>Geometry Visualiser v1.5.18</title>", "<title>Cable Geometry Visualiser V5 | GlobalGrid2050</title>")
    html = html.replace("<h2>Geometry Inputs</h2>", "<h2>Cable Geometry Visualiser V5</h2>\n            <div class=\"guidance-box\"><strong>GlobalGrid2050 V5 migration</strong><br>This page is migrated from the original cable geometry visualiser into the V5 toolset. It remains a geometry capture and visual review tool only. It does not perform electrical rating, thermal rating, cable sizing, protection grading or construction design.</div>\n\n            <div class=\"button-row\"><a class=\"btn\" href=\"./module-layout-v5.html\" style=\"text-align:center;text-decoration:none;\">Module Layout V5</a><a class=\"btn btn-alt\" href=\"./dc-ac-lv-topology-review-v5.html\" style=\"text-align:center;text-decoration:none;\">DC AC LV Topology Review</a></div>\n\n            <h3 class=\"section-title\">Geometry Inputs</h3>", 1)

    html = html.replace("schema_version: \"1.5.18r1\"", "schema_version: \"v5-geometry-migration-1\"")

    if "max-width: 1480px;" in html:
        html = html.replace("max-width: 1480px;", "max-width: 1480px;\n            min-width: 0;", 1)

    if "@media (max-width: 1080px)" in html and "overflow-x: hidden" not in html[:3000]:
        html = html.replace("body {\n            margin: 0;", "html, body { max-width: 100%; overflow-x: hidden; }\n\n        body {\n            margin: 0;", 1)

    mobile_css = """

        @media (max-width: 700px) {
            body { padding: 12px; }
            .panel { padding: 14px; width: 100%; max-width: 100%; overflow-x: hidden; }
            .panel-left { width: 100%; }
            .dashboard { width: 100%; max-width: 100%; overflow-x: hidden; }
            .input-group { flex-direction: column; align-items: stretch; gap: 4px; }
            .input-group input, .input-group select { width: 100%; max-width: 100%; }
            .button-row { flex-direction: column; }
            .btn { width: 100%; white-space: normal; }
            h2 { font-size: 16px; overflow-wrap: anywhere; }
            canvas { width: 100%; max-width: 100%; }
        }
"""
    if "@media (max-width: 700px)" not in html:
        html = html.replace("</style>", mobile_css + "\n    </style>", 1)
        actions.append("OK: added mobile sizing CSS")

    DST.write_text(html, encoding="utf-8")
    actions.append(f"WROTE: {DST.relative_to(ROOT)}")


def patch_module_layout_link(actions):
    if not MODULE_LAYOUT.exists():
        raise SystemExit(f"Missing module layout file: {MODULE_LAYOUT}")
    html = MODULE_LAYOUT.read_text(encoding="utf-8")
    if "cable-geometry-visualiser-v5.html" in html:
        actions.append("SKIP: Module Layout already links to Cable Geometry Visualiser V5")
        return

    old = '<a class="module-link" href="./dc-ac-lv-topology-review-v5.html">DC AC LV Topology Review</a>'
    new = old + '<a class="module-link" href="./cable-geometry-visualiser-v5.html">Cable Geometry Visualiser V5</a>'
    if old in html:
        html = html.replace(old, new, 1)
        MODULE_LAYOUT.write_text(html, encoding="utf-8")
        actions.append("OK: added Cable Geometry Visualiser V5 button to Module Layout header")
        return

    old2 = '<a class="module-link" href="./indexforgis-sld-v5.html">Back to GIS SLD V5</a>'
    new2 = '<a class="module-link" href="./cable-geometry-visualiser-v5.html">Cable Geometry Visualiser V5</a>' + old2
    html = replace_once(html, old2, new2, "fallback add geometry button before GIS SLD link", actions)
    MODULE_LAYOUT.write_text(html, encoding="utf-8")


def write_report(actions):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 Cable Geometry Visualiser Migration Report\n\n"
        f"UTC created: {datetime.now(timezone.utc).isoformat()}\n\n"
        "Scope: migrate `solar-bess-topology/index.html` into the V5 toolset with a clearer file name and link it from Module Layout V5.\n\n"
        "Generated file:\n\n"
        "- `solar-bess-topology-v5/cable-geometry-visualiser-v5.html`\n\n"
        "Linked from:\n\n"
        "- `solar-bess-topology-v5/module-layout-v5.html`\n\n"
        "Purpose:\n\n"
        "The migrated page remains a cable geometry visualisation and capture tool. It is not an electrical design, thermal rating, protection grading or construction design tool.\n\n"
        "Actions:\n\n" + "\n".join(f"- {a}" for a in actions) + "\n",
        encoding="utf-8"
    )


def main():
    actions = []
    migrate_geometry_app(actions)
    patch_module_layout_link(actions)
    write_report(actions)


if __name__ == "__main__":
    main()
