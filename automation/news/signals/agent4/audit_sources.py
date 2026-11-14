#!/usr/bin/env python3
"""Deterministic offline source inventory for Agent 4. No scraping and no publication.

Usage: python automation/news/signals/agent4/audit_sources.py --out /tmp/a4-source-audit.json
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
FILES = ["top200_solar.json", "aliases.json", "alias_standings.json",
         "exclusions.json", "reviewed_signals.json", "gate.py",
         "combine.py", "dates.py"]
CONFLICTS = {
    "Byers Gill": "Headline says RWE; REPD operator was reported as JBM Solar Projects",
    "Grimsby": "Reported 499 MW vs REPD 49.9 MW; possible factor-of-ten or different scheme",
    "Mere Flats": "Conflicting ownership attributions",
    "Wentlooge": "Reported refusal versus REPD appeal-lodged status; distinguish prior vs newer applications",
    "Frodsham": "Reported approval versus possibly lagging REPD status",
    "Craig y Perthi": "JBM versus RWE developer/operator claims",
    "Hedgehog Grove": "Reported planning-reference geography inconsistent with REPD location",
}


def inventory():
    rows = json.loads((HERE / "top200_solar.json").read_text(encoding="utf-8"))
    aliases = json.loads((HERE / "aliases.json").read_text(encoding="utf-8"))["projects"]
    standings = json.loads((HERE / "alias_standings.json").read_text(encoding="utf-8"))["projects"]
    ref_list = [str(r["repd_ref"]) for r in rows]
    assert len(rows) == 200 and len(set(ref_list)) == 200
    assert set(aliases) == set(ref_list) == set(standings)
    hashes = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in FILES}
    without_url = sorted(r for r, p in aliases.items()
                         if p.get("alias_status") == "confirmed" and not p.get("alias_evidence_url"))
    unresolved = []
    for name, conflict in CONFLICTS.items():
        matches = [{"repd_ref": str(r["repd_ref"]), "site_name": r["site_name"],
                    "operator_as_recorded": r.get("operator"),
                    "capacity_mw_as_recorded": r.get("mw"),
                    "status_as_recorded": r.get("status"),
                    "planning_reference_as_recorded": r.get("planning_ref")}
                   for r in rows if name.lower() in str(r.get("site_name") or "").lower()]
        unresolved.append({"topic": name, "reported_conflict": conflict,
                           "top200_matches": matches, "review_state": "UNVERIFIED",
                           "required": "check original REPD row, authoritative register case and dated original report"})
    return {
        "schema": "agent4-source-audit.v1",
        "scope": "static repository bytes, no online publisher, application or licensing validation",
        "input_sha256": hashes, "top200_rows": len(rows),
        "unique_repd_refs": len(set(ref_list)),
        "confirmed_aliases_missing_direct_evidence_url": len(without_url),
        "missing_url_refs": without_url,
        "repd_9050": {
            "site_name": aliases["9050"]["site_name"],
            "planning_ref": aliases["9050"]["planning_ref"],
            "alias_evidence_url": aliases["9050"].get("alias_evidence_url") or None,
            "alias_status_as_recorded": aliases["9050"].get("alias_status"),
            "note": "text evidence is not independent URL-receipt or publisher-rights proof",
        },
        "unresolved_conflicts": unresolved,
        "source_of_conflict_list": "neural-link PR #23 sweep 2026-11-14 README; unverified hypotheses",
        "rights_clearance": "NOT_CHECKED", "live_article_provenance": "NOT_CHECKED",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    report = inventory()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print("Agent 4 source audit: 200/200 unique refs; missing alias evidence URLs:",
          report["confirmed_aliases_missing_direct_evidence_url"])
    print("Unresolved conflict topics:", len(report["unresolved_conflicts"]))
    print("SHA-256 report:", hashlib.sha256(args.out.read_bytes()).hexdigest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
