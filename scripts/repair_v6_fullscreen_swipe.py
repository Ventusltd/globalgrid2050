from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"

for rel in [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js",
]:
    path = ROOT / rel
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    path.read_text(encoding="utf-8")

protocol = (V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md").read_text(encoding="utf-8")
if "Full screen, period arrows, mobile portrait, mobile landscape and desktop" not in protocol:
    raise RuntimeError("V6 protocol fullscreen contract not recognised")

path = V6 / "price_history_chart/control_price_history/control_price_history.js"
text = path.read_text(encoding="utf-8")

if "attachFullscreenSwipe" in text:
    raise RuntimeError("Fullscreen swipe already appears to be installed")

old = """  function closeFullscreen(){var o=$('price-history-fullscreen-overlay');if(!o)return;o.classList.remove('open');document.documentElement.classList.remove('v5-chart-open');document.body.classList.remove('v5-chart-open')}
  function start(){ensureYearOptions();ensureModeTabs();ensurePeriodControls();ensureStartDate();attachPeriodButtons('price-history-fullscreen-period');var btn=$('price-history-refresh'),period=$('price-history-period'),startEl=$('price-history-start'),year=$('price-history-year');if(btn)btn.addEventListener('click',load);if(period)period.addEventListener('change',load);if(startEl)startEl.addEventListener('change',load);if(year)year.addEventListener('change',function(){var s=$('price-history-start');if(s)s.value='';ensureStartDate();load()});var full=$('price-history-fullscreen-btn'),close=$('price-history-fullscreen-close');if(full)full.addEventListener('click',openFullscreen);if(close)close.addEventListener('click',closeFullscreen);window.addEventListener('resize',debouncedLoad);load()}
"""
new = """  function closeFullscreen(){var o=$('price-history-fullscreen-overlay');if(!o)return;o.classList.remove('open');document.documentElement.classList.remove('v5-chart-open');document.body.classList.remove('v5-chart-open')}
  function attachFullscreenSwipe(){var c=$('price-history-fullscreen-canvas');if(!c||c.dataset.swipeBound)return;c.dataset.swipeBound='1';var sx=0,sy=0,active=false;c.addEventListener('touchstart',function(e){if(!e.touches||!e.touches.length)return;var t=e.touches[0];sx=t.clientX;sy=t.clientY;active=true},{passive:true});c.addEventListener('touchend',function(e){if(!active)return;active=false;var t=e.changedTouches&&e.changedTouches[0];if(!t)return;var dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return;nudgePeriod(dx<0?1:-1)},{passive:true})}
  function start(){ensureYearOptions();ensureModeTabs();ensurePeriodControls();ensureStartDate();attachPeriodButtons('price-history-fullscreen-period');attachFullscreenSwipe();var btn=$('price-history-refresh'),period=$('price-history-period'),startEl=$('price-history-start'),year=$('price-history-year');if(btn)btn.addEventListener('click',load);if(period)period.addEventListener('change',load);if(startEl)startEl.addEventListener('change',load);if(year)year.addEventListener('change',function(){var s=$('price-history-start');if(s)s.value='';ensureStartDate();load()});var full=$('price-history-fullscreen-btn'),close=$('price-history-fullscreen-close');if(full)full.addEventListener('click',openFullscreen);if(close)close.addEventListener('click',closeFullscreen);window.addEventListener('resize',debouncedLoad);load()}
"""

if old not in text:
    raise RuntimeError("Expected control file structure not found. Refusing uncontrolled swipe patch.")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

updated = path.read_text(encoding="utf-8")
for token in ["attachFullscreenSwipe", "touchstart", "touchend", "nudgePeriod(dx<0?1:-1)"]:
    if token not in updated:
        raise RuntimeError(f"Post repair assertion failed: {token}")

report = V6 / "V6_REPAIR_FULLSCREEN_SWIPE_REPORT.md"
report.write_text("""# V6 Repair Report: Fullscreen Swipe

Status: prepared by deterministic repair script.

## Scope

This repair adds left and right touch swipe handling to the V6 electricity price fullscreen canvas.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js`
2. `uk_energy_tracking_v6/V6_REPAIR_FULLSCREEN_SWIPE_REPORT.md`

## Explicit non scope

No V5 panels were restored.
No forecast logic was changed.
No V5 file was modified.

## Required maintainer test

Open `/uk_energy_tracking_v6/`, enter fullscreen chart on a mobile device, swipe left and right, and confirm the period changes exactly as the visible arrows do.
""", encoding="utf-8")

print("V6 fullscreen swipe repair completed locally by script.")
