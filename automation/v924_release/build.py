#!/usr/bin/env python3
"""Build V9.24 as a versioned copy of V9.23. Never mutate published ancestors."""
from pathlib import Path
import json,hashlib,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).resolve().parent
OLD="202611160020"; NEW="202611161250"; P=ROOT/"uk_renewables_pipeline"; D=P/NEW
def cmd(*a):
 print("+",*a,flush=True);subprocess.run(list(map(str,a)),cwd=ROOT,check=True)
def source():
 rows=[]; digests={}
 for n in range(1,17):
  path=P/OLD/"data/v9.1/projects"/f"part-{n:03}.json"
  b=path.read_bytes();digests[path.name]=hashlib.sha256(b).hexdigest()
  part=json.loads(b);assert part["partition"]==n
  rows+=part["projects"]
 assert len(rows)==7775
 solar=sorted((r for r in rows if r["repd_technology"]=="Solar Photovoltaics"),key=lambda r:int(r["repd_ref"]))
 assert len(solar)==3604
 ids=[r["repd_ref"] for r in solar[:1000]]
 pinned=json.loads((HERE/"pinned_solar1000.json").read_text())
 assert ids==pinned["ids"] and len(set(ids))==1000 and ids[0]=="1018" and ids[-1]=="2325"
 return pinned,digests
def replace(path,a,b):
 f=D/path;s=f.read_text()
 assert s.count(a)==1,(path,a,s.count(a))
 f.write_text(s.replace(a,b,1))
def main():
 assert not D.exists(),"Cannot overwrite existing V9.24"
 pin,hashes=source()
 c=[json.loads(x) for x in (HERE/"source_candidates.jsonl").read_text().splitlines() if x.strip()]
 assert {r["repd_ref"] for r in c}=={"1019","1020"} and all(r["rights_basis"]=="unknown" for r in c)
 cmd(sys.executable,"automation/pipeline_release/new_version.py","create",NEW,"V9.24","solar-1000 provenance pilot","BUILD")
 replace("index.html",'<link rel="stylesheet" href="styles/v9-23.css?v=9.23">',
 '<link rel="stylesheet" href="styles/v9-23.css?v=9.23">\n  <link rel="stylesheet" href="styles/v9-24.css?v=9.24">')
 replace("index.html",'<h2 class="section-title">REPD PIPELINE ANALYTICS</h2>',
 '<section class="solar1000-banner" id="solar1000Banner"><h2>V9.24 · SOLAR-1000 PILOT</h2>'
 '<p>1,000 numerically selected solar REPD references, 1018–2325. Two provisional source leads; '
 '998 projects not yet researched; zero independently verified. The official 7,775-record REPD register is unchanged.</p>'
 '<p id="solar1000PilotStatus" role="status">Loading pinned pilot…</p>'
 '<button type="button" id="solar1000PilotSample">FIND REPD 1019 PILOT EXAMPLE</button> '
 '<a href="news/solar1000-v924.json" target="_blank" rel="noopener">Pilot evidence manifest</a>'
 '</section><h2 class="section-title">REPD PIPELINE ANALYTICS</h2>')
 replace("index.html",'<script defer src="scripts/plugins/machine-notes-v923.js?v=9.23"></script>',
 '<script defer src="scripts/plugins/machine-notes-v923.js?v=9.23"></script>\n'
 '  <script defer src="scripts/plugins/solar1000-v924.js?v=9.24"></script>')
 shutil.copyfile(HERE/"pilot.js",D/"scripts/plugins/solar1000-v924.js")
 shutil.copyfile(HERE/"pilot.css",D/"styles/v9-24.css")
 data={"schema":"globalgrid2050.solar1000.pilot.v1","release":NEW,"parent":OLD,
 "source_commit":pin["source_commit"],"source_combined_digest":pin["source_combined_digest"],
 "selection":"numeric-repd-ref-ascending","ids":pin["ids"],"original_part_sha256":hashes,
 "counts":{"register":7775,"solar":3604,"selected":1000,"search_candidates":2,"independently_verified":0,"not_researched":998},
 "candidates":[{"repd_ref":x["repd_ref"],"site_name":x["site_name"],"publisher":x["publisher"],
 "source_url":x["source_url"],"source_locator":x["source_locator"],
 "remarks":x["remarks"],"event_date":x["event_date"],"rights_basis":"unknown",
 "verified":False,"status":"provisional_only"} for x in c]}
 (D/"news/solar1000-v924.json").write_text(json.dumps(data,indent=2)+"\n")
 (D/"docs/V924-SOLAR1000-RELEASE.md").write_text(
 "# V9.24 Solar-1000 provenance pilot\n\n"
 "From immutable V9.23 16-part Q3 REPD register, numerically first 1,000 solar IDs 1018–2325. "
 "Pilot 2 provisional external source links, 998 not researched, ZERO independently verified. "
 "No paid search API calls. Candidate URLs are not verified publisher bytes and rights are unknown. "
 "Original 7,775 REPD statuses, MAP, CSV and predecessors are unchanged.\n\n"
 "Upstream TestCode https://github.com/Ventusltd/testcode/pull/16 "
 "at f8ab48e8a2a66f4f2118a8ec544daa22539858fe. "
 "Known GridAtlas 390px result-card minimisation remains unresolved. "
 "Fallback https://globalgrid2050.com/uk_renewables_pipeline/202611160020/ .\n")
 (D/"CHANGES.md").write_text(
 f"# {NEW} (V9.24)\n\nParent: {OLD} (V9.23), immutable tree 32893c1e49a884c56dd7495be205367bbd8177ae.\n\n"
 "Adds numerically selected Solar-1000 native notes, 2 source candidates only (0 verified), "
 "998 explicitly NOT RESEARCHED. Original REPD register, MAP deep links and CSV unchanged. "
 "Known issue: mobile GridAtlas nearest-result may re-minimise at 390px. "
 "Original publisher bytes and reuse rights not established. No paid search collector configured.\n")
 cmd(sys.executable,"automation/pipeline_release/new_version.py","finalize",NEW,
 "1,000 pinned Solar-1000 refs; 2 provisional leads, 998 not researched, 0 verified",
 "--fault","GridAtlas nearest-result mobile sheet can re-minimise at 390px",
 "--fault","Original publisher rights/bytes and independent identity not verified",
 "--feature","v924-pilot:news/solar1000-v924.json:globalgrid2050.solar1000.pilot.v1",
 "--feature","v924-notes:scripts/plugins/solar1000-v924.js:solar1000Pilot",
 "--feature","v924-ui:index.html:solar1000Banner")
 r=ROOT/"automation/pipeline_release/registry.json";obj=json.loads(r.read_text())
 assert obj["versions"][-1]["id"]==NEW
 obj["versions"][-1]["state"]="candidate_owner_directed_known_limits"
 obj["versions"][-1]["pilot_evidence"]=data["counts"]
 obj["release_candidate"]={"id":NEW,"version":"V9.24","state":"OWNER DIRECTED CANDIDATE; ZERO VERIFIED SOURCE NEWS",
 "operative":{"id":OLD,"version":"V9.23"}}
 r.write_text(json.dumps(obj,indent=2)+"\n")
 cmd(sys.executable,"automation/v924_release/verify.py")
 cmd(sys.executable,"automation/pipeline_release/verify.py","--browser","--write")
 print("V9.24 Python candidate built and verified",NEW,flush=True)
if __name__=="__main__":main()
