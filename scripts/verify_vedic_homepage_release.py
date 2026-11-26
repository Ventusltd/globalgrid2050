"""Exact release and homepage verification for the manifest-driven VEDIC promotion."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen

ROOT = pathlib.Path.cwd()
PUBLIC_FILES = {"index.html","data/anatomy.json","data/translation-geodesy.json","data/nearest-spider.json","data/dictionary.json"}
DOMAIN = "https://globalgrid2050.com/"
def sha(data):
    return hashlib.sha256(data).hexdigest()
def read(url):
    with urlopen(Request(url,headers={"User-Agent":"GlobalGrid2050-VEDIC-release-verifier","Cache-Control":"no-cache"}),timeout=30) as response:
        assert response.status == 200,url
        raw=response.read(1000001)
        assert 0<len(raw)<=1000000,url
        return raw
def match(url,wanted):
    for i in range(6):
        try:
            got=read(url+("?" if "?" not in url else "&")+"vedic-v2-check="+str(i))
            if got==wanted:
                print("MATCH",url,sha(got),flush=True)
                return
        except Exception as exc:
            print("RETRY",url,type(exc).__name__,flush=True)
        time.sleep(5)
    raise AssertionError("Public bytes not verified: "+url)
def verify_release(release):
    url=release["url"]
    manifest_raw=read(url+"release.json")
    assert sha(manifest_raw)==release["manifest_sha256"],"served release manifest changed"
    manifest=json.loads(manifest_raw)
    assert manifest["schema"]=="vedic.pages.release.v1"
    assert manifest["version"]==release["version"] and manifest["source_commit"]==release["source_commit"]
    assert manifest["row_count"]==release["row_count"]
    assert set(manifest["files"])==PUBLIC_FILES
    raw_base="https://raw.githubusercontent.com/Ventusltd/vedic-/"+release["source_commit"]+"/"
    for f,digest in manifest["files"].items():
        wanted=read(raw_base+f)
        assert sha(wanted)==digest,(f,"source/manifest mismatch")
        if f=="data/dictionary.json":
            rows=json.loads(wanted)["entries"]
            assert len(rows)==release["row_count"]==len({e["gg_id"] for e in rows})
        match(url+f,wanted)
        if release.get("root_alias"):
            match(release["root_alias"]+f,wanted)
    if release.get("root_alias"):
        match(release["root_alias"]+"release.json",manifest_raw)
def import_bundle(root,pin_bytes):
    (root/"catalogue").mkdir(parents=True,exist_ok=True)
    (root/"scripts").mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT/"scripts/import_homepage_owner.py",root/"scripts/import_homepage_owner.py")
    (root/"catalogue/homepage-owner.json").write_bytes(pin_bytes)
    subprocess.run([sys.executable,str(root/"scripts/import_homepage_owner.py")],check=True)
def compare_catalogues(previous,current,m):
    p=next(e for e in previous["entities"] if e["id"]=="vedic")
    q=next(e for e in current["entities"] if e["id"]=="vedic")
    assert [e for e in current["entities"] if e["id"]!="vedic"]==[e for e in previous["entities"] if e["id"]!="vedic"]
    assert {k:v for k,v in current.items() if k not in ("entities","promotions")}=={k:v for k,v in previous.items() if k not in ("entities","promotions")}
    assert {k:v for k,v in q.items() if k not in ("releases","operative_release_id")}=={k:v for k,v in p.items() if k not in ("releases","operative_release_id")}
    assert p["operative_release_id"]=="v1" and q["operative_release_id"]==m["release_id"]
    assert len(p["releases"])==1 and len(q["releases"])==2
    old,new=q["releases"]
    assert old=={**p["releases"][0],"archive_url":m["v1"]["url"],"archive_kind":"app"}
    assert new["id"]==m["release_id"] and new["url"]==m["v2"]["url"] and new["status"]=="available"
    assert new["source_ref"]=="https://github.com/Ventusltd/vedic-/tree/"+m["v2"]["source_commit"]
    promos=previous.get("promotions",[])
    assert current["promotions"][:-1]==promos
    promotion=current["promotions"][-1]
    assert (promotion["entity_id"],promotion["from_release_id"],promotion["to_release_id"])==("vedic","v1",m["release_id"])
def main():
    m=json.loads((ROOT/"catalogue/vedic-v2-release.json").read_bytes())
    pin_bytes=(ROOT/"catalogue/homepage-owner.json").read_bytes()
    pin=json.loads(pin_bytes)
    assert m["schema"]=="vedic.homepage.release.v2"
    event=os.environ["EVENT"]
    if event=="workflow_run":
        assert os.environ["DEPLOY_CONCLUSION"]=="success","Domain deploy not successful"
    verify_release(m["v1"])
    verify_release(m["v2"])
    with tempfile.TemporaryDirectory() as tmp:
        root=pathlib.Path(tmp)
        previous,current=root/"previous",root/"current"
        old_pin=subprocess.check_output(["git","show",m["prior_domain_commit"]+":catalogue/homepage-owner.json"])
        assert json.loads(old_pin)["commit"]==m["prior_owner_commit"]
        import_bundle(previous,old_pin)
        import_bundle(current,pin_bytes)
        previous_doc=json.loads((previous/"homepage-shell/data/homepage.json").read_bytes())
        current_doc=json.loads((current/"homepage-shell/data/homepage.json").read_bytes())
        # Exact owner pin gate for this release, not a stale-pin success skip.
        if pin["commit"]==m["owner_commit"]:
            assert pin["files"]==m["owner_files"]
            compare_catalogues(previous_doc,current_doc,m)
            snapshot=ROOT/m["snapshot"]
            metrics=json.loads((ROOT/m["metrics"]).read_bytes())
            measured=json.loads(subprocess.check_output([sys.executable,str(ROOT/"scripts/measure_homepage_version.py"),str(snapshot)]))[0]
            for key in ("lines","words","characters","bytes","sha256"):
                assert measured[key]==metrics[key],key
            assert metrics["source_commit"]==m["prior_domain_commit"] and metrics["source_owner_commit"]==m["prior_owner_commit"]
            assert snapshot.read_bytes()==(previous/"index.html").read_bytes(),"restore snapshot mismatch"
            assert sha((current/"index.html").read_bytes())==metrics["proposed_root_sha256"]
            if event=="pull_request":
                match(DOMAIN,snapshot.read_bytes())
                for f in json.loads(old_pin)["files"]:
                    if f!="index.html":
                        match(DOMAIN+"homepage-shell/"+f,(previous/"homepage-shell"/f).read_bytes())
        else:
            # Later unrelated owner promotions must retain these exact VEDIC release routes.
            e=next(x for x in current_doc["entities"] if x["id"]=="vedic")
            assert e["operative_release_id"]==m["release_id"],"VEDIC successor requires explicit manifest update"
            old=next(r for r in e["releases"] if r["id"]=="v1")
            new=next(r for r in e["releases"] if r["id"]==m["release_id"])
            assert old["archive_url"]==m["v1"]["url"] and new["url"]==m["v2"]["url"]
        assert (current/"index.html").read_text().count('id="vedic"')==1
        assert m["v2"]["url"] in (current/"index.html").read_text()
        if event=="workflow_run":
            match(DOMAIN,(current/"index.html").read_bytes())
            for f in pin["files"]:
                if f!="index.html":
                    match(DOMAIN+"homepage-shell/"+f,(current/"homepage-shell"/f).read_bytes())
    print("PASS: immutable VEDIC releases, owner catalogue, importer, restore point and applicable public bytes")
if __name__=="__main__":
    main()
