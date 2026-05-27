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


def apply_units_and_spacing(text):
    text = text.replace("val===0?'£0':'£'+fmt(val,0)", "val===0?'£0/MWh':'£'+fmt(val,0)+'/MWh'")
    text = text.replace("label+' £'+fmt(Number(r.priceGBPperMWh),2)", "label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh'")
    text = text.replace("label+' '+price", "label+' '+price+'/MWh'")
    text = text.replace("ty=above?Math.max(50*q,y-38*q):Math.min(g.canvas.height-100*q,y+38*q)", "ty=above?Math.max(58*q,y-46*q):Math.min(g.canvas.height-118*q,y+58*q)")
    text = text.replace("ty=above?Math.max(58*q,y-36*q):Math.min(g.canvas.height-92*q,y+38*q)", "ty=above?Math.max(64*q,y-46*q):Math.min(g.canvas.height-110*q,y+58*q)")
    return text


def main():
    runpy.run_path(str(BASE_PATCH), run_name="__main__")

    ui = UI.read_text()
    ui = replace_any(ui, [
        ("pad={left:68*q,right:32*q,top:46*q,bottom:88*q}", "pad={left:86*q,right:32*q,top:46*q,bottom:136*q}"),
        ("pad={left:68*q,right:32*q,top:42*q,bottom:64*q}", "pad={left:86*q,right:32*q,top:46*q,bottom:136*q}"),
        ("pad={left:68*q,right:32*q,top:46*q,bottom:122*q}", "pad={left:86*q,right:32*q,top:46*q,bottom:136*q}"),
    ], "normal chart padding")
    ui = replace_any(ui, [
        ("drawDateTick(g,x,h-30*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q"),
        ("drawDateTick(g,x,h-34*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q"),
        ("drawDateTick(g,x,h-46*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q"),
    ], "normal date label breathing space")
    ui = ui.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.58")
    ui = ui.replace("ly>g.canvas.height*.60", "ly>g.canvas.height*.58")
    ui = ui.replace("Math.min(g.canvas.height-70*q,y+38*q)", "Math.min(g.canvas.height-118*q,y+58*q)")
    ui = ui.replace("Math.min(g.canvas.height-100*q,y+38*q)", "Math.min(g.canvas.height-118*q,y+58*q)")
    ui = ui.replace("Math.max(50*q,y-38*q)", "Math.max(58*q,y-46*q)")
    ui = apply_units_and_spacing(ui)
    UI.write_text(ui)

    fs = FS.read_text()
    fs = fs.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.58")
    fs = fs.replace("ly>g.canvas.height*.60", "ly>g.canvas.height*.58")
    fs = fs.replace("Math.min(g.canvas.height-68*q,y+38*q)", "Math.min(g.canvas.height-110*q,y+58*q)")
    fs = fs.replace("Math.min(g.canvas.height-92*q,y+38*q)", "Math.min(g.canvas.height-110*q,y+58*q)")
    fs = fs.replace("Math.max(58*q,y-36*q)", "Math.max(64*q,y-46*q)")
    fs = apply_units_and_spacing(fs)
    FS.write_text(fs)

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d"]:
        idx = idx.replace(f"price-history-ui.js?v={old}", "price-history-ui.js?v=20260527e")
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527e")
    INDEX.write_text(idx)

    report = REPORT.read_text() if REPORT.exists() else "# V5 chart overlap and control placement patch\n"
    report += "\n## Units and red label spacing refinement\n\n"
    report += "Added explicit £/MWh units to y axis and HIGH/LOW event labels. Increased label spacing so red event text does not clash with date labels. Cache keys updated to 20260527e.\n"
    REPORT.write_text(report)


if __name__ == "__main__":
    main()
