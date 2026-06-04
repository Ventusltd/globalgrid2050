from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "index": ROOT / "uk_energy_tracking_v6" / "index.md",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_MOBILE_INSPECT_BUTTONS_REPORT.md",
}

TOUCHED = []
NEW_VERSION = "20260604inspect2"


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
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:180]}")
    return text.replace(old, new, 1)


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)

    must_contain(text, "function ensureInspectControls", "renderer inspect controls")
    must_contain(text, "previous point", "renderer previous button")
    must_contain(text, "next point", "renderer next button")

    helper_marker = "function ensureInspectControls(canvasId,result){"
    style_helper = "function ensureInspectControlStyles(){if(document.getElementById('v6-inspect-control-style'))return;var s=document.createElement('style');s.id='v6-inspect-control-style';s.textContent='.v6-inspect-controls{display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 0;font-family:Courier New,Courier,monospace}.v6-inspect-button{border:1px solid #00ffff;border-radius:10px;padding:9px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer}.v6-inspect-readout{flex:1;min-width:260px;color:#00ff88;border:1px solid rgba(0,255,255,.25);border-radius:10px;padding:9px 11px;background:#080b10;line-height:1.35}.v6-inspect-prev{order:1}.v6-inspect-readout{order:2}.v6-inspect-next{order:3}@media (max-width:700px) and (orientation:portrait){.v6-inspect-controls[style]{display:grid!important;grid-template-columns:1fr 1fr;align-items:stretch}.v6-inspect-prev{order:1}.v6-inspect-next{order:2}.v6-inspect-readout{order:3;grid-column:1 / 3;min-width:0}.v6-inspect-button{width:100%;text-align:center}}';document.head.appendChild(s)}\n  " + helper_marker
    if "function ensureInspectControlStyles" not in text:
        text = replace_once(text, helper_marker, style_helper, "insert inspect control style helper")

    old_bar_style = "var wrap=c.parentElement;var bar=document.createElement('div');bar.id=canvasId+'-inspect-controls';bar.style.cssText='display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 0;font-family:Courier New,Courier,monospace';"
    new_bar_style = "ensureInspectControlStyles();var wrap=c.parentElement;var bar=document.createElement('div');bar.id=canvasId+'-inspect-controls';bar.className='v6-inspect-controls';"
    if old_bar_style in text:
        text = replace_once(text, old_bar_style, new_bar_style, "inspect bar class")

    old_out_style = "out.style.cssText='flex:1;min-width:260px;color:#00ff88;border:1px solid rgba(0,255,255,.25);border-radius:10px;padding:9px 11px;background:#080b10;line-height:1.35';"
    new_out_style = "out.className='v6-inspect-readout';"
    if old_out_style in text:
        text = replace_once(text, old_out_style, new_out_style, "inspect readout class")

    old_button_style = "[prev,next].forEach(function(b){b.style.cssText='border:1px solid #00ffff;border-radius:10px;padding:9px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer'});"
    new_button_style = "prev.className='v6-inspect-button v6-inspect-prev';next.className='v6-inspect-button v6-inspect-next';"
    if old_button_style in text:
        text = replace_once(text, old_button_style, new_button_style, "inspect button classes")

    # Keep DOM order as previous, readout, next. CSS order controls mobile portrait layout.
    must_contain(text, "function ensureInspectControlStyles", "renderer style helper")
    must_contain(text, "v6-inspect-controls[style]", "renderer mobile portrait grid rule")
    must_contain(text, "v6-inspect-prev", "renderer previous class")
    must_contain(text, "v6-inspect-next", "renderer next class")
    must_contain(text, "v6-inspect-readout", "renderer readout class")

    write(path, text)


def bump_cache(path):
    text = read(path)
    must_contain(text, "render_price_chart.js?v=", str(path))
    import re
    text2 = re.sub(r"render_price_chart\.js\?v=[A-Za-z0-9_.-]+", f"render_price_chart.js?v={NEW_VERSION}", text)
    must_contain(text2, f"render_price_chart.js?v={NEW_VERSION}", str(path))
    write(path, text2)


def write_report():
    report = f"""# V6 Repair Report: Mobile Inspect Buttons

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

This repair changes only the inspection control layout and cache version references.

## Behaviour

1. Desktop and wider layouts keep the previous point button, readout and next point button in a normal row.
2. Mobile portrait places the previous point and next point buttons beside each other.
3. The selected point readout moves below the 2 buttons in mobile portrait.
4. The shared renderer is cache busted to `{NEW_VERSION}` on both public pages.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails

- No data files changed.
- No loader files changed.
- No source data paths changed.
- No chart calculations changed.
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
    bump_cache(FILES["index"])
    bump_cache(FILES["article"])
    write_report()
    print("V6 mobile inspect button layout repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
