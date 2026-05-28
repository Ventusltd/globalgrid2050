from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_trend_title_safe_zone.md"


def main():
    txt = FS.read_text()

    # In minimalist Trend mode, reserve a proper header band so the cyan trace cannot cut through the title.
    txt = re.sub(
        r"var pad=MINIMAL\?\{left:[^}]+\}:\{left:[^}]+\};",
        "var pad=MINIMAL?{left:72*q,right:62*q,top:96*q,bottom:76*q}:{left:(isLandscape?238:158)*q,right:(isLandscape?74:62)*q,top:(isLandscape?76:112)*q,bottom:(isLandscape?118:142)*q};",
        txt,
        count=1,
    )

    # Keep the minimalist title visually above the chart activity zone.
    txt = txt.replace(
        "g.fillText(MINIMAL?'£/MWh':'ELECTRICITY PRICE £/MWh',pad.left,MINIMAL?24*q:(isLandscape?28:64)*q);",
        "g.fillText(MINIMAL?'£/MWh':'ELECTRICITY PRICE £/MWh',pad.left,MINIMAL?40*q:(isLandscape?28:64)*q);",
    )

    # Strengthen the separation by pushing Trend mode x axis labels slightly lower but still above browser chrome.
    txt = txt.replace(
        "g.fillText(axisLabel(ts,span),x,h-52*q)",
        "g.fillText(axisLabel(ts,span),x,MINIMAL?h-44*q:h-52*q)",
    )

    FS.write_text(txt)

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d", "20260527e", "20260527f", "20260527g", "20260527h", "20260527i", "20260527j", "20260527k", "20260527l", "20260527m", "20260527n", "20260527o"]:
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527p")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 trend title safe zone patch\n\n"
        "Moved the minimalist Trend mode title into a protected header band above the chart activity zone. "
        "In Trend mode the plot now starts lower, so cyan price spikes cannot cut through the `£/MWh` title. "
        "The start and end date labels remain visible at the bottom, with cache key updated to 20260527p.\n"
    )


if __name__ == "__main__":
    main()
