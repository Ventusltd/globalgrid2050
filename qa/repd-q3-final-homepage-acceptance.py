#!/usr/bin/env python3
"""Fail-closed post-promotion proof: exact homepage-owner bytes and Q3 launch."""
import hashlib,json,os,time,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="https://globalgrid2050.com"
OUT=Path("/tmp/repd-q3-final-homepage")
OUT.mkdir(parents=True,exist_ok=True)
pin=json.loads((ROOT/"catalogue/homepage-owner.json").read_text())
assert pin["repository"]=="Ventusltd/globalgrid2050-homepage"
assert pin["commit"]=="cdd5e1f295043ea6e69077854204d7e34071a64a"
assert pin["files"]["index.html"]=="e3b011cf925aef246bf2c20d82861d82633718ad481696fb568bb74e99190203"
assert pin["files"]["data/homepage.json"]=="d81d9a9cc1e3ba4d3b8b894ed0b99778bdc482f4a8c03b348ff44ac74c701914"

def sha(data):return hashlib.sha256(data).hexdigest()
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"GlobalGrid2050-final-release-qa/1","Cache-Control":"no-cache"})
 with urllib.request.urlopen(req,timeout=45) as r:return r.status,r.read(),r.geturl()
owner_url=f"https://raw.githubusercontent.com/{pin['repository']}/{pin['commit']}"
_,source,_=get(owner_url+"/index.html")
assert sha(source)==pin["files"]["index.html"]
idx=source.decode("utf-8-sig")
for name in ("versioned-homepage.css","versioned-homepage.js"):
 a=f"./assets/{name}"
 assert idx.count(a)==1
 idx=idx.replace(a,f"./homepage-shell/assets/{name}")
a='href="data/homepage.json"'
assert idx.count(a)==1
idx=idx.replace(a,'href="./homepage-shell/data/homepage.json"')
expected_index=(idx.rstrip()+"\n").encode("utf-8")
_,owner_data,_=get(owner_url+"/data/homepage.json")
assert sha(owner_data)==pin["files"]["data/homepage.json"]
catalogue=json.loads(owner_data)
entity=next(e for e in catalogue["entities"] if e["id"]=="pipeline-news")
assert entity["operative_release_id"]=="202611132345"
assert {r["id"] for r in entity["releases"]} >= {"202611132345","202609082224"}
assert catalogue["promotions"][-1]["to_release_id"]=="202611132345"
assert b'uk_renewables_pipeline/202611132345/' in expected_index
assert b'uk_renewables_pipeline/202609082224/' in owner_data
checks=[]
start=time.monotonic()
for attempt in range(1,41):
 try:
  status,live_index,url=get(BASE+"/index.html")
  status2,live_catalogue,url2=get(BASE+"/homepage-shell/data/homepage.json")
  ok=(status==status2==200 and sha(live_index)==sha(expected_index)
      and sha(live_catalogue)==sha(owner_data))
  if ok:
   checks.extend([
    {"path":"/index.html","status":status,"bytes":len(live_index),"sha256":sha(live_index),"expected_sha256":sha(expected_index),"pass":True},
    {"path":"/homepage-shell/data/homepage.json","status":status2,"bytes":len(live_catalogue),"sha256":sha(live_catalogue),"expected_sha256":sha(owner_data),"pass":True}
   ])
   print(f"New homepage owner bytes live after attempt {attempt}",flush=True)
   break
  print(f"Waiting for owner pointer: attempt {attempt}, index={sha(live_index)}, catalogue={sha(live_catalogue)}",flush=True)
 except Exception as e:
  print(f"Waiting for Pages: {type(e).__name__} {e}",flush=True)
 if attempt==40:raise SystemExit("FAIL: new pinned owner homepage never served")
 time.sleep(15)
# Preserve old edition and Q3 edition as directly reachable, exact Git bytes.
for path in ("uk_renewables_pipeline/202609082224/index.html",
             "uk_renewables_pipeline/202611132345/index.html"):
 local=ROOT/path
 assert local.is_file(),f"Missing local source: {path}"
 status,body,url=get(BASE+"/"+path)
 expected=sha(local.read_bytes())
 assert status==200 and sha(body)==expected,f"FAIL: {path} mismatch"
 checks.append({"path":"/"+path,"status":status,"bytes":len(body),"sha256":sha(body),"expected_sha256":expected,"pass":True})
report={"status":"PASS","new_operative":"202611132345","previous":"202609082224",
        "owner_commit":pin["commit"],"checks":checks,"elapsed_seconds":round(time.monotonic()-start,1)}
(OUT/"final-homepage-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
