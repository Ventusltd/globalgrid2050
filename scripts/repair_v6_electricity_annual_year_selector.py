from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "architecture": ROOT / "ARCHITECTURE.md",
    "philosophy": ROOT / "PHILOSOPHY.md",
    "launch_freeze": ROOT / "LAUNCH_FREEZE.md",
    "operator_manual": ROOT / "OPERATOR_MANUAL_V1.md",
    "workflow_registry": ROOT / "WORKFLOW_REGISTRY.md",
    "gridbot_instructions": ROOT / "GRIDBOT_FEATURE_INSTALL_INSTRUCTIONS.md",
    "v5_readme": ROOT / "uk_energy_tracking_v5" / "README.md",
    "v5_reload": ROOT / "uk_energy_tracking_v5" / "AI_RELOAD_INSTRUCTIONS.md",
    "v6_comparison": ROOT / "uk_energy_tracking_v6" / "V5_V6_COMPARISON_REPORT.md",
    "v6_protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "control": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "control_price_history" / "control_price_history.js",
    "index": ROOT / "uk_energy_tracking_v6" / "index.md",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "article_helper": ROOT / "data" / "grid_studies_public" / "gb_electricity_year_selector.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_ELECTRICITY_ANNUAL_YEAR_SELECTOR_REPORT.md",
}

TOUCHED = []


def read(path):
    if not path.exists():
        raise SystemExit(f"Missing required file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def write(path, text):
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if old != text:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        rel = str(path.relative_to(ROOT))
        if rel not in TOUCHED:
            TOUCHED.append(rel)


def must_contain(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Missing expected marker in {label}: {needle[:160]}")


def must_not_contain(text, needle, label):
    if needle in text:
        raise SystemExit(f"Unexpected marker in {label}: {needle[:160]}")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:160]}")
    return text.replace(old, new, 1)


def read_procedural_documents():
    checks = {
        "ai_start": "Do not directly rewrite large HTML, CSS or JavaScript files",
        "architecture": "Use Python, YAML and GitHub Actions for repeatable large file operations",
        "philosophy": "GridBot does not copy and paste entire files",
        "launch_freeze": "Freeze structure. Fix function. Document risks. Clean later.",
        "operator_manual": "AI proposes. Python processes. GitHub records. GridBot executes. The maintainer approves.",
        "workflow_registry": "No workflow should be removed, renamed or archived",
        "gridbot_instructions": "Do not leave the feature field blank unless every earlier feature is repeat safe",
        "v5_readme": "UK Energy Tracking",
        "v5_reload": "AI",
        "v6_comparison": "UK Energy Tracking V5 to V6 Comprehensive Comparison Report",
        "v6_protocol": "All V6 changes, however small or large, must be made through a named GitHub workflow",
    }
    for key, marker in checks.items():
        text = read(FILES[key])
        must_contain(text, marker, key)


def patch_v6_control():
    path = FILES["control"]
    text = read(path)
    must_contain(text, "function ensureYearOptions()", "V6 control existing year selector")
    must_contain(text, "function ensureStartDate()", "V6 control existing start date")
    must_contain(text, "window.V6LoadPriceHistoryData.loadWindow", "V6 control data loader")

    old_head = "var FIRST_YEAR=2016;\n  var STATE={timeMode:'all'};"
    new_head = "var FIRST_YEAR=2016;\n  var YEAR_ROLLOVER_MONTH=0;\n  var YEAR_ROLLOVER_DAY=15;\n  var STATE={timeMode:'all'};"
    if "var YEAR_ROLLOVER_DAY=15;" not in text:
        text = replace_once(text, old_head, new_head, "V6 control rollover constants")

    old_block = "function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var now=futureMaxDate().getUTCFullYear();for(var n=now;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=String(n);y.appendChild(o)}y.value=String(maxDate().getUTCFullYear())}\n  function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):maxDate().getUTCFullYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===maxDate().getUTCFullYear()){start=new Date(maxDate().getTime()-7*86400000)}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}}"
    new_block = "function activeDataYear(){var d=new Date();var y=d.getUTCFullYear();if(d.getUTCMonth()===YEAR_ROLLOVER_MONTH&&d.getUTCDate()<YEAR_ROLLOVER_DAY)return y-1;return y}\n  function yearCutoff(year){var m=maxDate(),active=activeDataYear();if(year===active&&year===m.getUTCFullYear())return m;return new Date(Date.UTC(year,11,31,23,59,59))}\n  function yearLabel(year){return year===activeDataYear()?String(year)+' YTD':String(year)}\n  function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var active=activeDataYear();for(var n=active;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=yearLabel(n);y.appendChild(o)}y.value=String(active)}\n  function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):activeDataYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===activeDataYear()){var cutoff=yearCutoff(selectedYear);start=new Date(cutoff.getTime()-7*86400000);var jan1=new Date(Date.UTC(selectedYear,0,1,0,0,0));if(start<jan1)start=jan1}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}}"
    if "function activeDataYear()" not in text:
        text = replace_once(text, old_block, new_block, "V6 control annual year selector logic")

    old_return = "return{start:start,load:load};"
    new_return = "return{start:start,load:load,activeDataYear:activeDataYear};"
    if new_return not in text:
        text = replace_once(text, old_return, new_return, "V6 control export activeDataYear")

    must_contain(text, "function activeDataYear()", "V6 control active year function")
    must_contain(text, "YEAR_ROLLOVER_DAY=15", "V6 control rollover day")
    must_contain(text, "String(year)+' YTD'", "V6 control YTD label")
    write(path, text)


