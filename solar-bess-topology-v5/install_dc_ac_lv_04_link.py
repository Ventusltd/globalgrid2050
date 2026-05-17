from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "module-layout-v5.html"

if not HTML.exists():
    raise SystemExit("module-layout-v5.html not found")

text = HTML.read_text(encoding="utf-8")
if "dc-ac-lv-topology-review-v5.html" in text:
    print("Link already present")
else:
    old = '<a class="module-link" href="./indexforgis-sld-v5.html">Back to GIS SLD V5</a>'
    new = '<div class="topo-header-links"><a class="module-link" href="./dc-ac-lv-topology-review-v5.html">DC AC LV Topology Review</a><a class="module-link" href="./indexforgis-sld-v5.html">Back to GIS SLD V5</a></div>'
    if old not in text:
        raise SystemExit("Header link anchor not found")
    HTML.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Added DC AC LV topology link")
