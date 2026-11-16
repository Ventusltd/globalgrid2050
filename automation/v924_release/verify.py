#!/usr/bin/env python3
"""Fail closed if V9.24 pilot mislabels sources or alters inherited REPD/MAP."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
OLD=ROOT/"uk_renewables_pipeline/202611160020";NEW=ROOT/"uk_renewables_pipeline/202611161250"
def main():
 ids=json.loads((HERE/"pinned_solar1000.json").read_text())["ids"];rows=[];hashes={}
 for i in range(1,17):
  f=OLD/"data/v9.1/projects"/f"part-{i:03}.json";raw=f.read_bytes()
  hashes[f.name]=hashlib.sha256(raw).hexdigest()
  p=json.loads(raw);assert p["partition"]==i;rows+=p["projects"]
 assert len(rows)==7775
 solar=sorted((p for p in rows if p["repd_technology"]=="Solar Photovoltaics"),key=lambda p:int(p["repd_ref"]))
 assert len(solar)==3604 and len(ids)==1000 and len(set(ids))==1000
 assert ids==[p["repd_ref"] for p in solar[:1000]] and ids[0]=="1018" and ids[-1]=="2325"
 assert NEW.is_dir()
 d=json.loads((NEW/"news/solar1000-v924.json").read_text())
 assert d["ids"]==ids and d["original_part_sha256"]==hashes
 assert d["counts"]=={"register":7775,"solar":3604,"selected":1000,"search_candidates":2,"independently_verified":0,"not_researched":998}
 assert {c["repd_ref"] for c in d["candidates"]}=={"1019","1020"}
 assert all(c["verified"] is False and c["rights_basis"]=="unknown" and c["source_url"].startswith("https://") for c in d["candidates"])
 for rel in ["contracts/release.v9.1.json","data/v9.1/build_manifest.json",
             "data/v9.8/interconnectors.json","scripts/core/atlas-receiver-v9-7.js",
             "scripts/plugins/projects-v9-8.js"]:
  assert (OLD/rel).read_bytes()==(NEW/rel).read_bytes(),rel
 assert 'id="solar1000Banner"' in (NEW/"index.html").read_text()
 reg=json.loads((ROOT/"automation/pipeline_release/registry.json").read_text())
 assert reg["versions"][-1]["id"]=="202611161250"
 print("PASS: 7775 register, 3604 solar, 1000 pinned, 2 unverified, 998 not researched, 0 verified, inherited MAP/CSV unchanged")
if __name__=="__main__":main()