def patch_v6_index_cache_bust():
    path = FILES["index"]
    text = read(path)
    old = "control_price_history.js?v=20260601d"
    new = "control_price_history.js?v=20260604year2"
    must_contain(text, "price-history-year", "V6 index year select")
    if new not in text:
        text = replace_once(text, old, new, "V6 index control script cache bust")
    must_contain(text, new, "V6 index cache bust new value")
    write(path, text)


def article_helper_text():
    return """(function(){
  var FIRST_YEAR=2016;
  var YEAR_ROLLOVER_MONTH=0;
  var YEAR_ROLLOVER_DAY=15;
  function $(id){return document.getElementById(id)}
  function activeDataYear(){var d=new Date();var y=d.getUTCFullYear();if(d.getUTCMonth()===YEAR_ROLLOVER_MONTH&&d.getUTCDate()<YEAR_ROLLOVER_DAY)return y-1;return y}
  function ymd(d){return d.toISOString().slice(0,10)}
  function label(year){return year===activeDataYear()?String(year)+' YTD':String(year)}
  function maxDate(){return window.V6LoadPriceHistoryData&&window.V6LoadPriceHistoryData.maxDate?window.V6LoadPriceHistoryData.maxDate():new Date()}
  function cutoff(year){return year===activeDataYear()?maxDate():new Date(Date.UTC(year,11,31,23,59,59))}
  function addStyles(){if($('gg2050-year-selector-style'))return;var s=document.createElement('style');s.id='gg2050-year-selector-style';s.textContent='.gg2050-year-select-label{display:flex;align-items:center;gap:8px;border:1px solid rgba(0,255,255,.45);border-radius:10px;padding:8px 10px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold}.gg2050-year-select-label select{background:#05070c;color:#fff;border:1px solid rgba(0,255,255,.35);border-radius:8px;padding:8px;font-family:Courier New,Courier,monospace;font-weight:bold}@media(max-width:700px){.gg2050-year-select-label{width:100%;justify-content:space-between}.gg2050-year-select-label select{width:55%}}';document.head.appendChild(s)}
  function renderYear(year){var start=new Date(Date.UTC(year,0,1,0,0,0));var end=cutoff(year);window.V6LoadPriceHistoryData.loadWindow(start,'12m','all').then(function(result){result.end=end;result.rows=(result.rows||[]).filter(function(r){var t=new Date((r.date?r.date+'T12:00:00Z':(r.priceTimeUTC||r.time)));return t>=start&&t<=end});result.period='12m';window.V6RenderPriceChart.render(result);var status=$('price-history-range-status');if(status)status.textContent=ymd(start)+' to '+ymd(end)+' | '+label(year)+' annual selector | '+(result.rows||[]).length.toLocaleString('en-GB')+' daily points';}).catch(function(err){var status=$('price-history-range-status');if(status)status.textContent='Year chart load failed: '+err;});}
  function init(){var grid=$('preset-grid');if(!grid||$('gg2050-electricity-year-select'))return;if(!window.V6LoadPriceHistoryData||!window.V6RenderPriceChart)return;addStyles();var lab=document.createElement('label');lab.className='gg2050-year-select-label';lab.appendChild(document.createTextNode('Year'));var sel=document.createElement('select');sel.id='gg2050-electricity-year-select';var active=activeDataYear();for(var y=active;y>=FIRST_YEAR;y--){var o=document.createElement('option');o.value=String(y);o.textContent=label(y);sel.appendChild(o)}lab.appendChild(sel);grid.insertBefore(lab,grid.firstChild);sel.addEventListener('change',function(){grid.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});renderYear(Number(sel.value));});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
"""


