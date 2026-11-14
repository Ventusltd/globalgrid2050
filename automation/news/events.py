#!/usr/bin/env python3
"""automation/news/events.py - typed project events from two REPD releases.

    python -m automation.news.events --previous PREV --new NEW --out events.json \
        [--previous-label "July 2026 (Q2)"] [--new-label "October 2026 (Q3)"] \
        [--large-application-mw 20]

PREV / NEW are loaded with automation/repd/diff.py (official 53-column CSV, or the derived
project_identity_v6.json for PREV), so the comparison basis, capacity rule and status
vocabulary are exactly those of the published July-to-October change report
(docs/repd/2026q3/changes-jul-to-oct/diff.json). The milestone event counts reconcile with
that report's `milestones` section; tests check it.

Event types (one Ref ID can carry several, e.g. consented AND capacity change):

  CONSENTED             new status Awaiting Construction; previous not AC / UC / Operational
  CONSTRUCTION_STARTED  new status Under Construction; previous not UC / Operational
  OPERATIONAL           new status Operational; previous not Operational
  REFUSED               new status Application or Appeal Refused; previous neither
  WITHDRAWN             new status Application or Appeal Withdrawn; previous neither
  APPEAL_LODGED         new status Appeal Lodged; previous not Appeal Lodged
  STATUS_REVERSAL       both statuses on the ladder Application Submitted/Appeal Lodged (1)
                        < Awaiting Construction (2) < Under Construction (3) < Operational (4)
                        and the new rung is lower (e.g. consented back to application)
  DECOMMISSIONED        new status Decommissioned; previous not
  LAPSED_OR_REVISED     new status Abandoned / Planning Permission Expired / Revised; previous not
  NEW_LARGE_APPLICATION Ref ID absent from PREV, status Application Submitted / Appeal Lodged,
                        capacity >= --large-application-mw
  NEW_APPLICATION       as above, capacity below the threshold or unknown
  NEW_RECORD            Ref ID absent from PREV in any other status not typed above
  REMOVED_FROM_REGISTER Ref ID present in PREV, absent from NEW
  CAPACITY_CHANGE       capacity known in both and |new - old| > 0.0051 MW, or stated <-> blank
  OPERATOR_CHANGE       operator differs after names.operator_key (case, punctuation,
                        connectors and legal suffixes ignored); blank -> stated counts
  TECHNOLOGY_CHANGE     Technology Type changed

A new Ref ID first seen already consented / under construction / operational / refused /
withdrawn gets that milestone type with basis "new_record", as in the change report.

Every event carries Ref ID, site, technology, MW (null = unknown, never zero), status before
and after, county, region, country, planning authority, the REPD milestone dates, a
development group key (co-located siblings share it) and a one-line headline built from the
data alone. Output is deterministic: no clock, no absolute paths; inputs by name, size, sha256.

Standard library only. No network.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from automation.repd import diff as repd
from automation.news import names

TOOL = "automation/news/events.py"
SCHEMA = "globalgrid2050.repd-project-events.v1"
DEFAULT_LARGE_APPLICATION_MW = 20.0

ST_APP, ST_APPEAL = "Application Submitted", "Appeal Lodged"
ST_AC, ST_UC, ST_OP = "Awaiting Construction", "Under Construction", "Operational"
REFUSED, WITHDRAWN = repd.REFUSED, repd.WITHDRAWN
LAPSED = {"Abandoned", "Planning Permission Expired", "Revised"}
NOT_STATED = {"unknown", "not known", "tbc", "n a", "na"}
LADDER = {ST_APP: 1, ST_APPEAL: 1, ST_AC: 2, ST_UC: 3, ST_OP: 4}

EVENT_TYPES = (
    "CONSENTED", "CONSTRUCTION_STARTED", "OPERATIONAL", "REFUSED", "WITHDRAWN", "APPEAL_LODGED",
    "STATUS_REVERSAL", "DECOMMISSIONED", "LAPSED_OR_REVISED", "NEW_LARGE_APPLICATION",
    "NEW_APPLICATION", "NEW_RECORD", "REMOVED_FROM_REGISTER", "CAPACITY_CHANGE",
    "OPERATOR_CHANGE", "TECHNOLOGY_CHANGE",
)

# The REPD date column that dates each event type, in order of preference.
EVENT_DATE_COLUMNS = {
    "CONSENTED": ["Planning Permission Granted", "Appeal Granted", "Secretary of State - Granted"],
    "CONSTRUCTION_STARTED": ["Under Construction"],
    "OPERATIONAL": ["Operational"],
    "REFUSED": ["Appeal Refused", "Planning Permission Refused", "Secretary of State - Refusal"],
    "WITHDRAWN": ["Appeal Withdrawn", "Planning Application Withdrawn"],
    "APPEAL_LODGED": ["Appeal Lodged"],
    "NEW_LARGE_APPLICATION": ["Planning Application Submitted"],
    "NEW_APPLICATION": ["Planning Application Submitted"],
    "LAPSED_OR_REVISED": ["Planning Permission Expired"],
}
DATE_FIELDS = [
    ("planning_application_submitted", "Planning Application Submitted"),
    ("planning_application_withdrawn", "Planning Application Withdrawn"),
    ("planning_permission_refused", "Planning Permission Refused"),
    ("appeal_lodged", "Appeal Lodged"),
    ("appeal_withdrawn", "Appeal Withdrawn"),
    ("appeal_refused", "Appeal Refused"),
    ("appeal_granted", "Appeal Granted"),
    ("planning_permission_granted", "Planning Permission Granted"),
    ("secretary_of_state_refusal", "Secretary of State - Refusal"),
    ("secretary_of_state_granted", "Secretary of State - Granted"),
    ("planning_permission_expired", "Planning Permission Expired"),
    ("under_construction", "Under Construction"),
    ("operational", "Operational"),
]

TECH_SHORT = {
    "Solar Photovoltaics": "solar", "Battery": "battery storage", "Wind Onshore": "onshore wind",
    "Wind Offshore": "offshore wind", "Pumped Storage Hydroelectricity": "pumped storage",
    "Liquid Air Energy Storage": "liquid air storage", "Compressed Air Energy Storage":
    "compressed air storage", "Hydrogen": "hydrogen",
}


def _t(rec, col) -> str:
    return repd.collapse(rec.get(col, "")) if rec else ""


def _date(rec, col):
    d = repd.parse_date(rec.get(col, "")) if rec else None
    return d.isoformat() if d else None


def _mw_text(mw) -> str:
    if mw is None:
        return "capacity not stated"
    v = round(mw, 2)
    s = f"{v:,.2f}".rstrip("0").rstrip(".")
    return f"{s} MW"


def _place(rec) -> str:
    county, region = _t(rec, repd.COUNTY), _t(rec, repd.REGION)
    return county or region or _t(rec, repd.COUNTRY) or "location not stated"


def _site_key(rec) -> str:
    return f"{names.norm(_t(rec, repd.SITE))}|{names.norm(_t(rec, repd.COUNTY))}"


def development_groups(*snapshots) -> dict:
    """Ref ID -> development group key. Co-located REPD siblings share a key: rows with the same
    site name and county, or rows joined by 'Storage Co-location REPD Ref ID' (either direction).
    Union-find over every record of the given snapshots; the key is 'DEV-<lowest Ref ID>'.
    It is a display/dedupe key only, never an identity claim."""
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            if repd.ref_key(ra) < repd.ref_key(rb):
                parent[rb] = ra
            else:
                parent[ra] = rb

    by_site = {}
    for snap in snapshots:
        for ref, rec in snap["by_ref"].items():
            find(ref)
            by_site.setdefault(_site_key(rec), []).append(ref)
            for co in _t(rec, "Storage Co-location REPD Ref ID").replace(";", ",").replace("/", ",").split(","):
                co = repd.clean_ref(co)
                if co and co != ref and co in snap["by_ref"]:
                    union(ref, co)
    for refs in by_site.values():
        for other in refs[1:]:
            union(refs[0], other)
    return {ref: f"DEV-{find(ref)}" for ref in parent}


def headline(etype: str, rec, prev, ev: dict) -> str:
    """One plain line from the data alone: what changed, where, how big, which Ref ID."""
    site = names.site_display(_t(rec, repd.SITE)) or "Unnamed site"
    tech = TECH_SHORT.get(_t(rec, repd.TECH), _t(rec, repd.TECH).lower() or "technology not stated")
    mw = _mw_text(ev["capacity_mw"])
    ref = ev["ref"]
    place = _place(rec)
    base = f"{site}, {mw} {tech}, {place} (REPD {ref})" if ev["capacity_mw"] is not None else \
        f"{site}, {tech}, {mw}, {place} (REPD {ref})"
    was = ev.get("previous_status")
    if etype == "CONSENTED":
        tail = f"; previously {was}" if was else "; first listed already consented"
        return f"Consented: {base}{tail}"
    if etype == "CONSTRUCTION_STARTED":
        tail = f"; previously {was}" if was else "; first listed under construction"
        return f"Under construction: {base}{tail}"
    if etype == "OPERATIONAL":
        tail = f"; previously {was}" if was else "; first listed operational"
        return f"Operational: {base}{tail}"
    if etype == "REFUSED":
        return f"Refused ({ev['status']}): {base}" + (f"; previously {was}" if was else "")
    if etype == "WITHDRAWN":
        return f"Withdrawn ({ev['status']}): {base}" + (f"; previously {was}" if was else "")
    if etype == "APPEAL_LODGED":
        return f"Appeal lodged: {base}" + (f"; previously {was}" if was else "")
    if etype == "STATUS_REVERSAL":
        return f"Status reversal: {base} moved from {was} back to {ev['status']}"
    if etype == "DECOMMISSIONED":
        return f"Decommissioned: {base}; previously {was}"
    if etype == "LAPSED_OR_REVISED":
        return f"{ev['status']}: {base}; previously {was}"
    if etype == "NEW_LARGE_APPLICATION":
        return f"New large application: {base}, first listed in this release"
    if etype == "NEW_APPLICATION":
        return f"New application: {base}, first listed in this release"
    if etype == "NEW_RECORD":
        return f"New record ({ev['status']}): {base}, first listed in this release"
    if etype == "REMOVED_FROM_REGISTER":
        return f"No longer listed: {base}; last status {was}"
    if etype == "CAPACITY_CHANGE":
        old, new = ev["change"]["old_mw"], ev["change"]["new_mw"]
        if old is None:
            return f"Capacity now stated: {site}, {tech}, {place} (REPD {ref}) at {_mw_text(new)}"
        if new is None:
            return f"Capacity no longer stated: {site}, {tech}, {place} (REPD {ref}); was {_mw_text(old)}"
        return f"Capacity revised: {site}, {tech}, {place} (REPD {ref}) from {_mw_text(old)} to {_mw_text(new)}"
    if etype == "OPERATOR_CHANGE":
        old, new = ev["change"]["old_operator"] or "not stated", ev["change"]["new_operator"] or "not stated"
        return f"Operator recorded for {base} changed from {old} to {new}"
    if etype == "TECHNOLOGY_CHANGE":
        return (f"Technology reclassified: {site}, {place} (REPD {ref}) from "
                f"{ev['change']['old_technology']} to {ev['change']['new_technology']}")
    raise ValueError(etype)


def _event_id(pair: str, ref: str, etype: str) -> str:
    h = hashlib.sha256(f"{pair}|{ref}|{etype}".encode()).hexdigest()[:16].upper()
    return f"GG2050-REPDEVT-{h}"


def _record_view(rec) -> dict:
    return {
        "site_name": names.site_display(_t(rec, repd.SITE)),
        "technology": _t(rec, repd.TECH) or None,
        "operator": _t(rec, repd.OPER) or None,
        "county": _t(rec, repd.COUNTY) or None,
        "region": _t(rec, repd.REGION) or None,
        "country": _t(rec, repd.COUNTRY) or None,
        "planning_authority": _t(rec, "Planning Authority") or None,
        "planning_application_reference": _t(rec, "Planning Application Reference") or None,
        "storage_colocation_ref": _t(rec, "Storage Co-location REPD Ref ID") or None,
    }


def classify_status(old: str | None, new: str | None) -> list[str]:
    """Status-driven event types for one Ref ID. old None = new record; new None = removed."""
    if new is None:
        return ["REMOVED_FROM_REGISTER"]
    out = []
    if new == ST_AC and old not in (ST_AC, ST_UC, ST_OP):
        out.append("CONSENTED")
    elif new == ST_UC and old not in (ST_UC, ST_OP):
        out.append("CONSTRUCTION_STARTED")
    elif new == ST_OP and old != ST_OP:
        out.append("OPERATIONAL")
    elif new in REFUSED and old not in REFUSED:
        out.append("REFUSED")
    elif new in WITHDRAWN and old not in WITHDRAWN:
        out.append("WITHDRAWN")
    elif new == ST_APPEAL and old != ST_APPEAL and old is not None:
        out.append("APPEAL_LODGED")
    elif new == "Decommissioned" and old != "Decommissioned" and old is not None:
        out.append("DECOMMISSIONED")
    elif new in LAPSED and old != new and old is not None:
        out.append("LAPSED_OR_REVISED")
    if old is not None and old in LADDER and new in LADDER and LADDER[new] < LADDER[old]:
        out.append("STATUS_REVERSAL")
    return out


def build_events(old: dict, new: dict, previous_label: str = "previous", new_label: str = "new",
                 large_application_mw: float = DEFAULT_LARGE_APPLICATION_MW,
                 cap_tol: float = repd.DEFAULT_CAP_TOL) -> dict:
    """old/new: snapshots from automation.repd.diff.load_previous / load_csv."""
    O, N = old["by_ref"], new["by_ref"]
    pair = f"{old['info']['sha256'][:12]}..{new['info']['sha256'][:12]}"
    events = []
    cosmetic_operator = 0
    groups = development_groups(new, old)

    def emit(etype, ref, rec, prev, basis, change=None):
        cap = repd.cap_of(rec) if rec else None
        ev = {
            "event_id": _event_id(pair, ref, etype),
            "event_type": etype,
            "basis": basis,
            "ref": ref,
            "gg_project_id": f"GG2050-REPD-{ref}",
            "capacity_mw": repd.r3(cap),
            "previous_capacity_mw": repd.r3(repd.cap_of(prev)) if prev else None,
            "status": None if etype == "REMOVED_FROM_REGISTER" else (_t(rec, repd.STATUS) or None),
            "previous_status": _t(prev, repd.STATUS) or None if prev else None,
            **_record_view(rec),
            "dates": {k: v for k, v in ((k, _date(rec, c)) for k, c in DATE_FIELDS) if v},
            "record_last_updated": _date(rec, repd.UPDATED),
            "previous_record_last_updated": _date(prev, repd.UPDATED) if prev else None,
            "event_date": None,
            "event_date_source": None,
            "group_key": groups.get(ref, f"DEV-{ref}"),
        }
        for col in EVENT_DATE_COLUMNS.get(etype, []):
            d = _date(rec, col)
            if d:
                ev["event_date"], ev["event_date_source"] = d, col
                break
        if change is not None:
            ev["change"] = change
        ev["headline"] = headline(etype, rec, prev, ev)
        events.append(ev)

    for ref in sorted(set(O) | set(N), key=repd.ref_key):
        o, n = O.get(ref), N.get(ref)
        if n is None:
            emit("REMOVED_FROM_REGISTER", ref, o, o, "removed")
            continue
        new_status = _t(n, repd.STATUS)
        if o is None:
            types = classify_status(None, new_status)
            if types:
                for t in types:
                    emit(t, ref, n, None, "new_record")
            elif new_status in (ST_APP, ST_APPEAL):
                cap = repd.cap_of(n)
                big = cap is not None and cap >= large_application_mw
                emit("NEW_LARGE_APPLICATION" if big else "NEW_APPLICATION", ref, n, None, "new_record")
            else:
                emit("NEW_RECORD", ref, n, None, "new_record")
            continue
        old_status = _t(o, repd.STATUS)
        if old_status != new_status:
            for t in classify_status(old_status, new_status):
                emit(t, ref, n, o, "transition")
        oc, nc = repd.cap_of(o), repd.cap_of(n)
        if (oc is None) != (nc is None) or (oc is not None and abs(nc - oc) > cap_tol):
            emit("CAPACITY_CHANGE", ref, n, o, "transition",
                 {"old_mw": repd.r3(oc), "new_mw": repd.r3(nc),
                  "delta_mw": repd.r3(nc - oc) if oc is not None and nc is not None else None,
                  "kind": "stated" if oc is None else "blanked" if nc is None else "revised"})
        oo, no = _t(o, repd.OPER), _t(n, repd.OPER)
        oo = "" if names.norm(oo) in NOT_STATED else oo
        no = "" if names.norm(no) in NOT_STATED else no
        if oo != no:
            if names.operator_key(oo) != names.operator_key(no):
                emit("OPERATOR_CHANGE", ref, n, o, "transition",
                     {"old_operator": oo or None, "new_operator": no or None,
                      "kind": "stated" if not oo else "blanked" if not no else "changed"})
            else:
                cosmetic_operator += 1
        ot, nt = _t(o, repd.TECH), _t(n, repd.TECH)
        if ot != nt:
            emit("TECHNOLOGY_CHANGE", ref, n, o, "transition",
                 {"old_technology": ot or None, "new_technology": nt or None})

    # siblings: other Ref IDs in the same development group carrying the same event type
    by_group = {}
    for ev in events:
        by_group.setdefault((ev["group_key"], ev["event_type"]), []).append(ev["ref"])
    for ev in events:
        sib = [r for r in by_group[(ev["group_key"], ev["event_type"])] if r != ev["ref"]]
        ev["sibling_refs_same_event"] = sib

    counts = {t: 0 for t in EVENT_TYPES}
    for ev in events:
        counts[ev["event_type"]] += 1
    return {
        "schema": SCHEMA,
        "tool": TOOL,
        "previous": {"label": previous_label, **{k: old["info"][k] for k in ("file", "bytes", "sha256", "unique_refs", "max_record_last_updated")}},
        "new": {"label": new_label, **{k: new["info"][k] for k in ("file", "bytes", "sha256", "unique_refs", "max_record_last_updated")}},
        "rules": {
            "comparison_basis": "unique Ref IDs (automation/repd/diff.py loaders)",
            "capacity_rule": "blank or non-numeric capacity is unknown (null), never zero",
            "capacity_tolerance_mw": cap_tol,
            "large_application_mw": large_application_mw,
            "operator_change_rule": "operator differs after names.operator_key; cosmetic differences counted, not emitted",
            "status_ladder": LADDER,
        },
        "counts": counts,
        "operator_cosmetic_changes_not_emitted": cosmetic_operator,
        "events": events,
    }


def load_pair(previous, new):
    new_snap = repd.load_csv(new)
    old_snap = repd.load_previous(previous, header_reference=new_snap["header"])
    return old_snap, new_snap


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--previous", required=True)
    ap.add_argument("--new", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--previous-label", default="previous")
    ap.add_argument("--new-label", default="new")
    ap.add_argument("--large-application-mw", type=float, default=DEFAULT_LARGE_APPLICATION_MW)
    a = ap.parse_args(argv)
    old, new = load_pair(a.previous, a.new)
    doc = build_events(old, new, a.previous_label, a.new_label, a.large_application_mw)
    Path(a.out).write_text(json.dumps(doc, indent=1, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8")
    print(json.dumps(doc["counts"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
