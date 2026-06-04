from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "architecture": ROOT / "ARCHITECTURE.md",
    "launch_freeze": ROOT / "LAUNCH_FREEZE.md",
    "workflow_registry": ROOT / "WORKFLOW_REGISTRY.md",
    "operator_manual": ROOT / "OPERATOR_MANUAL_V1.md",
    "article": ROOT / "data" / "grid_studies_public" / "great_britain_electricity_price_grid_constraint_trends_2016_2026.html",
    "helper": ROOT / "data" / "grid_studies_public" / "gb_electricity_year_selector.js",
    "report": ROOT / "data" / "grid_studies_public" / "PUBLIC_GRID_STUDY_PERIOD_SELECTOR_REPAIR_REPORT.md",
}

TOUCHED = []


def read(path):
    if not path.exists():
        raise SystemExit(f"Missing required file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def write(path, text):
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if old != text:
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


def read_procedural_docs():
    checks = {
        "ai_start": "AI proposes.",
        "architecture": "Use Python, YAML and GitHub Actions",
        "launch_freeze": "Freeze structure. Fix function. Document risks. Clean later.",
        "workflow_registry": "No workflow should be removed, renamed or archived",
        "operator_manual": "AI proposes. Python processes. GitHub records. GridBot executes. The maintainer approves.",
    }
    for key, marker in checks.items():
        text = read(FILES[key])
        must_contain(text, marker, key)


def helper_text():
    return """(function(){
  var FIRST_YEAR=2016;
  var YEAR_ROLLOVER_MONTH=0;
  var YEAR_ROLLOVER_DAY=15;
  var PERIODS=[
    {value:'7d',label:'1 week'},
    {value:'30d',label:'1 month'},
    {value:'3m',label:'3 months'},
    {value:'6m',label:'6 months'},
    {value:'12m',label:'12 months Jan to Dec'}
  ];
  function $(id){return document.getElementById(id)}
  function activeDataYear(){var d=new Date();var y=d.getUTCFullYear();if(d.getUTCMonth()===YEAR_ROLLOVER_MONTH&&d.getUTCDate()<YEAR_ROLLOVER_DAY)return y-1;return y}
  function ymd(d){return d.toISOString().slice(0,10)}
  function label(year){return year===activeDataYear()?String(year)+' YTD':String(year)}
  function maxDate(){return window.V6LoadPriceHistoryData&&window.V6LoadPriceHistoryData.maxDate?window.V6LoadPriceHistoryData.maxDate():new Date()}
  function periodDays(period){return window.V6LoadPriceHistoryData&&window.V6LoadPriceHistoryData.periodDays?window.V6LoadPriceHistoryData.periodDays(period):365}
  function periodLabel(period){var found=PERIODS.filter(function(p){return p.value===period})[0];return found?found.label:period}
  function yearStart(year){return new Date(Date.UTC(year,0,1,0,0,0))}
  function yearEnd(year){return year===activeDataYear()?maxDate():new Date(Date.UTC(year,11,31,23,59,59))}
  function selectedYear(){var sel=$('gg2050-electricity-year-select');return sel?Number(sel.value):activeDataYear()}
  function selectedPeriod(){var sel=$('gg2050-electricity-period-select');return sel&&sel.value?sel.value:'12m'}
  function rangeFor(year,period){var start=yearStart(year),end=yearEnd(year);if(period==='12m')return{start:start,end:end};var days=periodDays(period),candidate=new Date(start.getTime()+days*86400000);if(candidate<end)end=candidate;return{start:start,end:end}}
  function addStyles(){if($('gg2050-year-selector-style'))return;var s=document.createElement('style');s.id='gg2050-year-selector-style';s.textContent='.gg2050-year-period-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin:0 0 10px 0}.gg2050-year-select-label{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(0,255,255,.45);border-radius:10px;padding:8px 10px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold}.gg2050-year-select-label select{background:#05070c;color:#fff;border:1px solid rgba(0,255,255,.35);border-radius:8px;padding:8px;font-family:Courier New,Courier,monospace;font-weight:bold;min-width:48%}@media(max-width:700px){.gg2050-year-period-controls{grid-template-columns:1fr}.gg2050-year-select-label{width:100%}.gg2050-year-select-label select{width:55%}}';document.head.appendChild(s)}
  function filterRows(result,start,end){result.rows=(result.rows||[]).filter(function(r){var raw=r.date?r.date+'T12:00:00Z':(r.priceTimeUTC||r.time);var t=new Date(raw);return t>=start&&t<=end});return result}
  function renderSelection(){var year=selectedYear(),period=selectedPeriod(),range=rangeFor(year,period);window.V6LoadPriceHistoryData.loadWindow(range.start,period,'all').then(function(result){result.end=range.end;result.period=period;filterRows(result,range.start,range.end);window.V6RenderPriceChart.render(result);var status=$('price-history-range-status');if(status)status.textContent=ymd(range.start)+' to '+ymd(range.end)+' | '+label(year)+' | '+periodLabel(period)+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' points';}).catch(function(err){var status=$('price-history-range-status');if(status)status.textContent='Year and period chart load failed: '+err;});}
  function buildSelect(id,items,value){var sel=document.createElement('select');sel.id=id;items.forEach(function(item){var o=document.createElement('option');o.value=item.value;o.textContent=item.label;sel.appendChild(o)});sel.value=value;return sel}
  function init(){var grid=$('preset-grid');if(!grid||$('gg2050-electricity-year-select'))return;if(!window.V6LoadPriceHistoryData||!window.V6RenderPriceChart)return;addStyles();var wrap=document.createElement('div');wrap.className='gg2050-year-period-controls';var yearLab=document.createElement('label');yearLab.className='gg2050-year-select-label';yearLab.appendChild(document.createTextNode('Year'));var years=[],active=activeDataYear();for(var y=active;y>=FIRST_YEAR;y--)years.push({value:String(y),label:label(y)});var yearSel=buildSelect('gg2050-electricity-year-select',years,String(active));yearLab.appendChild(yearSel);var periodLab=document.createElement('label');periodLab.className='gg2050-year-select-label';periodLab.appendChild(document.createTextNode('Period'));var periodSel=buildSelect('gg2050-electricity-period-select',PERIODS,'12m');periodLab.appendChild(periodSel);wrap.appendChild(yearLab);wrap.appendChild(periodLab);grid.insertBefore(wrap,grid.firstChild);function userChanged(){grid.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});renderSelection()}yearSel.addEventListener('change',userChanged);periodSel.addEventListener('change',userChanged);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
"""


def patch_helper():
    current = read(FILES["helper"])
    must_contain(current, "function activeDataYear()", "existing helper active year")
    must_contain(current, "function renderYear(year)", "existing helper render year")
    must_not_contain(current, "gg2050-electricity-period-select", "existing helper should not already contain period selector")
    new = helper_text()
    must_contain(new, "gg2050-electricity-period-select", "new helper period selector")
    must_contain(new, "12 months Jan to Dec", "new helper default period label")
    must_contain(new, "periodSel=buildSelect('gg2050-electricity-period-select',PERIODS,'12m')", "new helper default period")
    write(FILES["helper"], new)


def patch_article_cache_bust():
    article = read(FILES["article"])
    must_contain(article, "id=\"preset-grid\"", "public grid study preset grid")
    must_contain(article, "gb_electricity_year_selector.js?v=20260604year2", "public grid study existing helper version")
    updated = replace_once(article, "gb_electricity_year_selector.js?v=20260604year2", "gb_electricity_year_selector.js?v=20260605period1", "helper cache bust")
    must_contain(updated, "gb_electricity_year_selector.js?v=20260605period1", "public grid study new helper version")
    write(FILES["article"], updated)


def write_report():
    report = f"""# Public Grid Study Repair Report: Year and Period Selector

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

This workflow adds a Period selector beside the existing Year selector on the public Great Britain electricity price and grid constraint study chart.

## Intended behaviour

1. Existing preset buttons remain in place.
2. The Year selector remains in place.
3. A new Period selector is added with 1 week, 1 month, 3 months, 6 months and 12 months Jan to Dec.
4. The default period is 12 months Jan to Dec.
5. Selecting a year defaults to that calendar year unless the current active year is year to date.
6. Selecting a shorter period starts from 1 January of the selected year and ends after the chosen period, or at the available current data limit for the active YTD year.
7. The chart continues to use the existing V6 loader and renderer.
8. The existing preset buttons remain available for COVID, gas squeeze, 2021 spike, Ukraine crisis, negative price regime and latest 24 hour, 48 hour and 1 week views.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails checked

- AI_START_HERE.md read.
- ARCHITECTURE.md read.
- LAUNCH_FREEZE.md read.
- WORKFLOW_REGISTRY.md read.
- OPERATOR_MANUAL_V1.md read.
- No workflow was deleted, renamed or archived.
- Existing chart preset buttons were not removed.
- Existing data loader and renderer paths remain unchanged.

## Maintainer test checklist

1. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html.
2. Confirm Year and Period selectors appear above the existing buttons.
3. Confirm Period defaults to 12 months Jan to Dec.
4. Select 2016 and confirm Jan to Dec 2016 loads.
5. Select 2022 and confirm Jan to Dec 2022 loads.
6. Select 2026 YTD and confirm the active year to date range loads.
7. Change Period to 1 month, 3 months and 6 months and confirm the chart updates from 1 January of the selected year.
8. Confirm the existing preset buttons still work.
"""
    write(FILES["report"], report)


def assert_final_state():
    helper = read(FILES["helper"])
    article = read(FILES["article"])
    must_contain(helper, "gg2050-electricity-period-select", "helper final period selector")
    must_contain(helper, "12 months Jan to Dec", "helper final default label")
    must_contain(helper, "window.V6LoadPriceHistoryData.loadWindow", "helper final loader preserved")
    must_contain(article, "gb_electricity_year_selector.js?v=20260605period1", "article final cache bust")
    must_contain(article, "Latest 24 hours", "article buttons preserved")
    must_contain(article, "Latest 48 hours", "article buttons preserved")
    must_contain(article, "Latest 1 week", "article buttons preserved")


def main():
    read_procedural_docs()
    patch_helper()
    patch_article_cache_bust()
    assert_final_state()
    write_report()
    print("Public grid study period selector repair prepared.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
