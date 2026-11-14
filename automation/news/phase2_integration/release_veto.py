#!/usr/bin/env python3
"""Independent Phase-2 publication veto. QA-only; NEVER a release publisher.

The immutable top200 and data-branch inputs are checked byte-for-byte against
independently recorded hashes. A structural pass can NEVER mean release PASS.
No producer-supplied 'verified' flag or synthetic browser assertion is trusted.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

PIN_TOP = "3a23c8495f00e613a8f0f81b2db5374a19ba89d832e913c6f821823def6b49a5"
PIN_DATA = "15586a71613df59fc7bbdbdce852ebb71b19f663f0e269ca4d9fedb7225afe03"
PIN_DC_REGISTER = "87337db5d3bf7959f7f605d3abd029dd4196ab24a79107ceb95210c5b7751654"
SHA = lambda b: hashlib.sha256(b).hexdigest()

def utc(s):
    if not isinstance(s, str):
        return None
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d.astimezone(dt.timezone.utc) if d.tzinfo else None
    except (ValueError, OverflowError):
        return None

def https(s):
    try:
        p = urlsplit(s)
        return p.scheme == "https" and bool(p.hostname) and not p.username and not p.password
    except (ValueError, TypeError):
        return False

def inspect(top_bytes, data_bytes, evidence=None, now=None, pins=None):
    """Return explicit vetoes; evidence is an external independent receipt bundle."""
    pins = pins or (PIN_TOP, PIN_DATA)
    now = now or dt.datetime.now(dt.timezone.utc)
    veto = []
    facts = {}
    if SHA(top_bytes) != pins[0]: veto.append("TOP200_SOURCE_SHA_MISMATCH")
    if SHA(data_bytes) != pins[1]: veto.append("DATA_SNAPSHOT_SHA_MISMATCH")
    try:
        top = json.loads(top_bytes)
        data = json.loads(data_bytes)
    except (ValueError, UnicodeError):
        return {"status":"HOLD", "release_authorised":False, "vetoes":veto+["INVALID_JSON"], "facts":facts}
    refs = [str(x.get("repd_ref")) for x in top] if isinstance(top,list) else []
    projects = data.get("projects", {}) if isinstance(data,dict) else {}
    if len(refs)!=200 or len(set(refs))!=200 or len(projects)!=200 or set(refs)!=set(projects):
        veto.append("EXACT_200_REPD_IDENTITIES")
    articles = []
    for ref,p in projects.items():
        if str(p.get("repd_ref")) != ref:
            veto.append("PROJECT_REF_MISMATCH")
        for a in p.get("signals",[]):
            articles.append((ref,a))
            if str(a.get("repd_ref")) != ref:
                veto.append("ARTICLE_REF_MISMATCH")
            if not https(a.get("link")):
                veto.append("ARTICLE_SOURCE_URL_INVALID")
    sources = data.get("sources",[]) if isinstance(data,dict) else []
    facts.update(projects=len(projects), articles=len(articles), sources=len(sources))
    evidence = evidence or {}
    receipts = evidence.get("article_receipts",{})
    rights = evidence.get("source_rights",{})
    article_misses=0
    for ref,a in articles:
        url=a.get("link")
        r=receipts.get(url,{}) if isinstance(receipts,dict) else {}
        seen=utc(r.get("fetched_at"))
        # Actual source response digest must be independently fetched, not merely 64 hex.
        if (r.get("project_ref")!=ref or r.get("url")!=url or
            not r.get("independent_fetch") or not r.get("actual_bytes_sha256") or
            not seen or not dt.timedelta(0)<=now-seen<=dt.timedelta(hours=24)):
            article_misses+=1
    if article_misses: veto.append("PER_ARTICLE_INDEPENDENT_CURRENT_FETCH")
    facts["article_receipts_missing"]=article_misses
    rights_misses=0
    for s in sources:
        r=rights.get(s.get("id"),{}) if isinstance(rights,dict) else {}
        checked=utc(r.get("checked_at"))
        if (r.get("source_url")!=s.get("url") or
            r.get("licence_url")!=s.get("licence_url") or
            r.get("reviewer_role")!="independent_rights_reviewer" or
            r.get("redistribution_allowed") is not True or
            not r.get("terms_actual_bytes_sha256") or not checked or checked>now):
            rights_misses+=1
    if rights_misses: veto.append("SOURCE_RIGHTS_INDEPENDENTLY_UNVERIFIED")
    facts["source_rights_missing"]=rights_misses
    # Source bytes and terms cannot be proved merely by this JSON manifest.
    if not evidence.get("independent_byte_retrieval_verified"):
        veto.append("ACTUAL_SOURCE_AND_TERMS_BYTES_UNVERIFIED")
    if not evidence.get("integrated_acid_all_green_no_xfail"):
        veto.append("INTEGRATED_ACID_NOT_GREEN")
    if not evidence.get("independent_reviewer_approved"):
        veto.append("INDEPENDENT_REVIEW_NOT_APPROVED")
    browser=evidence.get("browser",{})
    if not all(browser.get(str(w),{}).get("actual_browser_run") and
               browser.get(str(w),{}).get("js_errors")==0 for w in (1440,390)):
        veto.append("REAL_DESKTOP_MOBILE_BROWSER_UNVERIFIED")
    if not evidence.get("csv_map_real_clicks_exact_ids"):
        veto.append("REAL_CSV_MAP_UNVERIFIED")
    if not evidence.get("public_served_bytes_independently_rehashed"):
        veto.append("SERVED_BYTES_UNVERIFIED")
    if not evidence.get("immutable_successor_and_rollback_rehearsed"):
        veto.append("IMMUTABLE_ROLLBACK_UNVERIFIED")
    if not evidence.get("dc_source_register_sha256")==PIN_DC_REGISTER or not evidence.get("dc_258_rights_verified"):
        veto.append("DC_REGISTER_AND_258_RIGHTS_HOLD")
    # Crucial: this QA reader is not an authority to promote even when a
    # fabricated manifest contains all flags. A separate release controller
    # must independently inspect every source, job and served artifact.
    veto.append("QA_ONLY_NO_PUBLICATION_AUTHORITY")
    return {"status":"HOLD", "release_authorised":False,
            "vetoes":sorted(set(veto)), "facts":facts,
            "source_sha256":{"top200":SHA(top_bytes),"snapshot":SHA(data_bytes)}}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("top200")
    ap.add_argument("snapshot")
    ap.add_argument("--evidence")
    ap.add_argument("--report",required=True)
    a=ap.parse_args()
    e=json.loads(Path(a.evidence).read_text()) if a.evidence else None
    result=inspect(Path(a.top200).read_bytes(),Path(a.snapshot).read_bytes(),e)
    Path(a.report).write_text(json.dumps(result,indent=2)+"\n")
    print("Phase2 independent veto:",result["status"],result["facts"],result["vetoes"])
    # This command is a publication gate: HOLD is a failing exit status.
    raise SystemExit(2 if result["vetoes"] else 0)
if __name__=="__main__": main()
