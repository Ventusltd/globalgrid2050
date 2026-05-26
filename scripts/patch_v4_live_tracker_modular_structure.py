from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "uk_energy_tracking_v3" / "index.md"
V4 = ROOT / "uk_energy_tracking_v4" / "index.md"
OUT = ROOT / "uk_energy_tracking_v4"
DIARY = OUT / "WORK_DIARY.md"
REPORT = ROOT / "gridbot_reports" / "v4_live_tracker_modular_structure.md"

START = "<script>\n(function(){\n  var ENERGY=\"/uk_energy_tracking_v4/live_grid_energy.json\""
END = "\n})();\n</script>"
TAGS = """<script src='/uk_energy_tracking_v4/live-config.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-helpers.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-gauges.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-transport.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-oil-chart.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-app.js?v=20260526a'></script>"""


def between(text, a, b):
    x = text.find(a)
    if x < 0:
        raise SystemExit(f"marker not found: {a}")
    y = text.find(b, x)
    if y < 0:
        raise SystemExit(f"marker not found: {b}")
    return x, y


def main():
    v3 = V3.read_text(encoding="utf-8")
    if "/uk_energy_tracking_v3/live_grid_energy.json" not in v3:
        raise SystemExit("V3 benchmark marker missing")

    text = V4.read_text(encoding="utf-8")
    if "live-config.js" in text:
        print("V4 live tracker already modular")
        return

    start = text.find(START)
    if start < 0:
        raise SystemExit("V4 inline live tracker start not found")
    end = text.find(END, start)
    if end < 0:
        raise SystemExit("V4 inline live tracker end not found")
    end += len(END)

    block = text[start:end]
    body = block[len("<script>\n(function(){\n"):-len("\n})();\n</script>")]

    m1 = body.find("  function fmt(n,dp)")
    m2 = body.find("  function renderGauge(name,value)")
    m3 = body.find("  function renderCommodities(oil,fuel)")
    m4 = body.find("  var oilChartState")
    m5 = body.find("  function renderEvPrices(ev)")
    m6 = body.find("  function refresh()")
    if min(m1, m2, m3, m4, m5, m6) < 0:
        raise SystemExit("one or more split markers missing")

    modules = {
        "live-config.js": body[:m1],
        "live-helpers.js": body[m1:m2],
        "live-gauges.js": body[m2:m3],
        "live-transport.js": body[m3:m4] + "\n" + body[m5:m6],
        "live-oil-chart.js": body[m4:m5],
        "live-app.js": body[m6:],
    }

    headers = {
        "live-config.js": "// V4 live tracker config. Load first.\n",
        "live-helpers.js": "// V4 live tracker helpers. Depends on config.\n",
        "live-gauges.js": "// V4 live tracker gauges and generation mix rendering.\n",
        "live-transport.js": "// V4 live tracker commodity, road fuel and EV rendering.\n",
        "live-oil-chart.js": "// V4 live tracker oil history chart.\n",
        "live-app.js": "// V4 live tracker app boot and refresh loop. Load last.\n",
    }

    for name, content in modules.items():
        if "/uk_energy_tracking_v3/" in content:
            raise SystemExit(f"unexpected V3 reference in {name}")
        (OUT / name).write_text(headers[name] + content.strip() + "\n", encoding="utf-8")

    V4.write_text(text[:start] + TAGS + "\n" + text[end:], encoding="utf-8")

    REPORT.write_text("""# V4 live tracker modular structure

V4 live tracker JavaScript was split using the V3 tracker as benchmark and the solar BESS sandbox modular pattern as the structural model.

## Load order

```text
live-config.js
live-helpers.js
live-gauges.js
live-transport.js
live-oil-chart.js
live-app.js
```

V3 and the stable tracker were not modified.
""", encoding="utf-8")

    note = """\n\n## Diary entry: 2026-05-26 V4 live tracker modular structure\n\nV4 live tracker logic was split into config, helpers, gauges, transport, oil chart and app boot files. V3 was used only as the read only benchmark. The structure follows the adjacent sandbox modular pattern where index keeps page structure and external JavaScript files load in a deliberate dependency order.\n"""
    d = DIARY.read_text(encoding="utf-8")
    if "V4 live tracker modular structure" not in d:
        DIARY.write_text(d + note, encoding="utf-8")

    print("V4 live tracker modular structure patch complete")


if __name__ == "__main__":
    main()
