"""Exact release and homepage verification for the manifest-driven VEDIC promotion."""
import hashlib
import json
import os
import pathlib
import re
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
def verify_command_root(target):
    """Retain the original promotion evidence while checking the stable destination."""
    git_base = "https://raw.githubusercontent.com/Ventusltd/vedic-/"
    baseline_pin = target["source_commit"]
    assert re.fullmatch(r"[0-9a-f]{40}", baseline_pin)
    baseline = {path: read(git_base + baseline_pin + "/" + path) for path in PUBLIC_FILES}
    rows = json.loads(baseline["data/dictionary.json"])["entries"]
    assert len(rows) == target["row_count"]
    original = {"schema": "vedic.pages.release.v1", "version": target["version"],
                "source_commit": baseline_pin, "row_count": len(rows),
                "files": {path: sha(data) for path, data in baseline.items()}}
    encoded = (json.dumps(original, sort_keys=True, indent=2) + "\n").encode("utf-8")
    assert sha(encoded) == target["manifest_sha256"], "historical command release evidence changed"

    url = target["url"]
    current = json.loads(read(url + "release.json"))
    source = current["source_commit"]
    assert current["schema"] == original["schema"] and re.fullmatch(r"[0-9a-f]{40}", source)
    assert "prose_count" not in current
    files = current["files"]
    generated = set(files) - PUBLIC_FILES
    assert PUBLIC_FILES <= files.keys()
    assert all(path == "data/command-index.json" or re.fullmatch(r"data/command-pages/\d{6}\.json", path)
               for path in generated)
    assert not generated or "data/command-index.json" in generated

    for path in PUBLIC_FILES:
        committed = read(git_base + source + "/" + path)
        assert sha(committed) == files[path], (path, "source/manifest mismatch")
        match(url + path, committed)
        if path == "data/dictionary.json":
            entries = json.loads(committed)["entries"]
            assert len(entries) == current["row_count"] == len({row["gg_id"] for row in entries})
            assert entries[:len(rows)] == rows, "original 69 command records changed"
    for path in sorted(generated):
        assert sha(read(url + path)) == files[path], (path, "generated file/manifest mismatch")
    print("PASS: stable VEDIC command root", source, current["row_count"], flush=True)


def check_evidence_only(v2_payload,v3_payload):
    """V3 may add public prose, never a producer module or executable package."""
    assert set(v2_payload)==set(v3_payload)==PUBLIC_FILES
    for name in PUBLIC_FILES-{"index.html"}:
        assert v2_payload[name]==v3_payload[name],(name,"historical dictionary/metadata changed")
    before=v2_payload["index.html"]
    after=v3_payload["index.html"]
    import re
    scripts=lambda raw: re.findall(rb"<script\b[^>]*>.*?</script\s*>",raw,re.I|re.S)
    assert scripts(before)==scripts(after),"executable dashboard scripts changed"
    assert after.count(b'id="package-evidence"')==1
    section=after.split(b'id="package-evidence"',1)[1].split(b"</section>",1)[0]
    assert b"Source redistribution remains blocked" in section
    assert b"not engineering approval or independently accepted software" in section
    assert b"Package download unavailable" in section
    assert not re.search(rb"<(?:script|iframe|object|embed|form|link)\b|<[^>]+\s(?:on[a-z]+\s*=|download(?:\s|=|>))",section,re.I),"active or download markup in evidence section"
    links=re.findall(rb'href="([^"]+)"',section)
    assert len(links)==5 and all(re.fullmatch(rb"https://github\.com/Ventusltd/vedic-/actions/runs/[0-9]+",link) for link in links),"non-evidence link"
    # Remove just the approved register and version label, and require the exact V2 bytes.
    start=after.index(b'<section class="panel" id="package-evidence">')
    end=after.index(b"</section>",start)+len(b"</section>")
    restored=(after[:start]+after[end:]).replace(b"VEDIC V3 / 50 meanings + package capability register",b"VEDIC V2 / 202611261351 / 50 meanings")
    assert restored==before,"unexpected dashboard changes outside evidence register"
def verify_evidence_only(m):
    def payload(release):
        base="https://raw.githubusercontent.com/Ventusltd/vedic-/"+release["source_commit"]+"/"
        return {name:read(base+name) for name in PUBLIC_FILES}
    check_evidence_only(payload(m["v2"]),payload(m["v3"]))
    print("PASS: V3 evidence-only delta, no package bytes, identical dictionary and executable scripts",flush=True)
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
    target=m.get("v3",m["v2"])
    old_id=m["v2"]["version"] if "v3" in m else "v1"
    assert p["operative_release_id"]==old_id and q["operative_release_id"]==m["release_id"]
    assert len(q["releases"])==len(p["releases"])+1
    if "v3" in m:
        assert q["releases"][:-1]==p["releases"]
    else:
        assert len(p["releases"])==1
        assert q["releases"][0]=={**p["releases"][0],"archive_url":m["v1"]["url"],"archive_kind":"app"}
    new=q["releases"][-1]
    assert new["id"]==m["release_id"] and new["url"]==target["url"] and new["status"]=="available"
    assert new["source_ref"]=="https://github.com/Ventusltd/vedic-/tree/"+target["source_commit"]
    promos=previous.get("promotions",[])
    assert current["promotions"][:-1]==promos
    promotion=current["promotions"][-1]
    assert (promotion["entity_id"],promotion["from_release_id"],promotion["to_release_id"])==("vedic",old_id,m["release_id"])
