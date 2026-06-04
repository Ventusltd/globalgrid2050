from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "index": ROOT / "uk_energy_tracking_v6" / "index.md",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_INSPECT_CACHE_BUSTER_REPORT.md",
}

NEW_VERSION = "20260604inspect1"
TOUCHED = []


def read(path):
    if not path.exists():
        raise SystemExit(f"Missing required file: {path}")
    return path.read_text(encoding="utf-8")


def write(path, text):
    old = read(path)
    if old != text:
        path.write_text(text, encoding="utf-8")
        TOUCHED.append(str(path.relative_to(ROOT)))


def must(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Missing {label}: {needle}")


def bump(path):
    text = read(path)
    must(text, "render_price_chart.js?v=", str(path))
    import re
    text2 = re.sub(r"render_price_chart\.js\?v=[A-Za-z0-9_.-]+", f"render_price_chart.js?v={NEW_VERSION}", text)
    must(text2, f"render_price_chart.js?v={NEW_VERSION}", str(path))
    write(path, text2)


def main():
    renderer = read(FILES["renderer"])
    must(renderer, "ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);", "connected inspect setup")
    must(renderer, "drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId);", "connected inspect overlay")
    bump(FILES["index"])
    bump(FILES["article"])
    report = f"""# V6 Repair Report: Inspect Cache Buster

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Reason

The inspect overlay code was present and connected in the shared renderer, but both public pages still referenced the renderer with an old cache query string. Browsers and GitHub Pages could continue serving the old JavaScript.

## Change

Updated render_price_chart.js cache query string to `{NEW_VERSION}` in:

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file changes required'}

## Guardrails

- No data files changed.
- No renderer logic changed.
- No loader paths changed.
"""
    FILES["report"].write_text(report, encoding="utf-8")
    TOUCHED.append(str(FILES["report"].relative_to(ROOT)))
    print("V6 inspect cache buster repair completed")
    for t in TOUCHED:
        print("touched:", t)


if __name__ == "__main__":
    main()
