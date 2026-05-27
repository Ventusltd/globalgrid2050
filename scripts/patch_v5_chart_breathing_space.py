from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
BASE_PATCH = ROOT / "scripts" / "patch_v5_chart_overlap_controls.py"
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_chart_overlap_controls.md"


def replace_any(text, pairs, label):
    for old, new in pairs:
        if old in text:
            return text.replace(old, new, 1)
    raise SystemExit(f"Missing expected block: {label}")


def main():
    runpy.run_path(str(BASE_PATCH), run_name="__main__")

    ui = UI.read_text()
    ui = replace_any(ui, [
        ("pad={left:68*q,right:32*q,top:46*q,bottom:88*q}", "pad={left:68*q,right:32*q,top:46*q,bottom:122*q}"),
        ("pad={left:68*q,right:32*q,top:42*q,bottom:64*q}", "pad={left:68*q,right:32*q,top:46*q,bottom:122*q}"),
    ], "normal chart padding")
    ui = replace_any(ui, [
        ("drawDateTick(g,x,h-30*q,ts,q", "drawDateTick(g,x,h-46*q,ts,q"),
        ("drawDateTick(g,x,h-34*q,ts,q", "drawDateTick(g,x,h-46*q,ts,q"),
    ], "normal date label breathing space")
    ui = ui.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.60")
    ui = ui.replace("Math.min(g.canvas.height-70*q,y+38*q)", "Math.min(g.canvas.height-100*q,y+38*q)")
    UI.write_text(ui)

    fs = FS.read_text()
    fs = fs.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.60")
    fs = fs.replace("Math.min(g.canvas.height-68*q,y+38*q)", "Math.min(g.canvas.height-92*q,y+38*q)")
    FS.write_text(fs)

    idx = INDEX.read_text()
    idx = idx.replace("price-history-ui.js?v=20260527b", "price-history-ui.js?v=20260527d")
    idx = idx.replace("price-history-fullscreen.js?v=20260527b", "price-history-fullscreen.js?v=20260527d")
    idx = idx.replace("price-history-ui.js?v=20260527c", "price-history-ui.js?v=20260527d")
    idx = idx.replace("price-history-fullscreen.js?v=20260527c", "price-history-fullscreen.js?v=20260527d")
    INDEX.write_text(idx)

    report = REPORT.read_text() if REPORT.exists() else "# V5 chart overlap and control placement patch\n"
    report += "\n## Breathing space refinement\n\n"
    report += "Added extra bottom canvas padding in normal chart view, lifted short window date labels upward and forced low event labels to flip above earlier. Cache keys updated to 20260527d.\n"
    REPORT.write_text(report)


if __name__ == "__main__":
    main()
