#!/usr/bin/env python3
"""automation/news/relevance.py - transparent, additive relevance score for REPD events and articles.

Nothing here is learned or hidden. A score is the sum of named components, each with its
points, its maximum and the plain-language basis it was computed from; the output carries
every component, so a reader can recompute any score by hand. The weights live in one
profile (DEFAULT_PROFILE, "solar-storage-grid.v1") whose sha256 is written into every feed.

Components (points; maximum for the default profile)

  capacity              10 * log10(1 + MW), capped at 30. Capacity change events use |delta MW|.
                        Unknown capacity scores 0 and says so (never treated as zero MW).
  stage                 event type weight (consent, construction, operation highest; 0-20).
  technology            priority for a solar, storage and grid business (0-15).
  recency               age of the dated milestone against the release's own reference date
                        (the newest Record Last Updated in the new release; no wall clock): 0-10.
  national_route        planning authority is a national consenting route (Planning Inspectorate
                        NSIP, Welsh Government NSIP, Scottish Government S36): 8.
  datacentre_proximity  nearest data centre within 5/10/25/50 km straight line, from the REPD x
                        data-centre convergence join (Team 6, dist/convergence/2026q3) when it is
                        supplied and the data-centre point is flagged proximity-reliable: 10/7/4/2.
                        Screening only: proximity is not a connection, capacity or offtake.
  novelty               against the previous feed: Ref ID never covered 6; covered for another
                        event 3; same event already reported 0.
  evidence_tier         official record 15 / attributed reporting 8 / unverified 0. Every REPD
                        event is an official record (DESNZ REPD).
  colocated_storage     REPD 'Storage Co-location REPD Ref ID' is filled: 3.
  binding (articles)    confidence class of the article-to-project binding (binder.py):
                        EXACT 10, STRONG 7, PROBABLE 2, CANDIDATE 0, UNBOUND 0.
  official_corroboration (articles) the bound project's REPD record agrees with the story:
                        same event in this release's REPD diff 6; status consistent 3; else 0.
                        A contradiction is flagged, not scored.

Standard library only. No network.
"""
from __future__ import annotations

import hashlib
import json
import math
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from automation.news import names

PROFILE_ID = "solar-storage-grid.v1"

DEFAULT_PROFILE = {
    "id": PROFILE_ID,
    "capacity": {"scale": 10.0, "cap": 30.0},
    "stage": {
        "CONSENTED": 20, "CONSTRUCTION_STARTED": 20, "OPERATIONAL": 18, "NEW_LARGE_APPLICATION": 16,
        "REFUSED": 14, "STATUS_REVERSAL": 14, "DECOMMISSIONED": 10, "WITHDRAWN": 10,
        "APPEAL_LODGED": 10, "CAPACITY_CHANGE": 8, "OPERATOR_CHANGE": 8, "NEW_APPLICATION": 8,
        "LAPSED_OR_REVISED": 6, "TECHNOLOGY_CHANGE": 5, "NEW_RECORD": 4, "REMOVED_FROM_REGISTER": 3,
        # article event labels (major_project_news_v6 vocabulary)
        "FINANCIAL_CLOSE": 14, "GRID_CONNECTION": 12, "ACQUISITION": 10, "DELAY": 10,
        "CONTRACT": 8, "EXPANSION": 8, "PROJECT_UPDATE": 4,
    },
    "technology": {
        "Solar Photovoltaics": 15, "Battery": 15, "Pumped Storage Hydroelectricity": 12,
        "Liquid Air Energy Storage": 12, "Compressed Air Energy Storage": 12, "Flywheels": 12,
        "Wind Onshore": 8, "Wind Offshore": 8, "Hydrogen": 6, "_other": 3, "_unknown": 0,
    },
    "recency_days": [[30, 10], [90, 7], [180, 4], [365, 2]],
    "recency_undated": 1,
    "national_route": {"points": 8, "authorities": [
        "The Planning Inspectorate - National Infrastructure", "Welsh Government (NSIP)",
        "Scottish Government (S36)"]},
    "datacentre_km": [[5, 10], [10, 7], [25, 4], [50, 2]],
    "novelty": {"new": 6, "other_event": 3, "repeat": 0},
    "evidence_tier": {"official_record": 15, "attributed_reporting": 8, "unverified_lead": 0},
    "colocated_storage": 3,
    "binding": {"EXACT": 10, "STRONG": 7, "PROBABLE": 2, "CANDIDATE": 0, "UNBOUND": 0},
    "official_corroboration": {"same_event_in_release": 6, "status_consistent": 3, "none": 0},
}

