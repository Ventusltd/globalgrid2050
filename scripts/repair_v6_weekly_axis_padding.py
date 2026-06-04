from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_WEEKLY_AXIS_PADDING_REPORT.md",
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

    must_contain(text, "function drawShortWindowTicks", "renderer short window tick helper")
    must_contain(text, "[0,6,13,16].forEach", "renderer weekly time markers")
    must_contain(text, "span>7.1*86400000", "renderer one week guard")

    old = "var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();drawAxes(g,w,h,q,mm,pad,t0,t1);"
    new = "var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();var visibleSpan=t1-t0;if(result.mode!=='daily'&&visibleSpan>2.1*86400000&&visibleSpan<=7.1*86400000){pad.bottom=Math.max(pad.bottom,82*q)}drawAxes(g,w,h,q,mm,pad,t0,t1);"

    if "visibleSpan=t1-t0" not in text:
        text = replace_once(text, old, new, "renderer weekly bottom padding")

    must_contain(text, "pad.bottom=Math.max(pad.bottom,82*q)", "renderer weekly padding rule")
    write(path, text)


def write_report():
    report = f"""# V6 Repair Report: Weekly Axis Padding

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

This repair only changes chart canvas bottom padding for raw half hourly weekly windows.

## Reason

Weekly day labels and 00:00, 06:00, 13:00 and 16:00 time guide labels were being drawn below the available canvas plot area. They were visible but cut off at the bottom edge.

## Behaviour

1. If the visible window is greater than 2.1 days and not greater than 7.1 days, the renderer increases bottom padding to at least 82 device scaled pixels.
2. 24 hour and 48 hour views are not changed by this rule.
3. Daily aggregate and longer range behaviour is not changed.
4. No data files, loaders, CSV files or source paths are changed.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Manual checks

1. Open /uk_energy_tracking_v6/ and select 1 week.
2. Confirm day labels and time guide labels are visible and not cut off.
3. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and select Latest 1 week.
4. Confirm the same behaviour.
5. Confirm 24 hours, 48 hours, 1 month, 6 months and 10 years still behave as before.
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
    print("V6 weekly axis padding repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
