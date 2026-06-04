from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_CHART_CONTEXT_LABELS_REPORT.md",
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
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:140]}")
    return text.replace(old, new, 1)


def patch_article():
    path = FILES["article"]
    text = read(path)

    old_controls = '''<div class="chart-controls" id="preset-grid">
                    <button type="button" data-start="2016-01-01" data-period="10y">10 year daily view</button>
                    <button type="button" data-start="2019-11-01" data-period="6m">2019 to 2020</button>
                    <button type="button" data-start="2020-11-01" data-period="6m">2020 to 2021</button>
                    <button type="button" data-start="2021-05-01" data-period="6m">2021 shock</button>
                    <button type="button" data-start="2022-06-01" data-period="6m">2022 crisis</button>
                    <button type="button" data-start="2022-12-01" data-period="6m">2023 negative prices</button>
                    <button type="button" data-dynamic="latest" data-period="24h">Latest 24 hours</button>
                    <button type="button" data-dynamic="latest" data-period="48h">Latest 48 hours</button>
                    <button type="button" data-dynamic="latest" data-period="7d" class="active">Latest 1 week</button>
                </div>'''

    new_controls = '''<div class="chart-controls" id="preset-grid">
                    <button type="button" data-start="2016-01-01" data-period="10y">10 year daily view</button>
                    <button type="button" data-start="2019-11-01" data-period="6m">COVID demand shock</button>
                    <button type="button" data-start="2020-11-01" data-period="6m">Post COVID gas squeeze</button>
                    <button type="button" data-start="2021-05-01" data-period="6m">2021 price spike</button>
                    <button type="button" data-start="2022-06-01" data-period="6m">Ukraine energy crisis</button>
                    <button type="button" data-start="2022-12-01" data-period="6m">Negative price regime</button>
                    <button type="button" data-dynamic="latest" data-period="24h">Latest 24 hours</button>
                    <button type="button" data-dynamic="latest" data-period="48h">Latest 48 hours</button>
                    <button type="button" data-dynamic="latest" data-period="7d" class="active">Latest 1 week</button>
                </div>
                <p class="chart-context-note">Longer windows show the market arc: COVID demand shock, post COVID gas tightening, the 2021 scarcity spike, the Ukraine energy crisis and the later negative price regime. Short windows show half hourly behaviour: 24 hours equals 48 settlement periods, 48 hours equals 96 and 1 week equals 336. Future gas and LNG stress, including Middle East shipping and Iran related risk, can be watched through the same price lens.</p>'''

    if "chart-context-note" not in text:
        text = replace_once(text, old_controls, new_controls, "article chart controls")

    old_css = ".chart-controls button.active { background:#06282c; color:#fff; box-shadow:0 0 14px rgba(0,255,255,.25); }"
    new_css = old_css + "\n        .chart-context-note { margin:8px 0 14px 0; color:var(--muted); font-size:calc(var(--reader-font-size) * .88); line-height:1.55; }"
    if ".chart-context-note" not in text.split("</style>", 1)[0]:
        text = replace_once(text, old_css, new_css, "article chart context CSS")

    must_contain(text, "COVID demand shock", "article updated button")
    must_contain(text, "Ukraine energy crisis", "article updated button")
    must_contain(text, "Middle East shipping and Iran related risk", "article energy risk note")
    write(path, text)


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)

    old_label = "function shortTickLabel(t,span){var d=new Date(t);if(span<=2.1*86400000)return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}"
    new_label = "function shortTickLabel(t,span){var d=new Date(t);if(span<=2.1*86400000)return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}\n  function shortTimeLabel(t){return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}"
    if "function shortTimeLabel" not in text:
        text = replace_once(text, old_label, new_label, "renderer short time helper")

    old_ticks = "function drawShortWindowTicks(g,w,h,q,pad,t0,t1,span){if(span>7.1*86400000)return;var interval=span<=1.1*86400000?3*3600000:span<=2.1*86400000?6*3600000:86400000;var first=Math.ceil(t0/interval)*interval;g.save();g.font=10*q+'px Courier New';g.textAlign='center';for(var t=first;t<t1;t+=interval){var x=pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.10)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.fillText(shortTickLabel(t,span),x,h-pad.bottom+40*q)}g.restore()}"
    new_ticks = "function drawShortWindowTicks(g,w,h,q,pad,t0,t1,span){if(span>7.1*86400000)return;g.save();g.textAlign='center';if(span>2.1*86400000){var day=86400000,firstDay=Math.ceil(t0/day)*day;for(var d=firstDay;d<t1;d+=day){var dx=pad.left+((d-t0)/(t1-t0))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(dx,pad.top);g.lineTo(dx,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.font=10*q+'px Courier New';g.fillText(shortTickLabel(d,span),dx,h-pad.bottom+38*q);[0,6,13,16].forEach(function(hr){var tt=d+hr*3600000;if(tt<=t0||tt>=t1)return;var x=pad.left+((tt-t0)/(t1-t0))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.055)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='rgba(154,163,182,.72)';g.font=8*q+'px Courier New';g.fillText(shortTimeLabel(tt),x,h-pad.bottom+52*q)})}g.restore();return}var interval=span<=1.1*86400000?3*3600000:6*3600000;var first=Math.ceil(t0/interval)*interval;g.font=10*q+'px Courier New';for(var t=first;t<t1;t+=interval){var x=pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.10)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='#9aa3b6';g.fillText(shortTickLabel(t,span),x,h-pad.bottom+40*q)}g.restore()}"
    if "[0,6,13,16].forEach" not in text:
        text = replace_once(text, old_ticks, new_ticks, "renderer weekly day and time ticks")

    must_contain(text, "span>7.1*86400000", "renderer one week guard")
    must_contain(text, "[0,6,13,16].forEach", "renderer weekly time markers")
    write(path, text)


