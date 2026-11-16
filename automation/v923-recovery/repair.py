#!/usr/bin/env python3
"""One-time Python release generator, non-publishing and V9.22 immutable."""
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/"uk_renewables_pipeline"
OLD="202611151300"; NEW="202611160020"
A=P/OLD; B=P/NEW
HERE=Path(__file__).parent
def swap(txt,old,new):
    n=txt.count(old)
    if n!=1:raise RuntimeError(f"Unsafe anchor count {n} for {old[:100]!r}")
    return txt.replace(old,new,1)
def build():
    register=ROOT/"automation/pipeline_release/registry.json"
    reg=json.loads(register.read_text())
    if B.exists():
        if reg["versions"][-1]["id"]!=NEW:raise RuntimeError("Unregistered candidate")
        print("Candidate already exists; no overwrite");return
    if reg["versions"][-1]["id"]!=OLD:raise RuntimeError("V9.22 no longer latest parent")
    subprocess.run([sys.executable,"automation/pipeline_release/new_version.py","create",NEW,"V9.23","one news feed with machine notes","BUILD"],cwd=ROOT,check=True)
    path=B/"index.html"; txt=path.read_text()
    txt=swap(txt,'<link rel="stylesheet" href="styles/v9-22.css?v=9.22">','<link rel="stylesheet" href="styles/v9-22.css?v=9.22">\n  <link rel="stylesheet" href="styles/v9-23.css?v=9.23">')
    txt=swap(txt,'<th>NEWS SIGNAL</th>\n            <th>ACTIONS</th>','<th>NEWS SIGNAL</th>\n            <th>MACHINE READ NOTES</th>\n            <th>ACTIONS</th>')
    txt=swap(txt,'<details class="news-archive" id="newsArchive">','<details class="news-archive" id="newsArchive" hidden>')
    txt=swap(txt,'  <script defer src="scripts/plugins/datacentre-news.js?v=1"></script>\n','')
    txt=swap(txt,'  <script defer src="scripts/plugins/live-news.js?v=2"></script>',
                 '  <script defer src="scripts/plugins/live-news.js?v=2"></script>\n  <script defer src="scripts/plugins/machine-notes-v923.js?v=9.23"></script>')
    path.write_text(txt)
    path=B/"scripts/plugins/live-news.js";txt=path.read_text()
    txt,n=re.subn(r'\n  function showProject\(ref, chip\) \{.*?\n  \}\n\n','\n',txt,count=1,flags=re.S)
    if n!=1:raise RuntimeError("show table function absent")
    start=txt.index("      var chip = el('button', 'ln-match'")
    end=txt.index("      box.appendChild(chip);",start)+len("      box.appendChild(chip);")
    txt=txt[:start]+"""      var chip = el('span', 'ln-match', 'Possible match: ' + m.site_name + ' (REPD ' + m.repd_ref + ')');
      chip.title = 'Unverified headline match, not a proven project event';
      box.appendChild(chip);"""+txt[end:]
    txt=swap(txt,"    var archive = document.getElementById('newsArchive');",
                "    var archive = document.getElementById('newsArchive');\n    window.pipelineHeadlineDocument = ok ? doc : null;\n    window.dispatchEvent(new CustomEvent('pipeline-feed-loaded', { detail: ok ? doc : null }));")
    txt=swap(txt,'    var items = doc.items.map(function (it, i) { return [it, i]; })',
        """    var items = doc.items.filter(function (it) {
      return it.category !== 'policy' && !/\\b(politics|political|election campaign)\\b/i.test(String(it.title || ''));
    }).map(function (it, i) { return [it, i]; })""")
    path.write_text(txt)
    path=B/"scripts/plugins/projects-v9-8.js";txt=path.read_text()
    target='</td><td><div class="project-actions">'+chr(36)+'{mapAction}'
    if txt.count(target)!=2:raise RuntimeError("REPD/interconnector row anchors moved")
    txt=txt.replace(target,'</td><td class="machine-note-cell">NOT A REPD RECORD</td><td><div class="project-actions">'+chr(36)+'{mapAction}',1)
    cell='</td><td class="machine-note-cell"><button type="button" class="machine-note-button" data-note-ref="'+chr(36)+'{escapeHtml(project.repd_ref)}" data-note-name="'+chr(36)+'{escapeHtml(project.name)}" data-note-status="'+chr(36)+'{escapeHtml(project.status)}">CHECK NOTE</button></td><td><div class="project-actions">'+chr(36)+'{mapAction}'
    txt=txt.replace(target,cell,1).replace('colspan="11"','colspan="12"')
    path.write_text(txt)
    (B/"scripts/plugins/machine-notes-v923.js").write_text((HERE/"templates/machine-notes.js").read_text())
    (B/"styles/v9-23.css").write_text((HERE/"templates/v9-23.css").read_text())
    (B/"docs/V923-AUDIT.md").write_text("V9.23 NONLIVE. Candidate notes are name-matched metadata, not verified events. Source REPD unmodified. Politics panel removed, old show-table shortcut removed; old MAP builder inherited. GridAtlas 390px card failure remains RED. No homepage promotion.\n")
    subprocess.run([sys.executable,"automation/pipeline_release/new_version.py","finalize",NEW,
        "one feed, Machine Read Notes, no show-table jump","--fault","Known GridAtlas 390px nearest-card failure unresolved",
        "--feature","machine-notes-column:index.html:MACHINE READ NOTES"],cwd=ROOT,check=True)
    reg=json.loads(register.read_text());reg["versions"][-1]["state"]="nonlive_candidate"
    register.write_text(json.dumps(reg,indent=2,ensure_ascii=False)+"\n")
    print("CREATED NONLIVE V9.23 CANDIDATE")
def check():
    if not B.exists():raise RuntimeError("Candidate not generated")
    html=(B/"index.html").read_text(); live=(B/"scripts/plugins/live-news.js").read_text()
    pj=(B/"scripts/plugins/projects-v9-8.js").read_text()
    assert "MACHINE READ NOTES" in html and "data-note-ref" in pj
    assert "datacentre-news.js?v=1" not in html and 'id="newsArchive" hidden' in html
    assert "function showProject(" not in live
    assert "pipeline-feed-loaded" in live
    for n in ["scripts/core/atlas-receiver-v9-7.js","scripts/data/canonical-projects-v9-5-1.js"]:
        assert (A/n).read_bytes()==(B/n).read_bytes()
    print("PASS: V9.23 structural and canonical REPD/MAP source parity")
if __name__=="__main__":{"build":build,"check":check}[sys.argv[1]]()
