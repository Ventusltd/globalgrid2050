from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / "uk_energy_tracking"
V2 = ROOT / "uk_energy_tracking_v2"
WF = ROOT / ".github" / "workflows"
SCRIPTS = ROOT / "scripts"
REPORT = ROOT / "gridbot_reports" / "document_uk_energy_trackers.md"

TRACKERS = {
    "stable": {
        "folder": V1,
        "url": "https://globalgrid2050.com/uk_energy_tracking/",
        "label": "Stable UK Live Grid Tracker",
        "workflow": WF / "fetch_uk_energy_and_prices.yml",
        "energy_script": SCRIPTS / "update_uk_energy.py",
        "price_script": SCRIPTS / "update_uk_price.py",
        "oil_script": SCRIPTS / "update_oil_prices.py",
        "fuel_script": SCRIPTS / "update_uk_fuel_prices.py",
    },
    "v2": {
        "folder": V2,
        "url": "https://globalgrid2050.com/uk_energy_tracking_v2/",
        "label": "UK Live Grid Tracker V2 Development Twin",
        "workflow": WF / "fetch_uk_energy_and_prices_v2.yml",
        "energy_script": SCRIPTS / "update_uk_energy_v2.py",
        "price_script": SCRIPTS / "update_uk_price_v2.py",
        "oil_script": SCRIPTS / "update_oil_prices_v2.py",
        "fuel_script": SCRIPTS / "update_uk_fuel_prices_v2.py",
    },
}

FEEDS = [
    "live_grid_energy.json",
    "live_grid_price.json",
    "live_oil_prices.json",
    "oil_price_history.geojson",
    "live_uk_fuel_prices.json",
    "ev_charging_prices.json",
]


def read_text(path):
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def sha(path):
    if not path.exists():
        return "missing"
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def line_count(path):
    if not path.exists():
        return 0
    return len(read_text(path).splitlines())


def json_summary(path):
    if not path.exists():
        return "missing"
    try:
        data = json.loads(read_text(path))
    except Exception as exc:
        return f"invalid JSON: {type(exc).__name__}"
    if isinstance(data, dict):
        keys = ", ".join(sorted(data.keys())[:12])
        updated = data.get("updated") or data.get("date") or data.get("timestamp")
        extra = f"; updated: {updated}" if updated else ""
        return f"object keys: {keys}{extra}"
    if isinstance(data, list):
        return f"list length: {len(data)}"
    return type(data).__name__


def find_js_feed_refs(page_text):
    refs = sorted(set(re.findall(r"/uk_energy_tracking(?:_v2)?/[A-Za-z0-9_./-]+(?:json|geojson)", page_text)))
    return refs


def workflow_summary(path):
    text = read_text(path)
    if not text:
        return ["workflow missing"]
    rows = []
    schedule = re.findall(r"cron:\s*['\"]([^'\"]+)['\"]", text)
    if schedule:
        rows.append("cron: " + ", ".join(schedule))
    else:
        rows.append("cron: none")
    rows.append("manual workflow_dispatch: " + ("yes" if "workflow_dispatch" in text else "no"))
    rows.append("uses GRIDBOT_PAT: " + ("yes" if "GRIDBOT_PAT" in text else "no"))
    rows.append("concurrency: " + ("yes" if "concurrency:" in text else "no"))
    staged = re.findall(r"git add ([^\n]+)", text)
    if staged:
        rows.append("git add targets: " + " | ".join(s.strip() for s in staged))
    return rows


def script_summary(path):
    text = read_text(path)
    if not text:
        return ["script missing"]
    rows = []
    folder_match = re.search(r"FOLDER\s*=.*?/(?:\s*)[\"']([^\"']+)[\"']", text)
    if folder_match:
        rows.append("writes folder: " + folder_match.group(1))
    json_match = re.search(r"JSON_FILE\s*=\s*FOLDER\s*/\s*[\"']([^\"']+)[\"']", text)
    if json_match:
        rows.append("writes JSON: " + json_match.group(1))
    rows.append("zero price guard: " + ("yes" if "zero market price rejected" in text or "preserve_previous_price" in text else "no or not applicable"))
    rows.append("self regulated cadence: " + ("yes" if "MIN_UPDATE_MINUTES" in text or "should_skip_price_update" in text else "no or not applicable"))
    return rows


