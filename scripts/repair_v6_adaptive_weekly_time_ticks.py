from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_ADAPTIVE_WEEKLY_TIME_TICKS_REPORT.md",
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


def replace_function(text, name, replacement):
    start = text.find("function " + name + "(")
    if start < 0:
        raise SystemExit(f"Function not found: {name}")
    next_marker = text.find("\n  function ", start + 1)
    if next_marker < 0:
        raise SystemExit(f"Could not find end of function: {name}")
    return text[:start] + replacement + text[next_marker:]


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)

    must_contain(text, "function drawShortWindowTicks", "renderer current weekly tick helper")
    must_contain(text, "span>7.1*86400000", "renderer one week guard")
    must_contain(text, "function drawAxes", "renderer axes helper")

    new_ticks = """function drawShortWindowTicks(g,w,h,q,pad,t0,t1,span){if(span>7.1*86400000)return;g.save();g.textAlign='center';var plotW=w-pad.left-pad.right;if(span>2.1*86400000){var day=86400000,days=Math.max(1,span/day),pxPerDay=plotW/days,firstDay=Math.ceil(t0/day)*day;var hours=pxPerDay>=360?[6,13,16]:pxPerDay>=230?[6,16]:pxPerDay>=145?[13]:[];var dayY=h-pad.bottom+34*q,timeY=h-pad.bottom+54*q,minGap=Math.max(42*q,pxPerDay*.18),lastTimeX=-999999;for(var d=firstDay;d<t1;d+=day){var dx=pad.left+((d-t0)/(t1-t0))*plotW;g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(dx,pad.top);g.lineTo(dx,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.font=Math.max(8,10*q)+'px Courier New';g.fillText(shortTickLabel(d,span),dx,dayY);hours.forEach(function(hr){var tt=d+hr*3600000;if(tt<=t0||tt>=t1)return;var x=pad.left+((tt-t0)/(t1-t0))*plotW;if(x-lastTimeX<minGap)return;lastTimeX=x;g.strokeStyle='rgba(255,255,255,.045)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='rgba(154,163,182,.70)';g.font=Math.max(7,8*q)+'px Courier New';g.fillText(shortTimeLabel(tt),x,timeY)})}g.restore();return}var interval=span<=1.1*86400000?3*3600000:6*3600000;var first=Math.ceil(t0/interval)*interval;g.font=10*q+'px Courier New';for(var t=first;t<t1;t+=interval){var x=pad.left+((t-t0)/(t1-t0))*plotW;g.strokeStyle='rgba(255,255,255,.10)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.fillText(shortTickLabel(t,span),x,h-pad.bottom+40*q)}g.restore()}"""

    text = replace_function(text, "drawShortWindowTicks", new_ticks)

    # Make sure the weekly label area has enough bottom room once the adaptive time row is active.
    if "pad.bottom=Math.max(pad.bottom,104*q)" not in text:
        text = text.replace("pad.bottom=Math.max(pad.bottom,82*q)", "pad.bottom=Math.max(pad.bottom,104*q)")

    must_contain(text, "pxPerDay>=360?[6,13,16]", "renderer adaptive dense rule")
    must_contain(text, "pxPerDay>=230?[6,16]", "renderer adaptive medium rule")
    must_contain(text, "pxPerDay>=145?[13]", "renderer adaptive tight rule")
    must_contain(text, "if(x-lastTimeX<minGap)return", "renderer overlap guard")
    must_contain(text, "pad.bottom=Math.max(pad.bottom,104*q)", "renderer expanded weekly padding")
    write(path, text)


def write_report():
    report = f"""# V6 Repair Report: Adaptive Weekly Time Ticks

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Reason

The weekly chart was drawing too many time labels per day. On narrower chart widths the labels overlapped and looked like one merged timestamp string.

## Change

The weekly time row now adapts to available pixels per day:

1. Wide chart: 06:00, 13:00 and 16:00.
2. Medium chart: 06:00 and 16:00.
3. Tight chart: 13:00 only.
4. Very tight chart: day labels only.

The day label itself marks the 00:00 boundary, so the chart still gives a daily time reference without clutter.

## Guardrails

- Raw half hourly data is unchanged.
- Loader files are unchanged.
- CSV paths are unchanged.
- The rule is guarded to windows not greater than 1 week.
- Both the live V6 page and the embedded article chart use this shared renderer.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Manual checks

1. Open /uk_energy_tracking_v6/ and select 1 week.
2. Confirm the day labels are clear.
3. Confirm the time labels no longer collide.
4. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and select Latest 1 week.
5. Confirm the same behaviour.
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
    print("V6 adaptive weekly time tick repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
