#!/usr/bin/env python3
"""Read-only Python source-closure and nontruncation gate for V9.75."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[3]
old=ROOT/"uk_renewables_pipeline/202611231400"
new=ROOT/"uk_renewables_pipeline/202611231600"
a={str(p.relative_to(old)):p.read_bytes() for p in old.rglob("*") if p.is_file()}
b={str(p.relative_to(new)):p.read_bytes() for p in new.rglob("*") if p.is_file()}
assert len(a)>300, ("Suspicious historical source size",len(a))
assert set(a).issubset(b), ("TRUNCATION",sorted(set(a)-set(b)))
assert set(b)-set(a)=={"tests/v975-native-browser.mjs"}, ("Unexpected additions",set(b)-set(a))
changes={name for name in a if a[name]!=b[name]}
expected={"index.html","repd-reports.mjs","repd-reports-model.mjs","repd-scan.mjs",
          "scripts/plugins/projects-v9-8.js","README.md","CHANGES.md"}
assert changes==expected, ("Unexpected changed source",changes^expected)
for name in a:
    if name.startswith(("data/","styles/","news/")) or name in (
            "map-entry.mjs","report-a4.mjs","report-pdf.mjs","repd-expanded.mjs",
            "scripts/data/canonical-projects-v9-5-1.js","scripts/plugins/gauges-v9-2.js"):
        assert a[name]==b[name], "Protected source changed: "+name
html=b["index.html"].decode()
report=b["repd-reports.mjs"].decode()
project=b["scripts/plugins/projects-v9-8.js"].decode()
assert len(html)>20000 and len(project)>25000 and len(report)>5000, "Truncated functional source"
for id in ["repdNativeStatus","repdNativeOperator","repdNativeRegion","repdReportsPanel",
           "g1","g2","g3","repdScroll","pnScanStatus"]:
    assert ('id="'+id+'"') in html, "Missing native control "+id
assert html.count('id="status"')==1
assert not any(x in html for x in ("COCKPIT","Cockpit","repdReportScope"))
assert "makeFacet(" not in report and "reportScope" not in report
assert "state.filtered" in report and "updateGaugesV9_2(filtered)" in project
assert "canonicalOperator(project.operator)" in project
assert "repdNativeStatus" in project and "repdNativeOperator" in project
for name in ["report-a4.mjs","report-pdf.mjs","map-entry.mjs"]:
    assert hashlib.sha256(a[name]).digest()==hashlib.sha256(b[name]).digest()
print("PASS V9.75 Python source closure",len(a),"preserved,",
      len(changes),"reviewed changes, 1 browser test, 0 removed, 0 CSS/data/MAP/A4/PDF changes")
