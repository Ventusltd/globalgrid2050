#!/usr/bin/env python3
"""Read-only served-byte + homepage + rollback proof for immutable Pipeline News V9.24."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE="https://globalgrid2050.com/"
ID="202611161244"
OLD="202611160020"
RELEASE=ROOT/"uk_renewables_pipeline"/ID
MAX_ATTEMPTS=int(os.environ.get("V924_VERIFY_ATTEMPTS","16"))
DELAY=int(os.environ.get("V924_VERIFY_DELAY_SECONDS","12"))

def sha(b):return hashlib.sha256(b).hexdigest()
def read(url):
    req=urllib.request.Request(url,headers={"User-Agent":"GlobalGrid2050-V924-Readback/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(req,timeout=25) as r:
        if r.status!=200:raise AssertionError(f"{url}: HTTP {r.status}")
        return r.read()
def check_once():
    html=read(BASE+"uk_renewables_pipeline/"+ID+"/index.html")
    local_html=(RELEASE/"index.html").read_bytes()
    if sha(html)!=sha(local_html):raise AssertionError(f"V9.24 served HTML SHA mismatch {sha(html)} != {sha(local_html)}")
    if b"V9.24" not in html or ID.encode() not in html:raise AssertionError("V9.24 identity marker absent")
    manifest_url=BASE+"uk_renewables_pipeline/"+ID+"/solar1000/manifest.json"
    manifest_bytes=read(manifest_url)
    original=(RELEASE/"solar1000/manifest.json").read_bytes()
    if sha(manifest_bytes)!=sha(original):raise AssertionError("V9.24 served manifest SHA differs from committed bytes")
    manifest=json.loads(manifest_bytes)
    assert manifest["selection"]=="numeric-repd-ref-ascending"
    assert len(manifest["ids"])==len(set(manifest["ids"]))==1000
    assert manifest["ids"][0]=="1018" and manifest["ids"][-1]=="2325"
    assert manifest["record_count"]==7775 and manifest["solar_count"]==3604
    assert manifest["provisional_candidates"]==2 and manifest["not_researched"]==998
    assert manifest["independently_verified"]==0
    root=read(BASE)
    if ID.encode() not in root:raise AssertionError("public homepage still points to old version")
    pin=json.loads((ROOT/"catalogue/homepage-owner.json").read_text())
    if sha(root)!=pin["files"]["index.html"]:
        # The owning source is imported byte-for-byte; surface a divergence clearly.
        raise AssertionError("homepage served HTML SHA differs from SHA-pinned owner index")
    older=read(BASE+"uk_renewables_pipeline/"+OLD+"/index.html")
    older_local=(ROOT/"uk_renewables_pipeline"/OLD/"index.html").read_bytes()
    if sha(older)!=sha(older_local):raise AssertionError("immutable V9.23 rollback changed on public host")
    ledger_bytes=read(BASE+"uk_renewables_pipeline/versions.json")
    data=json.loads(ledger_bytes)
    if not data["versions"] or data["versions"][0]["id"]!=ID or data["versions"][0]["version"]!="V9.24":
        raise AssertionError("public version ledger not yet V9.24")
    if data["versions"][0].get("verdict")!="PASS":
        raise AssertionError("V9.24 release verifier verdict is not PASS")
    return {"checked_at":dt.datetime.now(dt.timezone.utc).isoformat(),"version":"V9.24",
            "release":ID,"homepage_owner_commit":pin["commit"],"public_homepage_sha256":sha(root),
            "public_release_html_sha256":sha(html),"public_manifest_sha256":sha(manifest_bytes),
            "rollback_v923_sha256":sha(older),"public_ledger_sha256":sha(ledger_bytes),
            "solar_1000":1000,"provisional_sources":2,"independently_verified_sources":0,
            "known_external_gridatlas_390px_issue":"unresolved",
            "scope":"HTTP/served bytes, homepage pointer, V9.23 rollback and ledger; NOT proof of independent publisher rights or live GridAtlas 390px behaviour"}

def main():
    for attempt in range(1,MAX_ATTEMPTS+1):
        try:
            receipt=check_once()
            out=pathlib.Path(os.environ.get("V924_RECEIPT_PATH","/tmp/v924-public-receipt.json"))
            out.parent.mkdir(parents=True,exist_ok=True)
            out.write_text(json.dumps(receipt,indent=2)+"\n")
            print("V9.24 PUBLIC SERVED-BYTE ACCEPTANCE PASS:",json.dumps(receipt))
            return
        except Exception as e:
            print(f"V9.24 public readback attempt {attempt}/{MAX_ATTEMPTS}: {type(e).__name__}: {e}",flush=True)
            if attempt<MAX_ATTEMPTS:time.sleep(DELAY)
    raise SystemExit("V9.24 public receipt FAIL: URL/bytes/homepage/ledger not all confirmed")

if __name__=="__main__":main()