def assert_final_state():
    article = read(FILES["article"])
    renderer = read(FILES["renderer"])
    for needle in ["COVID demand shock", "Post COVID gas squeeze", "2021 price spike", "Ukraine energy crisis", "Negative price regime", "Latest 24 hours", "Latest 48 hours", "Latest 1 week"]:
        must_contain(article, needle, "article final labels")
    must_contain(article, "24 hours equals 48 settlement periods", "article 24h explanation")
    must_contain(article, "1 week equals 336", "article weekly explanation")
    must_contain(article, "Middle East shipping and Iran related risk", "article energy risk wording")
    must_contain(renderer, "function shortTimeLabel", "renderer time helper")
    must_contain(renderer, "[0,6,13,16].forEach", "renderer weekly time markers")
    must_contain(renderer, "span>7.1*86400000", "renderer one week guard")


def write_report():
    report = f"""# V6 Repair Report: Chart Context Labels

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

This repair updates presentation only.

## Changes

1. Main article chart buttons now describe the chosen historical windows more clearly.
2. A short explanatory line below the buttons explains long windows, short half hourly windows and forward gas or LNG stress monitoring.
3. Weekly view now adds light time guide labels at 00:00, 06:00, 13:00 and 16:00 for each day where space permits.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails

- No data files changed.
- No loader files changed.
- No source paths changed.
- Weekly time labels remain guarded to windows not greater than 1 week.

## Manual checks

1. Open the main article and confirm button labels read correctly.
2. Confirm the explanatory sentence appears under the buttons.
3. Select Latest 1 week and check day labels plus small time guide labels.
4. Confirm 24 hour and 48 hour views are not cluttered.
"""
    FILES["report"].write_text(report, encoding="utf-8")
    if str(FILES["report"].relative_to(ROOT)) not in TOUCHED:
        TOUCHED.append(str(FILES["report"].relative_to(ROOT)))


def main():
    ai = read(FILES["ai_start"])
    protocol = read(FILES["protocol"])
    must_contain(ai, "Do not directly rewrite large HTML, CSS or JavaScript files", "AI_START_HERE")
    must_contain(protocol, "All V6 changes", "V6 protocol")
    patch_article()
    patch_renderer()
    assert_final_state()
    write_report()
    print("V6 chart context label repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