def verify_command_successor(manifest):
    assert manifest["schema"] == "vedic.homepage.commands.v1"
    target = manifest["commands"]
    assert target["url"] == "https://ventusltd.github.io/vedic-/"
    assert target["row_count"] > 50
    event = os.environ["EVENT"]
    if event == "workflow_run":
        assert os.environ["DEPLOY_CONCLUSION"] == "success", "Domain deploy not successful"
    history = json.loads((ROOT/"catalogue/vedic-v3-release.json").read_bytes())
    for name in ("v1", "v2", "v3"):
        prior_release = dict(history[name])
        prior_release.pop("root_alias", None)
        verify_release(prior_release)
    verify_evidence_only(history)
    verify_command_root(target)
    pin_bytes = (ROOT/"catalogue/homepage-owner.json").read_bytes()
    pin = json.loads(pin_bytes)
    assert pin["commit"] == manifest["owner_commit"]
    previous_pin = subprocess.check_output(["git", "show",
        manifest["prior_domain_commit"] + ":catalogue/homepage-owner.json"])
    old_pin = json.loads(previous_pin)
    assert old_pin["commit"] == manifest["prior_owner_commit"]
    assert {k:v for k,v in pin["files"].items() if k not in {"index.html", "data/homepage.json"}} == {
        k:v for k,v in old_pin["files"].items() if k not in {"index.html", "data/homepage.json"}}
    with tempfile.TemporaryDirectory() as tmp:
        scratch = pathlib.Path(tmp)
        previous, current = scratch/"previous", scratch/"current"
        import_bundle(previous, previous_pin)
        import_bundle(current, pin_bytes)
        old = json.loads((previous/"homepage-shell/data/homepage.json").read_bytes())
        new = json.loads((current/"homepage-shell/data/homepage.json").read_bytes())
        old_vedic = next(row for row in old["entities"] if row["id"] == "vedic")
        new_vedic = next(row for row in new["entities"] if row["id"] == "vedic")
        assert [row for row in old["entities"] if row["id"] != "vedic"] == [
            row for row in new["entities"] if row["id"] != "vedic"]
        exclude = {"releases", "operative_release_id"}
        assert {k:v for k,v in old_vedic.items() if k not in exclude} == {
            k:v for k,v in new_vedic.items() if k not in exclude}
        assert new_vedic["releases"][:-1] == old_vedic["releases"]
        command = new_vedic["releases"][-1]
        assert command["id"] == new_vedic["operative_release_id"] == target["version"]
        assert command["url"] == target["url"] and command["status"] == "available"
        assert command["source_ref"] == "https://github.com/Ventusltd/vedic-/tree/" + target["source_commit"]
        assert {k:v for k,v in old.items() if k not in {"entities", "promotions"}} == {
            k:v for k,v in new.items() if k not in {"entities", "promotions"}}
        assert new["promotions"][:-1] == old["promotions"]
        promotion = new["promotions"][-1]
        assert (promotion["entity_id"], promotion["from_release_id"], promotion["to_release_id"]) == (
            "vedic", old_vedic["operative_release_id"], target["version"])
        original = (previous/"index.html").read_bytes()
        proposed = (current/"index.html").read_bytes()
        snapshot = ROOT/manifest["snapshot"]
        assert snapshot.read_bytes() == original and sha(original) == manifest["snapshot_sha256"]
        assert original.replace(history["v3"]["url"].encode(), target["url"].encode(), 1) == proposed
        assert (b'href="' + target["url"].encode() + b'">Open VEDIC') in proposed
        # This successor is already the active homepage promotion.
        observed = current
        match(DOMAIN, (observed/"index.html").read_bytes())
        for path in pin["files"]:
            if path != "index.html":
                match(DOMAIN + "homepage-shell/" + path, (observed/"homepage-shell"/path).read_bytes())
    print("PASS: exact VEDIC command release and navigation-only homepage successor", flush=True)


def main():
    successor = ROOT/"catalogue/vedic-commands-release.json"
    if successor.exists():
        verify_command_successor(json.loads(successor.read_bytes()))
        return
    v3=ROOT/"catalogue/vedic-v3-release.json"
    m=json.loads((v3 if v3.exists() else ROOT/"catalogue/vedic-v2-release.json").read_bytes())
    target=m.get("v3",m["v2"])
    pin_bytes=(ROOT/"catalogue/homepage-owner.json").read_bytes()
    pin=json.loads(pin_bytes)
    assert m["schema"]==("vedic.homepage.release.v3" if "v3" in m else "vedic.homepage.release.v2")
    event=os.environ["EVENT"]
    if event=="workflow_run":
        assert os.environ["DEPLOY_CONCLUSION"]=="success","Domain deploy not successful"
    verify_release(m["v1"])
    verify_release(m["v2"])
    if "v3" in m:
        assert not m["v2"].get("root_alias"),"V2 must remain immutable, not current alias"
        verify_release(m["v3"])
        verify_evidence_only(m)
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
            assert old["archive_url"]==m["v1"]["url"] and new["url"]==target["url"]
        assert (current/"index.html").read_text().count('id="vedic"')==1
        assert target["url"] in (current/"index.html").read_text()
        if "v3" in m:
            e=next(x for x in current_doc["entities"] if x["id"]=="vedic")
            assert next(r for r in e["releases"] if r["id"]==m["v2"]["version"])["url"]==m["v2"]["url"]
        if event=="workflow_run":
            match(DOMAIN,(current/"index.html").read_bytes())
            for f in pin["files"]:
                if f!="index.html":
                    match(DOMAIN+"homepage-shell/"+f,(current/"homepage-shell"/f).read_bytes())
    print("PASS: immutable VEDIC releases, owner catalogue, importer, restore point and applicable public bytes")
if __name__=="__main__":
    main()
