#!/usr/bin/env python3
"""V9.76 full source-closure and no-truncation acceptance; original REPD palette is immutable."""
import hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OLD=ROOT/"uk_renewables_pipeline/202611231600"
NEW=ROOT/"uk_renewables_pipeline/202611232245"
a={str(p.relative_to(OLD)):p.read_bytes() for p in OLD.rglob("*") if p.is_file()}
b={str(p.relative_to(NEW)):p.read_bytes() for p in NEW.rglob("*") if p.is_file()}
assert len(a)==345,("Unexpected accepted V9.75 source inventory",len(a))
assert set(a).issubset(b),("TRUNCATED files",set(a)-set(b))
assert set(b)-set(a)=={"styles/repd-mobile-v976.css","tests/v976-mobile-browser.mjs"},(
    "Unexpected release additions",set(b)-set(a))
changed={p for p in a if a[p]!=b[p]}
assert changed=={"index.html"},("Nonvisual source changed",changed)
for p in a:
    if p=="index.html":continue
    assert hashlib.sha256(a[p]).digest()==hashlib.sha256(b[p]).digest(),p
for p in ("styles/v7.css","styles/repd-reports.css","styles/repd-density.css",
    "styles/hud-v955.css","styles/compact-register.css","styles/repd-scan.css",
    "scripts/plugins/projects-v9-8.js","scripts/plugins/gauges-v9-2.js",
    "repd-reports.mjs","repd-reports-model.mjs","report-a4.mjs","report-pdf.mjs",
    "map-entry.mjs","repd-expanded.mjs"):
    assert a[p]==b[p],("Original data/logic/SCADA palette not immutable",p)
html=b["index.html"].decode()
assert html.count('styles/repd-mobile-v976.css')==1
assert html.count('styles/repd-reports.css')==1
assert html.index('styles/repd-mobile-v976.css')>html.index('styles/repd-reports.css')
assert html.count('id="repdReportSwipeHint"')==1
assert "Pipeline News V9.76 · 202611232245" in html
assert "Cockpit" not in html and "COCKPIT" not in html
for id in ("repdReportsPanel","repdNativeStatus","repdNativeOperator",
            "repdNativeRegion","status","repdScroll"):
    assert html.count('id="'+id+'"')==1,id
css=b["styles/repd-mobile-v976.css"].decode()
for selector in ("@media (max-width:768px)","#repdPanel #repdReportsBody",
                 "#repdPanel #status.filters","white-space:nowrap!important",
                 "overflow-x:auto!important","width:760px!important"):
    assert selector in css,("Mobile guard missing",selector)
assert not any(name in changed for name in ("map-entry.mjs","report-a4.mjs","report-pdf.mjs"))
print("PASS: V9.76 inherits",len(a),"immutable V9.75 files, 0 missing, 1 HTML link/hint changed, 2 additive CSS/browser test files; no original REPD colour, data, MAP, A4, PDF, or functional JS altered.")
