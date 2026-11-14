#!/usr/bin/env python3
"""Non-destructive homepage promotion+rollback rehearsal for Pipeline News.

Loads the CURRENT pinned owner-homepage catalogue and uses its real release
validation/promote implementation, but makes NO changes to any repo or site.
The future actual post-promotion rollback and served-byte checks remain separate.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import re
from pathlib import Path

OLD="202611140306"

def run(home, new_id, commit):
    if not re.fullmatch(r"20\d{10}",new_id) or new_id<="202611141017":
        raise ValueError("New distinct immutable candidate ID required")
    if not re.fullmatch(r"[a-f0-9]{40}",commit):
        raise ValueError("Exact 40-byte Git SHA required")
    code=home/"scripts/releases.py"
    cat=home/"data/homepage.json"
    if not code.is_file() or not cat.is_file():
        raise ValueError("Missing real owner-homepage release tool and data")
    spec=importlib.util.spec_from_file_location("owner_homepage_releases",code)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    initial_bytes=cat.read_bytes()
    initial_sha=hashlib.sha256(initial_bytes).hexdigest()
    initial=mod.load(cat)
    obj=copy.deepcopy(initial)
    target=next((x for x in obj["entities"] if x["id"]=="pipeline-news"),None)
    if target is None or target["operative_release_id"]!=OLD:
        raise ValueError("Actual operative pointer is not pinned V9.20; stop and re-pin")
    if any(x["id"]==new_id for x in target["releases"]):
        raise ValueError("New release ID already exists; do not overwrite history")
    old_releases=copy.deepcopy(target["releases"])
    old_other=[x for x in obj["entities"] if x["id"]!="pipeline-news"]
    target["releases"].append({
        "id":new_id,"label":"New independently verified Pipeline News candidate",
        "url":f"https://globalgrid2050.com/uk_renewables_pipeline/{new_id}/",
        "published_at":None,"status":"available",
        "source_ref":f"https://github.com/Ventusltd/globalgrid2050/tree/{commit}/uk_renewables_pipeline/{new_id}",
    })
    mod.validate(obj)
    promoted=mod.promote(obj,"pipeline-news",new_id,"OFFLINE REHEARSAL: accept stage")
    restored=mod.promote(promoted,"pipeline-news",OLD,"OFFLINE REHEARSAL: restore V9.20")
    back=next(x for x in restored["entities"] if x["id"]=="pipeline-news")
    if back["operative_release_id"]!=OLD:
        raise ValueError("Failed to restore original operative release ID")
    if back["releases"][:len(old_releases)]!=old_releases:
        raise ValueError("Historical Pipeline News releases changed")
    if [x for x in restored["entities"] if x["id"]!="pipeline-news"]!=old_other:
        raise ValueError("Unrelated homepage entities changed")
    if len(restored.get("promotions",[]))!=len(initial.get("promotions",[]))+2:
        raise ValueError("Promotion audit is not append-only")
    if cat.read_bytes()!=initial_bytes:
        raise ValueError("Rehearsal unexpectedly changed the source file")
    return {
        "schema":"ventus.agent3.p2.rollback-dryrun.v1",
        "status":"PASS",
        "rehearsal_only":True,"real_live_rollback":"UNVERIFIED",
        "published_or_promoted":False,
        "original_catalogue_sha256":initial_sha,
        "new_candidate":new_id,"integration_sha":commit,
        "original_operative":OLD,"restored_operative":back["operative_release_id"],
        "old_release_history_preserved":True,
        "two_audited_promotion_entries_in_simulation":True,
        "disk_catalogue_unchanged":True,
        "note":"In-memory use of real scripts/releases.py. Real post-deploy owner-pinned manifest, cache/served SHA and rollback require new independent receipts.",
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--homepage-repo",type=Path,required=True)
    p.add_argument("--candidate-id",required=True)
    p.add_argument("--integration-sha",required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    try:
        report=run(a.homepage_repo.resolve(),a.candidate_id,a.integration_sha)
    except Exception as exc:
        report={"schema":"ventus.agent3.p2.rollback-dryrun.v1",
                "status":"FAIL","rehearsal_only":True,
                "published_or_promoted":False,
                "real_live_rollback":"UNVERIFIED","error":str(exc)}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:report.get(k) for k in
        ("status","original_operative","restored_operative","error")}))
    return 0 if report["status"]=="PASS" else 2

if __name__=="__main__":
    raise SystemExit(main())