# Article event vocabulary of scripts/major_project_news_v6.py EVENTS, restated (order matters:
# negative outcomes before consent words).
ARTICLE_EVENTS = [
    ("REFUSED", ["refused", "rejected", "refusal", "turned down", "dismissed", "appeal fails"]),
    ("DELAY", ["delayed", "delay", "judicial review", "postponed", "deferred", "setback"]),
    ("OPERATIONAL", ["commercial operation", "operational", "energised", "energized", "commissioned",
                     "goes live", "entered operation", "enters operations", "begins operations"]),
    ("CONSTRUCTION_STARTED", ["construction", "breaking ground", "build begins", "under construction",
                              "construction starts", "work on", "starts"]),
    ("CONSENTED", ["development consent", "consent awarded", "grants dco", "dco granted", "planning consent",
                   "approved", "approval", "approves", "consented", "permission granted",
                   "planning permission", "green light", "says yes", "wins permit", "secures consent",
                   "consent decision"]),
    ("FINANCIAL_CLOSE", ["financial close", "financing", "funding secured", "debt financing", "finance deal"]),
    ("ACQUISITION", ["acquires", "acquired", "acquisition", "sold to", "sale of", "portfolio sale", "buys",
                     "new owners"]),
    ("GRID_CONNECTION", ["grid connection", "connected to the grid", "connection agreement", "grid offer"]),
    ("CONTRACT", ["to optimise", "to optimize", "partner on", "awarded contract", "secures contract",
                  "epc", "o and m", "ppa", "cppa", "tolling agreement"]),
    ("EXPANSION", ["expansion", "expanded", "extension", "upsized"]),
    ("NEW_APPLICATION", ["submits planning application", "plans revealed", "plan for", "proposed",
                         "planning application", "plans to build", "planned"]),
]
LEGACY_EVENT_LABELS = {
    "CONSENT": "CONSENTED", "CONSTRUCTION": "CONSTRUCTION_STARTED", "OPERATIONAL": "OPERATIONAL",
    "REFUSAL": "REFUSED", "FINANCIAL CLOSE": "FINANCIAL_CLOSE", "ACQUISITION": "ACQUISITION",
    "GRID CONNECTION": "GRID_CONNECTION", "CONTRACT": "CONTRACT", "EXPANSION": "EXPANSION",
    "DELAY": "DELAY", "PROJECT UPDATE": "PROJECT_UPDATE",
}
# REPD statuses each article event is consistent with (for corroboration / contradiction).
CONSISTENT_STATUS = {
    "CONSENTED": {"Awaiting Construction", "Under Construction", "Operational"},
    "CONSTRUCTION_STARTED": {"Under Construction", "Operational"},
    "OPERATIONAL": {"Operational"},
    "REFUSED": {"Application Refused", "Appeal Refused", "Appeal Lodged", "Revised"},
    "NEW_APPLICATION": {"Application Submitted", "Appeal Lodged"},
}
CONTRADICTING_STATUS = {
    "CONSENTED": {"Application Refused", "Appeal Refused", "Application Withdrawn", "Appeal Withdrawn"},
    "OPERATIONAL": {"Application Submitted", "Application Refused", "Application Withdrawn"},
    "REFUSED": {"Operational", "Under Construction"},
}

OFFICIAL_HOST_SUFFIXES = (".gov.uk", ".gov.scot", ".gov.wales", ".nidirect.gov.uk")
OFFICIAL_HOSTS = {"gov.uk", "www.gov.uk", "gov.scot", "www.gov.scot", "gov.wales", "www.gov.wales"}


