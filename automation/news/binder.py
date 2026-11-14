#!/usr/bin/env python3
"""automation/news/binder.py - bind a news article to a REPD project (and, separately, to a
data-centre site) with an explicit confidence class and a full evidence trail.

    python -m automation.news.binder --repd repd-2026q3.csv --labels LABELS.json --out EVAL.json \
        [--datacentres uk_datacentre_pipeline_202610312133.geojson]

Classes (only EXACT and STRONG may drive a project's news signal; the rest are context):

  EXACT      a planning application reference from REPD appears in the text; or one development
             matched by its distinctive name AND corroborated by stated capacity (within
             max(2 MW, 15%)), operator or county / planning authority
  STRONG     one development matched by its distinctive name (a one-word name only when it
             sits beside a technology word, e.g. 'Hessay Solar'); or several matched and
             narrowed to one by capacity, location or operator corroboration
  PROBABLE   narrowed to one only by status preference (live over revised/expired, refused for
             a refusal story), or matched only by a place segment of the REPD name
  CANDIDATE  name matched but still ambiguous, foreign location named without UK context, or
             the story's technology contradicts the project's
  UNBOUND    no REPD name matched

Name matching uses automation/news/names.py (shared with events and relevance). A name that
is wholly inside a longer matched name is ignored ('Coalburn' inside 'Coalburn II'). Co-located
REPD siblings (same development group) count as one development; the primary row is chosen by
the story's technology words, else solar > wind > battery > other, then capacity, then Ref ID.

Data centres are a distinct category: an article mentioning data-centre wording is tagged
topic DATA_CENTRES, and a named site from the GridAtlas data-centre register is bound by its
dcuk id, never by an invented REPD Ref ID.

Standard library only. No network.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from automation.repd import diff as repd
from automation.news import names
from automation.news.events import development_groups
from automation.news.relevance import classify_article_event

SCHEMA_EVAL = "globalgrid2050.news-binder-evaluation.v1"
SIGNAL_CLASSES = ("EXACT", "STRONG")
CLASS_ORDER = ("EXACT", "STRONG", "PROBABLE", "CANDIDATE", "UNBOUND")

LIVE = {"Application Submitted", "Appeal Lodged", "Awaiting Construction", "Under Construction",
        "Operational", "No Application Required"}
REFUSAL_STATUSES = {"Application Refused", "Appeal Refused", "Appeal Lodged"}
FAMILY_ORDER = {"solar": 0, "wind": 1, "battery": 2, "other": 3}

# Foreign places (restated from scripts/major_project_news_v6.py FOREIGN_RULES, plus Republic of
# Ireland counties that do not double as UK place names). Bare "ireland" is not foreign:
# Northern Ireland is UK.
FOREIGN = (
    "new jersey", "california", "texas", "australia", "new south wales", "queensland", "canada",
    "alberta", "ontario", "germany", "german", "italy", "spain", "india", "china", "chinese",
    "south africa", "new zealand", "republic of ireland", "irish republic", "united states",
    "us roundup", "new york", "arizona", "nevada", "florida", "ohio", "virginia", "massachusetts",
    "pennsylvania", "colorado", "illinois", "chile", "japan", "greece", "romania", "uzbek",
    "uzbekistan", "france", "sweden", "netherlands", "poland", "county kerry", "kerry", "meath",
    "wexford", "wicklow", "kildare", "offaly", "laois", "westmeath", "tipperary", "kilkenny",
    "donegal", "galway", "co cork", "county cork", "co clare", "county clare", "nem", "eu roundup",
)
UK_CONTEXT = ("uk", "u k", "britain", "british", "england", "english", "scotland", "scottish", "wales",
              "welsh", "northern ireland", "gb")
DC_CONTEXT = ("data centre", "data centres", "data center", "data centers", "datacentre", "datacentres",
              "datacenter", "ai growth zone", "supercomputer", "hyperscale", "colocation campus")
DC_BOILERPLATE = frozenset({"data", "centre", "centres", "center", "centers", "datacentre", "datacentres",
                            "campus", "dc", "uk", "the", "ltd", "limited", "plc", "and", "of", "site"})

_MW_RE = re.compile(r"\b(\d{1,2}(?:,\d{3})+|\d{1,5}(?:\.\d+)?)\s*(gw|mw)(?:p|e|ac|dc)?\b", re.I)


def news_capacities(text: str) -> list[float]:
    """MW figures stated in a text ('49.9MWp', '1,000 MW', '1.2GW'). MWh and GWh are energy, not power,
    and are ignored."""
    out = []
    for num, unit in _MW_RE.findall(text):
        try:
            v = float(num.replace(",", ""))
        except ValueError:
            continue
        v = v * 1000 if unit.lower() == "gw" else v
        if v not in out:
            out.append(v)
    return out


def capacity_corroborates(project_mw, stated: list[float]) -> bool:
    return project_mw is not None and any(abs(v - project_mw) <= max(2.0, 0.15 * project_mw) for v in stated)


class ProjectIndex:
    """Distinctive-name index over every REPD record of one release."""

    def __init__(self, snapshot: dict):
        self.records = {}
        self.by_first = {}
        groups = development_groups(snapshot)
        self.planning_refs = {}
        for ref, rec in snapshot["by_ref"].items():
            t = lambda c: repd.collapse(rec.get(c, ""))  # noqa: E731
            r = {
                "ref": ref, "site_name": names.site_display(t(repd.SITE)), "technology": t(repd.TECH) or None,
                "family": names.tech_family(t(repd.TECH)), "capacity_mw": repd.r3(repd.cap_of(rec)),
                "status": t(repd.STATUS) or None, "operator": t(repd.OPER) or None,
                "county": t(repd.COUNTY) or None, "region": t(repd.REGION) or None,
                "country": t(repd.COUNTRY) or None, "planning_authority": t("Planning Authority") or None,
                "planning_application_reference": t("Planning Application Reference") or None,
                "storage_colocation_ref": t("Storage Co-location REPD Ref ID") or None,
                "group": groups.get(ref, f"DEV-{ref}"),
            }
            r["aliases"] = names.name_aliases(r["site_name"])
            r["full_name"] = names.norm(r["site_name"])
            r["operator_tokens"] = names.operator_tokens(r["operator"])
            r["location_phrases"] = sorted({names.norm(x) for x in (r["county"], r["planning_authority"])
                                            if x and len(names.norm(x)) >= 4} - {"offshore"})
            self.records[ref] = r
            for kind in ("primary", "trailing"):
                stem = r["aliases"][kind]
                if stem:
                    self.by_first.setdefault(stem.split()[0], []).append((stem, ref, kind))
            for stem in r["aliases"]["places"]:
                self.by_first.setdefault(stem.split()[0], []).append((stem, ref, "place"))
            pref = names.norm(r["planning_application_reference"])
            if len(pref.replace(" ", "")) >= 7 and any(ch.isdigit() for ch in pref) and any(ch.isalpha() for ch in pref):
                self.planning_refs.setdefault(pref, set()).add(ref)

    def name_hits(self, pt: str) -> list[dict]:
        hits = {}
        for tok in set(pt.split()):
            for stem, ref, kind in self.by_first.get(tok, ()):
                if not names.contains_phrase(pt, stem):
                    continue
                if " " not in stem and not names.descriptor_adjacent(pt, stem) and \
                        not names.contains_phrase(pt, self.records[ref]["full_name"]):
                    continue
                key = (ref, stem)
                if key not in hits or kind == "primary":
                    hits[key] = {"ref": ref, "stem": stem, "kind": kind, "spans": names.phrase_spans(pt, stem)}
        # drop a name wholly inside a longer matched name of another record
        out = []
        allh = list(hits.values())
        for h in allh:
            inside = all(any(o["stem"] != h["stem"] and len(o["stem"]) > len(h["stem"]) and
                             os <= s and e <= oe for o in allh for os, oe in o["spans"])
                         for s, e in h["spans"])
            if not inside:
                out.append(h)
        return out


def _foreign(pt: str, source: str) -> list[str]:
    ps = names.padded(source)
    return sorted({f for f in FOREIGN if names.contains_phrase(pt, f) or names.contains_phrase(ps, f)})


def bind(article: dict, index: ProjectIndex) -> dict:
    text = " ".join(filter(None, [article.get("headline"), article.get("description")]))
    pt = names.padded(text)
    trace = []
    stated = news_capacities(text)
    ctx = names.tech_context(pt)
    event = classify_article_event(text)
    foreign = _foreign(pt, article.get("source", ""))
    result = {"class": "UNBOUND", "ref": None, "gg_project_id": None, "related_refs": [], "candidates": [],
              "evidence": {"stated_mw": stated, "technology_words": sorted(ctx), "foreign_places": foreign,
                           "article_event": event}, "trace": trace}

    # 1. planning application reference
    pref_hits = sorted({ref for pref, refs in index.planning_refs.items() if names.contains_phrase(pt, pref) for ref in refs},
                       key=repd.ref_key)
    hits = index.name_hits(pt)
    if pref_hits:
        trace.append(f"planning reference hit: {pref_hits}")
    if not hits and not pref_hits:
        trace.append("no REPD distinctive name in text")
        return result
    cands = {}
    for h in hits:
        cands.setdefault(h["ref"], []).append(h)
    for ref in pref_hits:
        cands.setdefault(ref, []).append({"ref": ref, "stem": None, "kind": "planning_reference", "spans": []})
    recs = {ref: index.records[ref] for ref in cands}
    trace.append(f"name hits: {sorted({(h['stem'], h['kind']) for h in hits})} -> {len(recs)} records")

    def devs(rs):
        return sorted({r["group"] for r in rs.values()})

    initial_devs = devs(recs)
    resolved_by = []
    if len(pref_hits) == 1 and len(devs({r: recs[r] for r in pref_hits})) == 1:
        recs = {pref_hits[0]: recs[pref_hits[0]]}
        resolved_by.append("planning_reference")

    def narrow(label, keep):
        nonlocal recs
        kept = {r: v for r, v in recs.items() if keep(v)}
        if kept and len(kept) < len(recs):
            trace.append(f"{label}: {len(recs)} -> {len(kept)} records")
            if len(devs(kept)) < len(devs(recs)):
                resolved_by.append(label)
            recs = kept

    strong_kinds = ("primary", "trailing", "planning_reference")
    narrow("name_kind", lambda v: any(h["kind"] in strong_kinds for h in cands[v["ref"]]))
    if ctx:
        narrow("technology", lambda v: v["family"] in ctx)
    cap_ok = {r for r, v in recs.items() if capacity_corroborates(v["capacity_mw"], stated)}
    narrow("capacity", lambda v: v["ref"] in cap_ok)
    loc_ok = {r for r, v in recs.items() if any(names.contains_phrase(pt, ph) for ph in v["location_phrases"])}
    narrow("location", lambda v: v["ref"] in loc_ok)
    # operator words that are also part of the site name prove nothing ('Eccles Grid Stability Ltd')
    op_ok = {r for r, v in recs.items() if (v["operator_tokens"] - set(v["full_name"].split())) & set(pt.split())}
    narrow("operator", lambda v: v["ref"] in op_ok)
    before_status = len(devs(recs))
    if event == "REFUSED":
        narrow("status_preference", lambda v: v["status"] in REFUSAL_STATUSES)
    elif event == "NEW_APPLICATION":
        narrow("status_preference", lambda v: v["status"] in ("Application Submitted", "Appeal Lodged"))
    else:
        narrow("status_preference", lambda v: v["status"] in LIVE)
    status_resolved = before_status > 1 and len(devs(recs)) == 1

    remaining = devs(recs)
    result["candidates"] = [{"ref": r, "site_name": v["site_name"], "technology": v["technology"],
                             "capacity_mw": v["capacity_mw"], "status": v["status"], "county": v["county"]}
                            for r, v in sorted(recs.items(), key=lambda kv: repd.ref_key(kv[0]))][:12]
    if len(remaining) > 1:
        result["class"] = "CANDIDATE"
        trace.append(f"ambiguous: {len(remaining)} developments remain")
        return result

    # one development: choose its primary row
    def primary_key(v):
        fam_pref = 0 if (len(ctx) == 1 and v["family"] in ctx) else 1
        return (fam_pref, FAMILY_ORDER.get(v["family"], 9),
                -(v["capacity_mw"] if v["capacity_mw"] is not None else -1), repd.ref_key(v["ref"]))
    chosen = sorted(recs.values(), key=primary_key)[0]
    result["ref"] = chosen["ref"]
    result["gg_project_id"] = f"GG2050-REPD-{chosen['ref']}"
    result["related_refs"] = sorted((r for r in recs if r != chosen["ref"]), key=repd.ref_key)
    kinds = {h["kind"] for h in cands[chosen["ref"]]}
    stem = next((h["stem"] for h in cands[chosen["ref"]] if h["stem"]), None)
    corroborated = [k for k, ok in (("capacity", chosen["ref"] in cap_ok), ("location", chosen["ref"] in loc_ok),
                                    ("operator", chosen["ref"] in op_ok)) if ok]
    result["evidence"].update({"matched_name": stem, "name_kinds": sorted(kinds), "corroborated_by": corroborated,
                               "resolved_by": resolved_by, "initial_developments": len(initial_devs)})

    uk_context = any(names.contains_phrase(pt, u) for u in UK_CONTEXT) or \
        any(names.contains_phrase(pt, ph) for ph in chosen["location_phrases"])
    if foreign and not uk_context:
        result["class"] = "CANDIDATE"
        trace.append(f"foreign place named without UK context: {foreign}")
    elif ctx and chosen["family"] not in ctx and chosen["family"] != "other":
        result["class"] = "CANDIDATE"
        trace.append(f"technology words {sorted(ctx)} contradict project family {chosen['family']}")
    elif "planning_reference" in kinds:
        result["class"] = "EXACT"
    elif not kinds & {"primary", "trailing"}:
        result["class"] = "PROBABLE" if corroborated else "CANDIDATE"
        trace.append("matched by a place segment only")
    elif len(initial_devs) == 1:
        result["class"] = "EXACT" if corroborated and stem and " " in stem else "STRONG"
    elif status_resolved and not ({"capacity", "location", "operator", "technology"} & set(resolved_by)):
        result["class"] = "PROBABLE"
    else:
        result["class"] = "STRONG"
    trace.append(f"class {result['class']}")
    return result


# --------------------------------------------------------------------------- data centres

class DatacentreIndex:
    def __init__(self, geojson_path):
        doc = json.loads(Path(geojson_path).read_text(encoding="utf-8"))
        self.sites, self.by_first = {}, {}
        for f in doc["features"]:
            p = f.get("properties") or {}
            name = names.clean(p.get("name"))
            if not name or names.norm(name).startswith("unnamed"):
                continue
            stems = set()
            for n in [name, *(p.get("aliases") or [])]:
                toks = names.norm(n).split()
                while toks and toks[0] in DC_BOILERPLATE:
                    toks.pop(0)
                while toks and toks[-1] in DC_BOILERPLATE:
                    toks.pop()
                stem = " ".join(toks)
                if stem and (len(toks) >= 2 or (len(stem) >= 6 and stem not in names.GENERIC_SINGLE)):
                    stems.add(stem)
            if not stems:
                continue
            sid = p.get("id")
            self.sites[sid] = {"id": sid, "name": name, "status": p.get("status"),
                               "precision": (p.get("location") or {}).get("precision"), "stems": sorted(stems)}
            for s in stems:
                self.by_first.setdefault(s.split()[0], []).append((s, sid))

    def bind(self, article: dict) -> dict:
        text = " ".join(filter(None, [article.get("headline"), article.get("description")]))
        pt = names.padded(text)
        topic = any(names.contains_phrase(pt, w) for w in DC_CONTEXT)
        out = {"topic_datacentres": topic, "bindings": []}
        if not topic:
            return out  # a site name alone (often a place: 'Hertfordshire') is not a data-centre story
        hits = sorted({sid for tok in set(pt.split()) for s, sid in self.by_first.get(tok, ())
                       if names.contains_phrase(pt, s) and (" " in s or names.descriptor_adjacent(pt, s))})
        for sid in hits:
            site = self.sites[sid]
            cls = "STRONG" if topic and len(hits) == 1 else "CANDIDATE"
            out["bindings"].append({"entity_type": "DATA_CENTRE", "id": sid, "name": site["name"],
                                    "status": site["status"], "class": cls})
        return out


# --------------------------------------------------------------------------- evaluation

def evaluate(labels: list, index: ProjectIndex) -> dict:
    """Score bind() against a labelled set. gold_ref null = should bind to no project;
    label 'unsure' rows are reported but excluded from the metrics."""
    rows, per_class = [], {c: {"n": 0, "correct": 0, "wrong_ref": 0, "false_positive": 0} for c in CLASS_ORDER}
    sig = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    anyc = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    base = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}

    def tally(t, predicted, gold):
        if predicted and gold and predicted == gold:
            t["tp"] += 1
        elif predicted:
            t["fp"] += 1
            if gold:
                t["fn"] += 1
        elif gold:
            t["fn"] += 1
        else:
            t["tn"] += 1

    for lab in labels:
        b = bind({"headline": lab["headline"], "source": lab.get("source", ""), "description": lab.get("description")}, index)
        row = {"id": lab["id"], "headline": lab["headline"], "gold_ref": lab["gold_ref"], "label": lab["label"],
               "class": b["class"], "ref": b["ref"], "baseline_ref": lab.get("baseline_ref"), "trace": b["trace"]}
        rows.append(row)
        if lab["label"] in ("unsure", "implicit"):
            continue
        gold = lab["gold_ref"]
        pc = per_class[b["class"]]
        pc["n"] += 1
        if b["ref"]:
            if b["ref"] == gold:
                pc["correct"] += 1
            elif gold:
                pc["wrong_ref"] += 1
            else:
                pc["false_positive"] += 1
        tally(sig, b["ref"] if b["class"] in SIGNAL_CLASSES else None, gold)
        tally(anyc, b["ref"] if b["class"] != "UNBOUND" else None, gold)
        tally(base, lab.get("baseline_ref"), gold)

    def metrics(t):
        p = t["tp"] / (t["tp"] + t["fp"]) if t["tp"] + t["fp"] else None
        r = t["tp"] / (t["tp"] + t["fn"]) if t["tp"] + t["fn"] else None
        return {**t, "precision": round(p, 4) if p is not None else None, "recall": round(r, 4) if r is not None else None}

    scored = [r for r in rows if r["label"] not in ("unsure", "implicit")]
    errors = [r for r in scored if (r["class"] in SIGNAL_CLASSES and r["ref"] != r["gold_ref"]) or
              (r["gold_ref"] and r["ref"] != r["gold_ref"])]
    return {
        "schema": SCHEMA_EVAL,
        "n_labels": len(labels), "n_scored": len(scored),
        "n_unsure": sum(1 for r in rows if r["label"] == "unsure"),
        "n_implicit": sum(1 for r in rows if r["label"] == "implicit"),
        "n_positive": sum(1 for r in scored if r["gold_ref"]), "n_negative": sum(1 for r in scored if not r["gold_ref"]),
        "signal_classes": list(SIGNAL_CLASSES),
        "signal_metrics": metrics(sig),
        "any_class_metrics": metrics(anyc),
        "baseline_v9_5_1_primary_match_metrics": metrics(base),
        "per_class": per_class,
        "errors": errors,
        "rows": rows,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repd", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    index = ProjectIndex(repd.load_csv(a.repd))
    labels = json.loads(Path(a.labels).read_text(encoding="utf-8"))["labels"]
    ev = evaluate(labels, index)
    Path(a.out).write_text(json.dumps(ev, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: ev[k] for k in ("signal_metrics", "any_class_metrics", "baseline_v9_5_1_primary_match_metrics")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
