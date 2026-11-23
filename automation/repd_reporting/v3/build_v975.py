#!/usr/bin/env python3
"""Build PipelineNews V9.75 from V9.74 without touching historical release/data/colours.

Pure stdlib deterministic, fail-closed Python patcher. Repeated CI build is idempotent.
The matching full Git tree is staged by the GitHub Git Tree API, not a partial copy.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[3]
OLD=ROOT/"uk_renewables_pipeline/202611231400"
NEW=ROOT/"uk_renewables_pipeline/202611231600"

def replace(text, before, after, label, expected=1):
    count=text.count(before)
    if count != expected:
        raise AssertionError(f"{label}: expected {expected} anchors, found {count}")
    return text.replace(before, after, 1)

def between(text, beginning, ending, replacement, label):
    assert text.count(beginning)==1, f"{label}: beginning"
    i=text.index(beginning); j=text.find(ending,i+len(beginning))
    assert j>=0, f"{label}: ending"
    return text[:i]+replacement+text[j:]

def patch(path, f):
    target=NEW/path
    old=target.read_text()
    new=f(old)
    assert len(new)>200 and new!=old, f"{path}: no change or truncation"
    target.write_text(new)
    print("PATCH",path,len(old),"->",len(new))

def html_patch(s):
    s=replace(s,"Pipeline News V9.74 · 202611231400","Pipeline News V9.75 · 202611231600","version")
    status='''<div class="filters" id="status">
<button class="btn active" data-official-status="All" aria-pressed="true">ALL STATUS</button>
<button class="btn" data-official-status="Operational" aria-pressed="false">OPERATIONAL</button>
<button class="btn" data-official-status="Under Construction" aria-pressed="false">CONSTRUCTING</button>
<button class="btn" data-official-status="Awaiting Construction" aria-pressed="false">AWAITING</button>
<button class="btn" data-official-status="Application Submitted" aria-pressed="false">SUBMITTED</button>
</div>'''
    s=replace(s,status,"","move native status above reports")
    filters='''<div class="filters" id="repdNativeFilters" aria-label="REPD source table filters">
<label for="repdNativeStatus">STATUS <select id="repdNativeStatus" aria-label="Filter official REPD status"><option value="All">ALL OFFICIAL STATUSES</option></select></label>
<label for="repdNativeOperator">OPERATOR <select id="repdNativeOperator" aria-label="Filter original REPD table by operator"><option value="All">ALL OPERATORS</option></select></label>
<label for="repdNativeRegion">REGION <select id="repdNativeRegion" aria-label="Filter original REPD table by region"><option value="All">ALL REGIONS</option></select></label>
</div>
'''+status+"\n"
    s=replace(s,'<div class="repd-report-launch" role="group" aria-label="REPD capacity reports">',filters+'<div class="repd-report-launch" role="group" aria-label="REPD capacity reports">',"native filters at top")
    s=replace(s,'''<label for="repdReportScope">REPORT DATA <select id="repdReportScope" aria-label="Report project scope">
<option value="all">ALL OFFICIAL REPD STATUSES</option>
<option value="filtered">CURRENT TABLE FILTERS</option>
</select></label>''','<span class="repd-report-context">CURRENT REPD TABLE FILTERS</span>',"remove report-specific scope")
    s=replace(s,"Operator entities are not inferred.","Conservative operator spelling variants are grouped for reporting only; source labels remain unchanged.","alias integrity")
    s=replace(s,'<label class="pn-scan-status" for="pnScanStatus">Status','<label class="pn-scan-status" for="pnScanStatus" hidden style="display:none" aria-hidden="true">Status',"hide duplicate status selector")
    assert "Cockpit" not in s and "COCKPIT" not in s
    return s

def project_patch(s):
    s=replace(s,'import { state } from "../core/state.js";','import { state } from "../core/state.js";\nimport { canonicalOperator } from "../../../automation/repd_reporting/v3/operator-aliases.mjs";',"import explicit operator aliases")
    s=replace(s,'let county = "All";\nlet query = "";','let county = "All";\nlet operatorFilter = "All", regionFilter = "All";\nlet query = "";',"source filters")
    s=replace(s,'["technology", "status", "county", "q", "sort",','["technology", "status", "county", "operator", "region", "q", "sort",',"url clear")
    s=replace(s,'if (county !== "All") url.searchParams.set("county", county);','if (county !== "All") url.searchParams.set("county", county);\nif (operatorFilter !== "All") url.searchParams.set("operator", operatorFilter);\nif (regionFilter !== "All") url.searchParams.set("region", regionFilter);',"url set")
    s=replace(s,'county,\ntokens,\n}, searchIndex.get(project.repd_ref)) && matchesYear','county,\ntokens,\n}, searchIndex.get(project.repd_ref)) && (status !== "Not reported" || !String(project.status || "").trim()) && (operatorFilter === "All" || canonicalOperator(project.operator) === operatorFilter) && (regionFilter === "All" || (String(project.region || "").trim() || "Not reported") === regionFilter) && matchesYear',"single native filter, table plus gauges")
    s=replace(s,'technology,\nstatus,\ncounty,\ntokens,\n}, searchIndex.get(project.repd_ref))','technology,\nstatus: status === "Not reported" ? "All" : status,\ncounty,\ntokens,\n}, searchIndex.get(project.repd_ref))',"include official missing statuses")
    funcs='''function populateNativeFilters() {
  const inventory = [...all, ...interconnectors];
  const labels = key => [...new Set(inventory.map(row=>String(row[key]||"").trim()||"Not reported"))]
    .sort((a,b)=>a.localeCompare(b,"en-GB"));
  const statuses=labels("status");
  for(const value of statuses) ALLOWED_STATUSES.add(value);
  for(const [id, values, title] of [
    ["repdNativeStatus", statuses, "ALL OFFICIAL STATUSES"],
    ["repdNativeOperator", [...new Set(inventory.map(row=>canonicalOperator(row.operator)))].sort((a,b)=>a.localeCompare(b,"en-GB")), "ALL OPERATORS"],
    ["repdNativeRegion", labels("region"), "ALL REGIONS"]
  ]) {
    const select=document.getElementById(id);
    select.replaceChildren(new Option(title,"All"),...values.filter(v=>v!=="All").map(v=>new Option(v,v)));
  }
  const scan=document.getElementById("pnScanStatus");
  if(scan) for(const value of statuses) {
    if(![...scan.options].some(o=>o.value===value)) scan.add(new Option(value,value));
  }
}
function syncNativeFilters() {
  for(const [id,value] of [["repdNativeStatus",status],["repdNativeOperator",operatorFilter],["repdNativeRegion",regionFilter],["pnScanStatus",status]]) {
    const select=document.getElementById(id);
    if(select && [...select.options].some(o=>o.value===value)) select.value=value;
  }
}
'''
    s=replace(s,"function populateCounties() {",funcs+"function populateCounties() {","populate native selector")
    s=replace(s,'const requestedCounty = parameters.get("county") || "All";','const requestedCounty = parameters.get("county") || "All";\nconst requestedOperator = parameters.get("operator") || "All";\nconst requestedRegion = parameters.get("region") || "All";',"URL hydrate selectors")
    s=replace(s,'query = parameters.get("q") || "";','operatorFilter = [...document.getElementById("repdNativeOperator").options].some(o=>o.value===requestedOperator) ? requestedOperator : "All";\nregionFilter = [...document.getElementById("repdNativeRegion").options].some(o=>o.value===requestedRegion) ? requestedRegion : "All";\nquery = parameters.get("q") || "";',"URL hydrate names")
    start=s.index("function hydrateFiltersFromUrl()")
    end=s.index("function csvCell(",start)
    head=s[start:end]
    head=replace(head,'setButtonState("#status", "officialStatus", status);\ndocument.getElementById("county").value = county;','setButtonState("#status", "officialStatus", status);\nsyncNativeFilters();\ndocument.getElementById("county").value = county;',"hydrate sync")
    s=s[:start]+head+s[end:]
    s=replace(s,'county = "All";\nsubmittedYear = updatedYear = operationalYear = "All";','county = "All";\noperatorFilter = "All"; regionFilter = "All";\nsubmittedYear = updatedYear = operationalYear = "All";',"clear native filters")
    start=s.index("function clearFilters(");end=s.index("async function copyProjectId(",start)
    head=s[start:end]
    head=replace(head,'setButtonState("#status", "officialStatus", status);\ndocument.getElementById("county").value = county;','setButtonState("#status", "officialStatus", status);\nsyncNativeFilters();\ndocument.getElementById("county").value = county;',"clear sync")
    s=s[:start]+head+s[end:]
    s=replace(s,"populateCounties();\npopulateDateYears();","populateCounties();\npopulateNativeFilters();\npopulateDateYears();","initial selection inventory")
    s=replace(s,'status = button.dataset.officialStatus;\nsetButtonState("#status", "officialStatus", status);\napply();','status = button.dataset.officialStatus;\nsetButtonState("#status", "officialStatus", status);\nsyncNativeFilters();\napply();',"native buttons")
    s=replace(s,'document.getElementById("county").onchange = (event) => { county = event.target.value; apply(); };','''document.getElementById("repdNativeStatus").onchange = event => { status=event.target.value;setButtonState("#status","officialStatus",status);syncNativeFilters();apply(); };
document.getElementById("repdNativeOperator").onchange = event => { operatorFilter=event.target.value;apply(); };
document.getElementById("repdNativeRegion").onchange = event => { regionFilter=event.target.value;apply(); };
document.getElementById("county").onchange = (event) => { county = event.target.value; apply(); };''',"bind original REPD source handler")
    return s

def scan_patch(s):
    s=replace(s,"if(selected)selected.click();",'''if(selected)selected.click();
    else { const native=document.getElementById("repdNativeStatus"); if(native) {native.value=statusSelect.value;native.dispatchEvent(new Event("change",{bubbles:true}));} }''',"mobile scan to native status")
    s=replace(s,'if(active&&statusSelect.value!==active.dataset.officialStatus)statusSelect.value=active.dataset.officialStatus;','''const native=document.getElementById("repdNativeStatus");
    const current=native?.value || active?.dataset.officialStatus || "All";
    if(statusSelect.value!==current)statusSelect.value=current;''',"mobile scan sync")
    return s

def model_patch(s):
    s=replace(s,'export const REPORT_DIMENSIONS =','import { canonicalOperator } from "../../automation/repd_reporting/v3/operator-aliases.mjs";\nexport const REPORT_DIMENSIONS =',"report alias model")
    return replace(s,'const name = label(project[dimension]);','const name = dimension === "operator" ? canonicalOperator(project.operator) : label(project[dimension]);',"report-only canonical grouping")

def report_patch(s):
    s=replace(s,'// PipelineNews V9.74 candidate: same REPD cockpit with source-faithful cross-filters; original visual styles untouched.','// PipelineNews V9.75: reports use the existing filtered REPD table and gauges.',"report banner")
    s=replace(s,'import { buildCockpitReport, SOURCE_UNAVAILABLE } from "../../automation/repd_reporting/v2/cockpit-facets.mjs";\n',"","remove parallel report filter")
    s=replace(s,'const reportScope = document.getElementById("repdReportScope");\n',"","remove report scope DOM")
    s=between(s,'// All facets live inside the existing REPD report tablet, never a second dashboard.','function buildInterconnectorCapacityReport','''function nativeTechnology() {
  return document.querySelector('#tech [data-technology][aria-pressed="true"]')?.dataset.technology||"all";
}
function chosenFilter() {
  return {technology:nativeTechnology(),
    status:document.getElementById("repdNativeStatus")?.value||"All",
    operator:document.getElementById("repdNativeOperator")?.value||"All",
    region:document.getElementById("repdNativeRegion")?.value||"All"};
}
''',"native read only")
    summary='''function sourceRows() {
  if(!Array.isArray(state.all)||!state.all.length)return null;
  lastSelection=chosenFilter();
  const ic=lastSelection.technology==="interconnector";
  const rows=state.filtered||[];
  lastSnapshot={source:ic?"interconnector":"repd",
    sourceProjects:ic?(state.interconnectors||[]).length:state.all.length,
    matchingProjects:rows.length};
  return rows;
}
function renderNativeSummary(report) {
  const wrap=el("div","tablewrap"), table=el("table","repd-native-report-table");
  wrap.setAttribute("aria-label","Ranked grouping of the original REPD table filters");
  const head=el("thead"),heading=el("tr");
  for(const name of ["Group","Projects","Solar MWp","Other MW","Recorded MW/MWp"])
    heading.append(el("th","",name));
  head.append(heading);
  const body=el("tbody");
  for(const group of report.groups) {
    const row=el("tr"),name=el("td","site"),action=el("button","btn",group.name);
    action.type="button";
    action.title="Apply this exact group to the original REPD table and gauges";
    action.addEventListener("click",()=>{
      const id=active==="operator"?"repdNativeOperator":active==="status"?"repdNativeStatus":"repdNativeRegion";
      const select=document.getElementById(id);
      if(!select||![...select.options].some(o=>o.value===group.name)) {
        reportSummary.textContent="No matching source filter for "+group.name;return;
      }
      select.value=group.name;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      document.getElementById("repdScroll")?.scrollIntoView({block:"nearest"});
    });
    name.append(action);row.append(name);
    for(const [value,css] of [[group.count,""],[group.solarMwp,"mw"],[group.otherMw,"mw"],[group.recordedCapacity,"mw"]])
      row.append(el("td",css,css?formatCapacity(value):formatCount(value)));
    body.append(row);
  }
  table.append(head,body);wrap.append(table);reportBody.append(wrap);
}
'''
    s=between(s,"function sourceRows() {","function render() {",summary,"source authority")
    renderer='''function render() {
  if(!active||panel.hidden)return;
  reportBody.replaceChildren();
  try {
    const rows=sourceRows();
    if(!rows){lastReport=null;reportSummary.textContent="Loading original REPD register…";return;}
    const ic=lastSnapshot.source==="interconnector";
    const report=ic?buildInterconnectorCapacityReport(rows,active):buildRepdCapacityReport(rows,active);
    lastReport=report;
    const selection=lastSelection;
    const tech=selection.technology==="all"?"ALL REPD TECHNOLOGIES":selection.technology.replaceAll("_"," ").toUpperCase();
    reportSummary.textContent=titles[active]+" · "+tech+" · "+selection.status+
      " · CURRENT REPD TABLE FILTERS · SOURCE "+formatCount(lastSnapshot.sourceProjects)+
      " · SELECTED "+formatCount(rows.length)+" · "+formatCount(report.groups.length)+
      " groups · "+capacityDescription(report.total)+
      (ic?" · Separate interconnector inventory, not REPD":" · Select a group to filter the original table and gauges");
    if(ic) {
      const heading=el("div","repd-report-row repd-report-columns");
      for(const name of ["Group","Recorded MW","Solar MWp","Other MW","Projects"])heading.append(el("span","",name));
      heading.append(el("span","",""));
      reportBody.append(heading);
      const maximum=report.groups.length?report.groups[0].recordedCapacity:0;
      for(const [index,group] of report.groups.entries())reportBody.append(makeGroup(group,maximum,index));
    } else renderNativeSummary(report);
    if(!report.groups.length)reportBody.append(el("p","","No matching projects in the original REPD table."));
  } catch(error){
    lastReport=null;lastSnapshot=null;
    reportSummary.textContent="Report validation failed: "+String(error?.message||error);
  }
}
'''
    s=between(s,"function render() {","function selectReport(dimension) {",renderer,"native report table")
    s=replace(s,"if (panel && reportScope && reportSummary && reportBody) {","if (panel && reportSummary && reportBody) {","panel guard")
    s=replace(s,'  reportScope.addEventListener("change", render);\n',"","no second selector")
    assert not any(word in s for word in ["makeFacet(","reportScope","buildCockpitReport","COCKPIT"])
    return s

def main():
    assert OLD.is_dir() and NEW.is_dir()
    original={str(p.relative_to(OLD)):p.read_bytes() for p in OLD.rglob("*") if p.is_file()}
    staged={str(p.relative_to(NEW)):p.read_bytes() for p in NEW.rglob("*") if p.is_file()}
    if (NEW/"README.md").read_text().startswith("# PipelineNews V9.75"):
        assert set(original).issubset(set(staged)) and set(staged)-set(original)=={"tests/v975-native-browser.mjs"}, "Already-built successor lost source files or gained unapproved files"
        assert all(original[p]==staged[p] for p in original if p.startswith(("styles/","data/")) or p in ("map-entry.mjs","report-a4.mjs","report-pdf.mjs","repd-expanded.mjs")), "Immutable source/colour/Atlas changed"
        assert "repdNativeOperator" in (NEW/"index.html").read_text()
        print("V9.75 existing successor: source, CSS, MAP/A4/PDF closure PASS")
        return
    assert len(original)>300 and original==staged, "Unsafe or incomplete cloned V9.75 tree"
    for path,fn in [
        ("index.html",html_patch),("scripts/plugins/projects-v9-8.js",project_patch),
        ("repd-scan.mjs",scan_patch),("repd-reports-model.mjs",model_patch),
        ("repd-reports.mjs",report_patch)]:
        patch(path,fn)
    (NEW/"tests/v975-native-browser.mjs").write_text((ROOT/"automation/repd_reporting/v3/browser_v975.mjs").read_text())
    (NEW/"README.md").write_text("""# PipelineNews V9.75 — REPD native filters and ranked reports
Single source filtered REPD register drives gauges, project table, CSV and reports.
Native status buttons near gauges; all official statuses, operator, region exposed above.
Exact alias grouping only: Low Carbon / Low Carbon Ltd / Low Carbon Limited.
Never infer ownership or change REPD refs, operator source, MWp/MW or historical data.
Original CSS/SCADA palette, MAP/A4/PDF/VICINITY, ticker and snapshots unchanged.
Full Python/Playwright/served-SHA verification required before live promotion.
""")
    (NEW/"CHANGES.md").write_text("""# V9.75
- Removed report-specific duplicate filters and user-facing prior naming.
- Retained and moved source-native status buttons above existing grouped reports.
- Operator and region selectors now filter original REPD table, gauges, CSV and reports.
- Report ranking uses the original HTML table style, group click filters source table.
- Explicit report-only alias list, no project/data/colour/old release changes.
""")
    print("V9.75 patch composed safely; original",len(original),"files retained")

if __name__=="__main__":
    main()
