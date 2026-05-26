from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "uk_energy_tracking_v3" / "index.md"
V4 = ROOT / "uk_energy_tracking_v4" / "index.md"
JS = ROOT / "uk_energy_tracking_v4" / "live-tracker.js"
DIARY = ROOT / "uk_energy_tracking_v4" / "WORK_DIARY.md"
REPORT = ROOT / "gridbot_reports" / "v4_live_tracker_script_modularisation.md"

START = "<script>\n(function(){\n  var ENERGY=\"/uk_energy_tracking_v4/live_grid_energy.json\""
END = "\n})();\n</script>"
TAG = "<script src='/uk_energy_tracking_v4/live-tracker.js?v=20260526a'></script>"


def main():
    if not V3.exists():
        raise SystemExit("V3 benchmark missing")
    v3 = V3.read_text(encoding="utf-8")
    if "/uk_energy_tracking_v3/live_grid_energy.json" not in v3:
        raise SystemExit("V3 benchmark marker missing")

    text = V4.read_text(encoding="utf-8")
    if TAG in text and JS.exists():
        print("already modularised")
        return

    a = text.find(START)
    if a < 0:
        raise SystemExit("V4 script start not found")
    b = text.find(END, a)
    if b < 0:
        raise SystemExit("V4 script end not found")
    b += len(END)

    block = text[a:b]
    body = block[len("<script>\n"):-len("\n</script>")]
    JS.write_text("// V4 live tracker module. V3 is read only benchmark.\n\n" + body + "\n", encoding="utf-8")
    V4.write_text(text[:a] + TAG + "\n" + text[b:], encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("# V4 live tracker script modularisation\n\nExtracted the V4 inline live tracker JavaScript to `uk_energy_tracking_v4/live-tracker.js`.\n\nV3 and the stable tracker were not modified.\n", encoding="utf-8")

    note = """\n\n## Diary entry: 2026-05-26 V4 live tracker script modularisation\n\nThe remaining inline live tracker script in `uk_energy_tracking_v4/index.md` was extracted to `uk_energy_tracking_v4/live-tracker.js` using V3 as the read only benchmark. V3 and the stable tracker were not modified. This is phase 1 extraction only.\n"""
    diary = DIARY.read_text(encoding="utf-8")
    if "V4 live tracker script modularisation" not in diary:
        DIARY.write_text(diary + note, encoding="utf-8")

    print("V4 live tracker modularised")


if __name__ == "__main__":
    main()
