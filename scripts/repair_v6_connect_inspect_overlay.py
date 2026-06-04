from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_CONNECT_INSPECT_OVERLAY_REPORT.md",
}

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


def must_contain(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Missing expected marker in {label}: {needle}")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:160]}")
    return text.replace(old, new, 1)


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)

    for marker in [
        "function ensureInspectControls",
        "function attachInspectEvents",
        "function drawInspectOverlay",
        "function renderTo",
    ]:
        must_contain(text, marker, "renderer inspect helpers")

    old_start = "function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;var isFull="
    new_start = "function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);var isFull="
    if "ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);var isFull=" not in text:
        text = replace_once(text, old_start, new_start, "renderTo inspect setup call")

    old_draw = "set('ph-source','Seasonal baseline')}if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar"
    new_draw = "set('ph-source','Seasonal baseline')}drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId);if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar"
    if "drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId);if(!isFull" not in text:
        text = replace_once(text, old_draw, new_draw, "renderTo inspect overlay call")

    must_contain(text, "ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);var isFull=", "renderer connected controls")
    must_contain(text, "drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId);if(!isFull", "renderer connected overlay")
    write(path, text)


def write_report():
    report = f"""# V6 Repair Report: Connect Inspect Overlay

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Reason

The previous inspection workflow inserted the helper functions but did not connect them into the renderTo execution path. The function definition existed, but the renderer did not call it.

## Change

1. renderTo now creates and attaches the previous point and next point inspection controls.
2. renderTo now calls drawInspectOverlay after the high and low marker stage.
3. Inspection remains limited to raw half hourly windows up to 6 months.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails

- No data files changed.
- No loader files changed.
- No source paths changed.
- No annual calculations changed.
"""
    FILES["report"].write_text(report, encoding="utf-8")
    if str(FILES["report"].relative_to(ROOT)) not in TOUCHED:
        TOUCHED.append(str(FILES["report"].relative_to(ROOT)))


def main():
    ai = read(FILES["ai_start"])
    protocol = read(FILES["protocol"])
    must_contain(ai, "Do not directly rewrite large HTML, CSS or JavaScript files", "AI_START_HERE")
    must_contain(protocol, "All V6 changes", "V6 protocol")
    patch_renderer()
    write_report()
    print("V6 inspect overlay connector repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