def patch_article():
    helper_path = FILES["article_helper"]
    helper = article_helper_text()
    must_contain(helper, "YEAR_ROLLOVER_DAY=15", "article helper rollover day")
    must_contain(helper, "loadWindow(start,'12m','all')", "article helper annual window")
    write(helper_path, helper)

    path = FILES["article"]
    text = read(path)
    tag = '    <script src="/data/grid_studies_public/gb_electricity_year_selector.js?v=20260604year2"></script>\n'
    must_contain(text, 'id="preset-grid"', "article preset grid")
    must_contain(text, 'V6LoadPriceHistoryData.loadWindow', "article chart loader")
    if tag not in text:
        text = replace_once(text, "</body>", tag + "</body>", "article helper script tag")
    must_contain(text, "gb_electricity_year_selector.js?v=20260604year2", "article helper script tag installed")
    write(path, text)


def assert_final_state():
    control = read(FILES["control"])
    index = read(FILES["index"])
    article = read(FILES["article"])
    helper = read(FILES["article_helper"])

    must_contain(control, "function activeDataYear()", "control final")
    must_contain(control, "YEAR_ROLLOVER_DAY=15", "control final")
    must_contain(control, "String(year)+' YTD'", "control final")
    must_contain(index, "control_price_history.js?v=20260604year2", "index final")
    must_contain(article, "gb_electricity_year_selector.js?v=20260604year2", "article final")
    must_contain(helper, "id='gg2050-electricity-year-select'", "helper final")
    must_contain(helper, "var FIRST_YEAR=2016", "helper final")
    must_contain(helper, "YEAR_ROLLOVER_DAY=15", "helper final")

    must_contain(control, "window.V6LoadPriceHistoryData.loadWindow", "data path preserved")
    must_contain(read(FILES["v6_protocol"]), "preserves the raw published data chart", "protocol approval sentence")
    must_not_contain(control, "fetch(", "control should not fetch directly")


def write_report():
    body = f"""# V6 Repair Report: Electricity Annual Year Selector

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Procedural documents read

- AI_START_HERE.md
- ARCHITECTURE.md
- PHILOSOPHY.md
- LAUNCH_FREEZE.md
- OPERATOR_MANUAL_V1.md
- WORKFLOW_REGISTRY.md
- GRIDBOT_FEATURE_INSTALL_INSTRUCTIONS.md
- uk_energy_tracking_v5/README.md
- uk_energy_tracking_v5/AI_RELOAD_INSTRUCTIONS.md
- uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md
- uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md

## Scope

This repair adds annual selector behaviour for the GB electricity price charts without changing the source data paths, CSV loader or raw chart renderer contract.

## Intended behaviour

1. The V6 chart year dropdown labels the current active data year as YTD.
2. The active YTD year rolls forward on 15 January UTC.
3. From 1 January to 14 January the previous year remains the active completed data year.
4. The public grid study chart receives a small annual selector generated by a helper script.
5. The article helper loads a 12 month daily window for the selected year.
6. Elexon annual CSV and daily aggregate paths remain unchanged.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails checked

- Direct V6 app editing is avoided by running this deterministic script through a named workflow.
- The script asserts expected old structure before editing.
- The workflow commits only intended files and this report.
- The raw chart continues to use existing V6 loader and renderer functions.
- No shared dataset path is moved.
- V5 remains untouched as the reference twin.

## Maintainer test checklist

1. Open /uk_energy_tracking_v6/.
2. Confirm the Year dropdown shows 2026 YTD during 2026, and historic years back to 2016.
3. Test 2019, 2020, 2021, 2022, 2025 and the current YTD year.
4. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html.
5. Confirm the new annual Year selector appears before preset buttons.
6. Select 2020 to inspect pre crisis baseline.
7. Select 2022 to inspect crisis period.
8. Select 2025 or current YTD to inspect high renewables and negative price period.
9. Confirm Latest 24 hours, Latest 48 hours and Latest 1 week still work.
"""
    write(FILES["report"], body)


def main():
    read_procedural_documents()
    patch_v6_control()
    patch_v6_index_cache_bust()
    patch_article()
    assert_final_state()
    write_report()
    print("V6 electricity annual year selector repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