def profile_sha256(profile: dict = DEFAULT_PROFILE) -> str:
    return hashlib.sha256(json.dumps(profile, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def max_possible(profile: dict = DEFAULT_PROFILE, article: bool = False) -> float:
    p = profile
    total = (p["capacity"]["cap"] + max(p["stage"].values()) + max(p["technology"].values())
             + p["recency_days"][0][1] + p["national_route"]["points"] + p["datacentre_km"][0][1]
             + p["novelty"]["new"] + max(p["evidence_tier"].values()) + p["colocated_storage"])
    if article:
        total += max(p["binding"].values()) + max(p["official_corroboration"].values())
    return total


def _c(name, points, maximum, basis, **extra):
    out = {"name": name, "points": round(float(points), 2), "max": maximum, "basis": basis}
    out.update(extra)
    return out


def capacity_component(mw, p=DEFAULT_PROFILE, label="capacity"):
    cap = p["capacity"]
    if mw is None:
        return _c("capacity", 0, cap["cap"], f"{label} unknown (blank in REPD): scored 0, not treated as 0 MW")
    pts = min(cap["cap"], cap["scale"] * math.log10(1 + abs(mw)))
    return _c("capacity", pts, cap["cap"], f"{label} {abs(mw):g} MW -> min({cap['cap']:g}, {cap['scale']:g}*log10(1+MW))")


def stage_component(etype, p=DEFAULT_PROFILE):
    pts = p["stage"].get(etype, 0)
    return _c("stage", pts, max(p["stage"].values()), f"event type {etype}")


def technology_component(tech, p=DEFAULT_PROFILE):
    t = p["technology"]
    if not tech:
        return _c("technology", t["_unknown"], max(t.values()), "technology not stated")
    pts = t.get(tech, t["_other"])
    return _c("technology", pts, max(t.values()), f"{tech} (profile {p['id']})")


def recency_component(event_date, reference: date, p=DEFAULT_PROFILE, source=None):
    top = p["recency_days"][0][1]
    if not event_date:
        return _c("recency", p["recency_undated"], top, "no dated milestone for this event")
    d = date.fromisoformat(event_date)
    age = (reference - d).days
    pts = 0
    for days, points in p["recency_days"]:
        if age <= days:
            pts = points
            break
    return _c("recency", pts, top, f"{source or 'date'} {event_date}, {age} days before reference {reference.isoformat()}",
              age_days=age)


def national_route_component(authority, p=DEFAULT_PROFILE):
    nr = p["national_route"]
    hit = (authority or "") in nr["authorities"]
    return _c("national_route", nr["points"] if hit else 0, nr["points"],
              f"planning authority '{authority}' is a national consenting route" if hit
              else f"planning authority '{authority or 'not stated'}' is local or not stated")


def datacentre_component(ctx, p=DEFAULT_PROFILE):
    top = p["datacentre_km"][0][1]
    if ctx is None:
        return _c("datacentre_proximity", 0, top, "no convergence row for this Ref ID (join not supplied, "
                  "technology outside solar/battery/wind, or no usable coordinates)")
    near = ctx.get("nearest")
    if not near or near.get("km") is None:
        return _c("datacentre_proximity", 0, top, "no data centre with a usable point")
    if not near.get("proximity_reliable", True):
        return _c("datacentre_proximity", 0, top, f"nearest data centre {near['id']} point precision "
                  f"'{near.get('precision')}' is not proximity-reliable")
    km = near["km"]
    pts = 0
    for limit, points in p["datacentre_km"]:
        if km <= limit:
            pts = points
            break
    return _c("datacentre_proximity", pts, top,
              f"nearest data centre {near['id']} ({near.get('status')}) {km:g} km straight line; "
              "screening only, not a connection")


def novelty_component(ref, etype, previous, p=DEFAULT_PROFILE, event_id=None, sibling_refs=()):
    """Ref ID and its co-located siblings (same development group, same event) are checked together."""
    nv = p["novelty"]
    if previous is None:
        return _c("novelty", nv["new"], nv["new"], "no previous feed supplied")
    if event_id and event_id in previous["event_ids"]:
        return _c("novelty", nv["repeat"], nv["new"], f"event already in previous feed {previous['file']}")
    covered = set()
    for r in (ref, *sibling_refs):
        covered |= previous["refs"].get(r, set())
    if covered and ref not in previous["refs"]:
        ref = next(r for r in sibling_refs if r in previous["refs"])
    if not covered:
        return _c("novelty", nv["new"], nv["new"], f"Ref ID not covered in previous feed {previous['file']}")
    if etype in covered:
        return _c("novelty", nv["repeat"], nv["new"], f"{etype} already reported for this Ref ID in {previous['file']}",
                  previous_articles=sorted(previous["articles"].get(ref, []))[:10])
    return _c("novelty", nv["other_event"], nv["new"],
              f"Ref ID covered in {previous['file']} for {', '.join(sorted(covered))}",
              previous_articles=sorted(previous["articles"].get(ref, []))[:10])


def evidence_component(tier, p=DEFAULT_PROFILE, basis=None):
    et = p["evidence_tier"]
    return _c("evidence_tier", et[tier], max(et.values()), basis or tier, tier=tier)


def colocated_component(coloc_ref, p=DEFAULT_PROFILE):
    pts = p["colocated_storage"] if coloc_ref else 0
    return _c("colocated_storage", pts, p["colocated_storage"],
              f"REPD storage co-location ref {coloc_ref}" if coloc_ref else "no storage co-location ref")


def _total(components, article=False, p=DEFAULT_PROFILE):
    return {"score": round(sum(c["points"] for c in components), 2),
            "max_possible": max_possible(p, article), "profile": p["id"], "components": components}


# --------------------------------------------------------------------------- events

def score_event(ev: dict, reference: date, dc_index=None, previous=None, p=DEFAULT_PROFILE) -> dict:
    mw = ev["capacity_mw"]
    label = "capacity"
    if ev["event_type"] == "CAPACITY_CHANGE":
        ch = ev["change"]
        mw = ch["delta_mw"] if ch["delta_mw"] is not None else (ch["new_mw"] if ch["new_mw"] is not None else ch["old_mw"])
        label = "capacity change |delta|" if ch["delta_mw"] is not None else "capacity stated/blanked"
    ctx = dc_index.get(ev["ref"]) if dc_index is not None else None
    comps = [
        capacity_component(mw, p, label),
        stage_component(ev["event_type"], p),
        technology_component(ev["technology"], p),
        recency_component(ev["event_date"], reference, p, ev.get("event_date_source")),
        national_route_component(ev["planning_authority"], p),
        datacentre_component(ctx, p) if dc_index is not None else
        _c("datacentre_proximity", 0, p["datacentre_km"][0][1], "convergence join not supplied"),
        novelty_component(ev["ref"], ev["event_type"], previous, p, ev["event_id"],
                          ev.get("sibling_refs_same_event", ())),
        evidence_component("official_record", p, "DESNZ Renewable Energy Planning Database record (official)"),
        colocated_component(ev.get("storage_colocation_ref"), p),
    ]
    return _total(comps, False, p)


def rank_events(events: list, reference: date, dc_index=None, previous=None, p=DEFAULT_PROFILE) -> list:
    """Attach relevance and datacentre context to every event; return them ranked.
    Order: score desc, capacity desc (unknown last), Ref ID, event type - fully deterministic."""
    out = []
    for ev in events:
        ev = dict(ev)
        ev["relevance"] = score_event(ev, reference, dc_index, previous, p)
        if dc_index is not None and ev["ref"] in dc_index:
            ev["datacentre_context"] = dc_index[ev["ref"]]
        out.append(ev)
    out.sort(key=lambda e: (-e["relevance"]["score"],
                            -(e["capacity_mw"] if e["capacity_mw"] is not None else -1),
                            int(e["ref"]) if e["ref"].isdigit() else 10**9, e["ref"], e["event_type"]))
    for i, ev in enumerate(out, 1):
        ev["rank"] = i
    return out


def top_events(ranked: list, n: int = 50) -> list:
    """Top n after folding co-located siblings: one entry per (development group, event type),
    the highest-ranked Ref ID leading and the others listed in grouped_refs."""
    seen, out = {}, []
    for ev in ranked:
        key = (ev["group_key"], ev["event_type"])
        if key in seen:
            seen[key]["grouped_refs"].append(ev["ref"])
            continue
        if len(out) >= n:
            continue  # keep scanning only to attach siblings of groups already listed
        entry = {"rank": len(out) + 1, "event_id": ev["event_id"], "grouped_refs": []}
        seen[key] = entry
        out.append(entry)
    return out


# --------------------------------------------------------------------------- articles

def classify_article_event(text: str) -> str:
    t = names.padded(text)
    for label, needles in ARTICLE_EVENTS:
        if any(names.contains_phrase(t, names.norm(n)) for n in needles):
            return label
    return "PROJECT_UPDATE"


def evidence_tier_of(source: str, source_url: str) -> tuple[str, str]:
    """official_record / attributed_reporting / unverified_lead from the publisher, never the text."""
    try:
        host = (urlparse(names.clean(source_url)).hostname or "").lower()
    except ValueError:
        host = ""
    src = names.norm(source)
    if host in OFFICIAL_HOSTS or host.endswith(OFFICIAL_HOST_SUFFIXES) or src in {"gov uk", "planning inspectorate", "desnz"}:
        return "official_record", f"official publisher {host or source}"
    if src and host and "news.google." not in host:
        return "attributed_reporting", f"named publisher {source} ({host})"
    return "unverified_lead", "publisher not traceable to a named source URL"


def corroboration(article_event: str, project: dict | None, release_events_by_ref: dict | None, p=DEFAULT_PROFILE):
    oc = p["official_corroboration"]
    top = max(oc.values())
    if not project:
        return _c("official_corroboration", 0, top, "no bound REPD project"), None
    ref, status = project["ref"], project.get("status")
    if release_events_by_ref and article_event in release_events_by_ref.get(ref, set()):
        return _c("official_corroboration", oc["same_event_in_release"], top,
                  f"REPD release diff records {article_event} for Ref {ref}"), None
    contradiction = None
    if status in CONTRADICTING_STATUS.get(article_event, set()):
        contradiction = f"story reads {article_event}; REPD status of Ref {ref} is {status}"
    if status in CONSISTENT_STATUS.get(article_event, set()):
        return _c("official_corroboration", oc["status_consistent"], top,
                  f"REPD status {status} is consistent with {article_event}"), contradiction
    return _c("official_corroboration", 0, top, f"REPD status {status or 'unknown'} neither confirms nor "
              f"contradicts {article_event}" if not contradiction else contradiction), contradiction


def score_article(article: dict, binding: dict, project: dict | None, reference: date, dc_index=None,
                  previous=None, release_events_by_ref=None, p=DEFAULT_PROFILE) -> dict:
    text = " ".join(filter(None, [article.get("headline"), article.get("description")]))
    etype = classify_article_event(text)
    tier, tier_basis = evidence_tier_of(article.get("source", ""), article.get("source_url", ""))
    cls = binding["class"]
    comps = [
        capacity_component(project.get("capacity_mw") if project else None, p,
                           "bound project capacity" if project else "no bound project; capacity"),
        stage_component(etype, p),
        technology_component(project.get("technology") if project else None, p),
        recency_component(article.get("published"), reference, p, "published"),
        national_route_component(project.get("planning_authority") if project else None, p),
        datacentre_component(dc_index.get(project["ref"]) if (dc_index is not None and project) else None, p)
        if dc_index is not None else _c("datacentre_proximity", 0, p["datacentre_km"][0][1], "convergence join not supplied"),
        novelty_component(project["ref"] if project else None, etype, previous, p) if project else
        _c("novelty", 0, p["novelty"]["new"], "no bound project; novelty not assessed"),
        evidence_component(tier, p, tier_basis),
        colocated_component(project.get("storage_colocation_ref") if project else None, p),
        _c("binding", p["binding"][cls], max(p["binding"].values()), f"binding class {cls}"),
    ]
    corr, contradiction = corroboration(etype, project, release_events_by_ref, p)
    comps.append(corr)
    out = _total(comps, True, p)
    out["article_event"] = etype
    out["evidence_tier"] = tier
    out["contradiction"] = contradiction
    return out


# --------------------------------------------------------------------------- inputs

def sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_previous_feed(path) -> dict:
    """Index of what an earlier feed already reported, by Ref ID.

    Accepts the legacy Pipeline News feed (dist/major_project_news_v9_5_1.json: canonical_items
    with repd_ref and a v6 event label; only PRIMARY_MATCH items count) or a feed written by
    automation/news (events with ref, event_type, event_id)."""
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    refs, articles, event_ids = {}, {}, set()
    if isinstance(doc.get("events"), list):
        for ev in doc["events"]:
            refs.setdefault(ev["ref"], set()).add(ev["event_type"])
            event_ids.add(ev["event_id"])
    items = doc.get("canonical_items") or doc.get("items") or []
    for it in items:
        ref = str(it.get("repd_ref") or it.get("primary_repd_ref") or "").strip()
        if not ref or it.get("role", "PRIMARY_MATCH") != "PRIMARY_MATCH":
            continue
        label = LEGACY_EVENT_LABELS.get(str(it.get("event", "")).upper(), "PROJECT_UPDATE")
        refs.setdefault(ref, set()).add(label)
        if it.get("gg_article_id"):
            articles.setdefault(ref, []).append(it["gg_article_id"])
    return {"file": Path(path).name, "sha256": sha256_file(path), "refs": refs,
            "articles": articles, "event_ids": event_ids}


def load_datacentre_index(convergence_dir) -> dict | None:
    """Ref ID -> data-centre context, from Team 6's dist/convergence/<release>/ outputs:
    repd_datacentre_proximity_{solar,battery,wind}.json (columnar) and datacentre_proximity.json
    (per data centre: precision, proximity_reliable). Returns None when the folder is absent."""
    d = Path(convergence_dir) if convergence_dir else None
    if d is None or not d.is_dir():
        return None
    dcs = {}
    dcp = d / "datacentre_proximity.json"
    if dcp.exists():
        for rec in json.loads(dcp.read_text(encoding="utf-8"))["records"]:
            dcs[rec["id"]] = {"precision": rec.get("precision"),
                              "proximity_reliable": bool(rec.get("proximity_reliable", False))}
    index = {}
    for tech in ("solar", "battery", "wind"):
        f = d / f"repd_datacentre_proximity_{tech}.json"
        if not f.exists():
            continue
        doc = json.loads(f.read_text(encoding="utf-8"))
        cols = doc["columns"]
        pos = {c: i for i, c in enumerate(cols)}
        for row in doc["rows"]:
            g = lambda c: row[pos[c]] if c in pos else None  # noqa: E731
            ref = str(g("ref"))
            near = None
            if g("dc1_id"):
                meta = dcs.get(g("dc1_id"), {})
                near = {"id": g("dc1_id"), "name": g("dc1_name"), "status": g("dc1_status"), "km": g("dc1_km"),
                        "precision": meta.get("precision"),
                        "proximity_reliable": meta.get("proximity_reliable", True) if dcs else True}
            index[ref] = {
                "nearest": near,
                "datacentres_within_km": {str(r): g(f"r{r}km_datacentres") for r in (5, 10, 25, 50)},
                "it_load_mw_stated_within_25km": g("r25km_it_load_mw_stated"),
                "nearest_transmission_node": g("nearest_node_site_code"),
                "nearest_transmission_node_km": g("nearest_node_km"),
                "duplicate_of": g("duplicate_of"),
                "basis": "straight-line screening from dist/convergence (REPD x data-centre join); "
                         "not a grid connection, capacity or offtake",
            }
    return index


def convergence_inputs(convergence_dir) -> list:
    d = Path(convergence_dir) if convergence_dir else None
    if d is None or not d.is_dir():
        return []
    out = []
    for name in ("manifest.json", "datacentre_proximity.json", "repd_datacentre_proximity_solar.json",
                 "repd_datacentre_proximity_battery.json", "repd_datacentre_proximity_wind.json"):
        f = d / name
        if f.exists():
            out.append({"file": f"dist/convergence/{d.name}/{name}", "sha256": sha256_file(f), "bytes": f.stat().st_size})
    return out