def tracker_doc(name, meta):
    folder = meta["folder"]
    page = folder / "index.md"
    page_text = read_text(page)
    now = datetime.now(timezone.utc).isoformat()
    lines = []
    lines.append(f"# {meta['label']} Diagnostic Notes")
    lines.append("")
    lines.append(f"Generated: `{now}`")
    lines.append(f"Public URL: `{meta['url']}`")
    lines.append(f"Folder: `{folder.relative_to(ROOT)}`")
    lines.append("")
    lines.append("## Purpose")
    if name == "stable":
        lines.append("This folder is the stable public UK live grid tracker and should be treated as the working reference twin. It must remain protected while V2 is developed.")
    else:
        lines.append("This folder is the isolated V2 development twin. It should mirror the stable tracker for core grid behaviour while carrying transport energy, DESNZ fuel and EV charging experiments.")
    lines.append("")
    lines.append("## Core files")
    core = [page, meta["workflow"], meta["energy_script"], meta["price_script"], meta["oil_script"], meta["fuel_script"]]
    for path in core:
        lines.append(f"- `{path.relative_to(ROOT)}` lines `{line_count(path)}` sha `{sha(path)}`")
    lines.append("")
    lines.append("## Feed files")
    for feed in FEEDS:
        path = folder / feed
        lines.append(f"- `{path.relative_to(ROOT)}` sha `{sha(path)}` summary: {json_summary(path)}")
    lines.append("")
    lines.append("## Workflow behaviour")
    for item in workflow_summary(meta["workflow"]):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("## Script behaviour")
    for label in ["energy_script", "price_script", "oil_script", "fuel_script"]:
        path = meta[label]
        lines.append(f"### `{path.relative_to(ROOT)}`")
        for item in script_summary(path):
            lines.append(f"- {item}")
        lines.append("")
    lines.append("## Front end feed references")
    refs = find_js_feed_refs(page_text)
    if refs:
        for ref in refs:
            lines.append(f"- `{ref}`")
    else:
        lines.append("- no absolute JSON feed references found")
    lines.append("")
    lines.append("## Operational notes")
    if name == "stable":
        lines.append("- This tracker is the live reference and correction source.")
        lines.append("- Do not use it for experimental transport energy patches.")
        lines.append("- If V2 fails, compare against this folder before changing anything.")
    else:
        lines.append("- This tracker should use only V2 JSON outputs for grid values.")
        lines.append("- Its workflow should be offset from the stable tracker to reduce push races.")
        lines.append("- Transport energy work belongs here first, not in the stable tracker.")
    lines.append("")
    return "\n".join(lines)


def comparison_doc():
    now = datetime.now(timezone.utc).isoformat()
    lines = ["# UK Energy Tracker Stable vs V2 Comparison", "", f"Generated: `{now}`", ""]
    lines.append("## Summary")
    lines.append("The stable tracker is the public working reference. V2 is the isolated development twin for transport energy work.")
    lines.append("")
    lines.append("## File comparison")
    pairs = [
        ("page", V1 / "index.md", V2 / "index.md"),
        ("energy script", SCRIPTS / "update_uk_energy.py", SCRIPTS / "update_uk_energy_v2.py"),
        ("price script", SCRIPTS / "update_uk_price.py", SCRIPTS / "update_uk_price_v2.py"),
        ("oil script", SCRIPTS / "update_oil_prices.py", SCRIPTS / "update_oil_prices_v2.py"),
        ("fuel script", SCRIPTS / "update_uk_fuel_prices.py", SCRIPTS / "update_uk_fuel_prices_v2.py"),
        ("workflow", WF / "fetch_uk_energy_and_prices.yml", WF / "fetch_uk_energy_and_prices_v2.yml"),
    ]
    for label, a, b in pairs:
        same = sha(a) == sha(b)
        lines.append(f"- {label}: stable sha `{sha(a)}`, V2 sha `{sha(b)}`, identical: `{same}`")
    lines.append("")
    lines.append("## Feed comparison")
    for feed in FEEDS:
        a = V1 / feed
        b = V2 / feed
        lines.append(f"- {feed}: stable `{sha(a)}`, V2 `{sha(b)}`, V2 exists: `{b.exists()}`")
    lines.append("")
    lines.append("## Convergence")
    lines.append("- Both trackers use the same public data families for core grid values.")
    lines.append("- Both use GitHub Actions and GridBot authenticated execution.")
    lines.append("- Both write JSON feeds consumed by the front end.")
    lines.append("- V2 should follow the stable tracker cadence while keeping separate output files.")
    lines.append("")
    lines.append("## Divergence")
    lines.append("- V2 contains DESNZ road fuel and EV charging comparison work.")
    lines.append("- V2 has isolated `_v2` scripts and V2 folder outputs.")
    lines.append("- V2 may contain experimental UI and iframe references that are not present in the stable tracker.")
    lines.append("")
    lines.append("## Recovery rule")
    lines.append("If V2 breaks, compare against the stable tracker and patch only V2 files, V2 scripts or V2 workflows.")
    lines.append("")
    return "\n".join(lines)


def main():
    outputs = []
    for name, meta in TRACKERS.items():
        out = meta["folder"] / "DIAGNOSTIC_NOTES.md"
        out.write_text(tracker_doc(name, meta), encoding="utf-8")
        outputs.append(out.relative_to(ROOT).as_posix())
    compare = ROOT / "UK_ENERGY_TRACKER_COMPARISON.md"
    compare.write_text(comparison_doc(), encoding="utf-8")
    outputs.append(compare.relative_to(ROOT).as_posix())
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("# UK energy tracker documentation generator report\n\n" + "\n".join(f"- wrote `{x}`" for x in outputs) + "\n", encoding="utf-8")
    print("wrote diagnostic documentation")
    for item in outputs:
        print(item)


if __name__ == "__main__":
    main()
