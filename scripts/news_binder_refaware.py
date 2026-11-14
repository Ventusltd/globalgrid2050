#!/usr/bin/env python3
"""Ref-aware news-to-REPD binder (successor candidate to the V6 matcher).

This module is ADDITIVE. It does not modify scripts/major_project_news_v6.py,
whose bytes are pinned by the V9.5.1 gates (v9-5-1-validate.yml). It reuses that
module's normalisation, provenance scoring, foreign-location rules and score
components, and changes only the decisions listed below. Every change is
covered by scripts/test_news_binder_refaware.py and measured against the
labelled set tests/fixtures/news_binding_labels_2026q3.json.

Changes versus major_project_news_v6.evaluate_candidate / _resolve_story:

 C1 capacity extraction understands thousands separators ("1,900MW" was read as
    900 MW) and MWp; a stated capacity more than CAPACITY_CONTRADICTION_RATIO
    away from the official capacity on every stated value vetoes a name-only
    binding (planning-reference bindings are exempt).
 C2 stem token count uses the raw stem ("coalburn ii" has two tokens; the V6
    code dropped "ii" as a short token and then refused the stem), and a
    phase/version qualifier after the stem ("Coalburn II", "West Burton C")
    must agree: a project whose stem matches but which lacks a qualifier that
    another universe project carries is vetoed (qualifier_conflict).
 C3 a full exact (non-duplicate) project name is never downgraded because a
    different project shares its stem ("Carlton Solar Farm" vs "Carlton Farm").
 C4 a multi-token distinctive stem immediately followed by technology wording
    ("Monk Fryston BESS", "Green Hill Solar Farm") is identity evidence on its
    own, as single-token stems already were.
 C5 operator normalisation: the REPD "Operator (or Applicant)" field is split
    into parties on & / , and "and"; legal and generic suffixes are stripped
    (normalise_operator_parties). A party hit counts as operator evidence.
 C6 operator-corroborated route (no project name in the article): operator
    party in the headline + technology + capacity or location agreement +
    exactly one universe project satisfying that evidence + no portfolio
    wording + no capacity contradiction. Tagged binding_route
    OPERATOR_CORROBORATED with its own confidence floor.
 C7 stale-record rule: a record whose official status is terminal
    (refused / withdrawn / abandoned / expired / appeal refused) and whose
    Record Last Updated is more than STALE_RECORD_YEARS before the article can
    bind only on its full exact name; otherwise it is reported as
    stale_record_candidate, never PRIMARY_MATCH.
 C8 Ref-aware binding: an explicit "REPD 12345" / "REPD ref 12345" in the text
    binds that ref; planning references must be >= 6 characters and match on
    word boundaries; a winner whose official status is "Revised" and whose
    record names a CURRENT_VERSION ref in the universe is re-bound to that
    current record, the superseded ref being kept as context.
 C9 event vocabulary widened (operations, online, energises, green light,
    permit, says yes, recommended for approval, finance deal, appeal
    allowed/fails, ...); refusal still precedes consent.
 C10 county demonyms (Cornish, Welsh, Scottish, ...) count as location evidence.

The REPD status stays official and separate (NEWS_SIGNAL_V5.md): nothing here
writes a status. Status transitions from automation/repd/diff.py are surfaced
separately by repd_status_change_candidates() as REPD_STATUS_CHANGE entries
that are never eligible to drive a headline NEWS SIGNAL.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import major_project_news_v6 as base  # noqa: E402

BINDER_VERSION = "refaware-1"
CAPACITY_CONTRADICTION_RATIO = 5.0
STALE_RECORD_YEARS = 3
FLOOR_OPERATOR_ROUTE = 60
TERMINAL_STATUSES = {
    "application refused", "application withdrawn", "abandoned",
    "planning permission expired", "appeal refused", "appeal withdrawn",
}
QUALIFIERS = {"ii", "iii", "iv", "2", "3", "4", "b", "c", "d", "north", "south", "east", "west", "extension"}
PORTFOLIO_WORDS = {"portfolio", "portfolios", "pipeline", "projects", "assets", "fund", "sites", "cluster"}
OPERATOR_SUFFIXES = {
    "ltd", "limited", "plc", "llp", "llc", "uk", "gb", "group", "holdings", "holding", "co", "company",
    "investments", "investment", "developments", "development", "dev", "spv", "the", "renewables",
    "renewable", "energy", "power", "solar", "storage", "services", "management", "asset", "assets",
    "project", "projects", "partners", "capital", "international", "europe", "generation", "of", "and",
    "infrastructure", "e", "d", "s",
}
GENERIC_OPERATOR_CORES = {"green", "solar", "energy", "power", "grid", "low", "res", "uk", "new", "boom", "field"}
DEMONYMS = {
    "cornish": "cornwall", "welsh": "wales", "scottish": "scotland", "devonian": "devon",
    "yorkshire": "yorkshire", "northern irish": "northern ireland", "english": "england",
}
EVENTS_V2 = [
    ("REFUSAL", ["refused", "rejected", "refusal", "turned down", "dismissed", "appeal fails", "blocked",
                 "throws out", "thrown out"]),
    ("DELAY", ["delayed", "delay", "judicial review", "postponed", "deferred", "legal challenge", "setback",
               "high court"]),
    ("OPERATIONAL", ["commercial operation", "operational", "operations", "energised", "energized", "energises",
                     "commissioned", "goes live", "entered operation", "enters operation", "online",
                     "switched on", "begins generating", "completes construction"]),
    ("CONSTRUCTION", ["construction", "breaking ground", "build begins", "under construction",
                      "construction starts", "work starts", "work begins", "starts work", "epc"]),
    ("CONSENT", ["development consent", "consent awarded", "grants dco", "dco granted", "planning consent",
                 "approved", "approval", "approves", "consented", "permission granted", "planning permission",
                 "green light", "wins permit", "permit", "says yes", "recommended for approval",
                 "appeal allowed", "secures planning", "approved on appeal"]),
    ("FINANCIAL CLOSE", ["financial close", "financing", "funding secured", "debt financing", "finance deal",
                         "finances", "investment decision", "refinancing"]),
    ("ACQUISITION", ["acquires", "acquired", "acquisition", "sold to", "sale of", "portfolio sale", "buys",
                     "new owners", "ground lease"]),
    ("GRID CONNECTION", ["grid connection", "connected to the grid", "connection agreement", "grid offer"]),
    ("CONTRACT", ["to optimise", "to optimize", "partner on", "awarded contract", "secures contract",
                  "tolling agreement", "o and m", "cppa", "cppas", "ppa"]),
    ("PLANNING APPLICATION", ["submits planning application", "planning application", "plans revealed",
                              "plan for", "proposed", "consultation", "have say"]),
    ("EXPANSION", ["expansion", "expanded", "extension", "upsized"]),
]
REPD_REF_RE = re.compile(r"\brepd(?:\s+ref(?:erence)?)?(?:\s+id)?\s*[:#]?\s*(\d{1,6})\b", re.I)
CAPACITY_RE = re.compile(r"(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d{1,5})(\.\d+)?\s*mw(?:p|ac|dc)?\b", re.I)


# ---------------------------------------------------------------------------
# Normalisation shared with REPD cleaning (operator / site name)
# ---------------------------------------------------------------------------
def normalise_operator_parties(value: str) -> list[str]:
    """Split an REPD operator/applicant string into normalised party cores.

    "Fidra Energy & Drax" -> ["fidra", "drax"]; "JBM Solar & RWE" -> ["jbm", "rwe"];
    "Innagreen Investments & RES" -> ["innagreen", "res"]; "Lightsource BP" -> ["lightsource bp"].
    The same function lets automation/repd/diff.py tell a cosmetic operator edit
    ("/" -> "&", "Ltd" -> "Limited") from a change of party.
    """
    text = base.clean(value)
    if not text:
        return []
    text = re.sub(r"\([^)]*\)", " ", text)
    parts = re.split(r"\s*(?:&|/|,|;|\+|\band\b)\s*", text, flags=re.I)
    cores: list[str] = []
    for part in parts:
        tokens = base.norm(part).split()
        while tokens and tokens[-1] in OPERATOR_SUFFIXES:
            tokens.pop()
        while tokens and tokens[0] in {"the"}:
            tokens.pop(0)
        core = " ".join(tokens)
        if core and core not in cores:
            cores.append(core)
    return cores


def operator_party_key(value: str) -> tuple[str, ...]:
    return tuple(sorted(normalise_operator_parties(value)))


def raw_stem_tokens(stem: str) -> list[str]:
    return [token for token in stem.split() if token]


def stem_qualifier(name: str, stem: str) -> str:
    """Return the qualifier written straight after the stem in the official name, if any."""
    if not stem:
        return ""
    head = base.SEGMENT_SPLIT_RE.split(base.clean(name), maxsplit=1)[0]
    tokens = base.norm(head).split()
    stem_tokens = stem.split()
    for index in range(len(tokens) - len(stem_tokens) + 1):
        if tokens[index:index + len(stem_tokens)] == stem_tokens:
            after = index + len(stem_tokens)
            if after < len(tokens) and tokens[after] in QUALIFIERS:
                return tokens[after]
            return ""
    return ""


def extract_capacities(raw_text: str) -> list[float]:
    values: list[float] = []
    for whole, fraction in CAPACITY_RE.findall(raw_text or ""):
        try:
            value = float(whole.replace(",", "") + (fraction or ""))
        except ValueError:
            continue
        if value > 0 and value not in values:
            values.append(value)
    return values


def _word_in(text: str, phrase: str) -> bool:
    return bool(phrase) and f" {phrase} " in f" {text} "


def _parse_day(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Universe preparation
# ---------------------------------------------------------------------------
def prepare_projects(projects: list[dict], snapshot: dict | None = None) -> list[dict]:
    """Add the refaware fields to projects loaded by base.load_project_snapshot()."""
    raw_rows = {str(row.get("repd_ref")): row for row in (snapshot or {}).get("projects") or []}
    for project in projects:
        row = raw_rows.get(project["repd_ref"], {})
        stem = project["_name_stem_norm"]
        project["_stem_raw_tokens"] = raw_stem_tokens(stem)
        project["_stem_qualifier"] = stem_qualifier(project["name"], stem)
        project["_operator_parties"] = normalise_operator_parties(project["operator"])
        project["_lifecycle"] = row.get("lifecycle")
        project["_status_norm"] = base.norm(project["status"])
        project["_record_updated"] = _parse_day(project.get("repd_record_updated"))
        project["_current_version_refs"] = [
            str(rel.get("repd_ref")) for rel in row.get("relationships") or []
            if rel.get("type") == "CURRENT_VERSION" and rel.get("repd_ref")
        ]
        project["_planning_ref_ok"] = bool(
            len(project["_planning_ref_norm"].replace(" ", "")) >= 6
            and re.search(r"\d", project["_planning_ref_norm"])
        )
    qualified = Counter()
    for project in projects:
        if project["_stem_qualifier"]:
            qualified[(project["_name_stem_norm"], project["_stem_qualifier"])] += 1
        tokens = project["_stem_raw_tokens"]
        if len(tokens) >= 2 and tokens[-1] in QUALIFIERS - {"north", "south", "east", "west"}:
            # "coalburn ii" registers qualifier "ii" on the bare stem "coalburn"
            qualified[(" ".join(tokens[:-1]), tokens[-1])] += 1
    for project in projects:
        project["_qualifiers_on_stem"] = {
            qualifier for (stem, qualifier) in qualified if stem == project["_name_stem_norm"]
        }
    return projects


# ---------------------------------------------------------------------------
# Story context and events
# ---------------------------------------------------------------------------
def event_v2(text: str) -> str:
    normalized = f" {base.norm(text)} "
    for label, needles in EVENTS_V2:
        if any(f" {base.norm(needle)} " in normalized for needle in needles):
            return label
    return "PROJECT UPDATE"


def story_context(story: dict) -> dict:
    context = base._story_context(story)
    raw_text = " ".join((story.get("title", ""), story.get("description", "")))
    context["news_capacities_mw"] = extract_capacities(raw_text)
    location_text = context["text"]
    for demonym, place in DEMONYMS.items():
        if _word_in(location_text, demonym):
            location_text += " " + place
    context["location_text"] = location_text
    context["location_tokens"] = set(location_text.split())
    context["portfolio"] = bool(PORTFOLIO_WORDS & context["tokens"])
    context["explicit_repd_refs"] = REPD_REF_RE.findall(raw_text)
    context["event"] = event_v2(raw_text)
    padded = f" {context['text']} "
    context["new_scheme"] = any(f" {base.norm(phrase)} " in padded for phrase in NEW_SCHEME_PHRASES)
    return context


def _capacity_relation(project: dict, capacities: list[float]) -> str:
    if not capacities:
        return "none_stated"
    official = project["capacity_mw"]
    if any(abs(value - official) <= max(2.0, official * 0.15) for value in capacities):
        return "match"
    if all(value > official * CAPACITY_CONTRADICTION_RATIO or value < official / CAPACITY_CONTRADICTION_RATIO
           for value in capacities):
        return "contradiction"
    return "differs"


NEW_SCHEME_PHRASES = ("new solar farm", "new solar park", "new battery", "plans revealed", "plan for", "plans for",
                      "proposed", "planning application", "submits")


def _stale(project: dict, published: date | None, context: dict | None = None) -> bool:
    """C7: an old terminal record, or an old operational record for an article about a new scheme."""
    updated = project.get("_record_updated")
    if not updated or not published or (published - updated).days <= STALE_RECORD_YEARS * 365:
        return False
    if project["_status_norm"] in TERMINAL_STATUSES:
        return True
    return bool(context and context.get("new_scheme") and project["_status_norm"] == "operational")


# ---------------------------------------------------------------------------
# Candidate evaluation
# ---------------------------------------------------------------------------
def evaluate_candidate(project: dict, story: dict, context: dict) -> tuple[dict | None, str]:
    text, title_text, tokens = context["text"], context["title_text"], context["tokens"]
    location_text, location_tokens = context["location_text"], context["location_tokens"]
    stem = project["_name_stem_norm"]
    stem_tokens = project["_stem_raw_tokens"]
    single_stem = len(stem_tokens) == 1

    explicit_ref = project["repd_ref"] in context["explicit_repd_refs"]
    planning_ref_hit = bool(project["_planning_ref_ok"] and _word_in(text, project["_planning_ref_norm"]))
    name_exact = _word_in(text, project["_name_norm"])
    title_name_exact = _word_in(title_text, project["_name_norm"])
    raw_variant = _word_in(text, stem)
    raw_title_variant = _word_in(title_text, stem)
    padded_text, padded_title = f" {text} ", f" {title_text} "

    def adjacent(padded: str) -> bool:
        if single_stem:
            return base.descriptor_adjacent(padded, stem)
        return any(f" {stem} {descriptor} " in padded for descriptor in base.NEWS_TECHNOLOGY_DESCRIPTORS)

    variant = raw_variant and (not single_stem or adjacent(padded_text))
    title_variant = raw_title_variant and (not single_stem or adjacent(padded_title))
    multi_token_adjacent = (not single_stem) and bool(stem) and adjacent(padded_title or padded_text)

    # C2 qualifier agreement
    story_qualifier = ""
    if raw_variant:
        match = re.search(rf"(?:^| ){re.escape(stem)} (\S+)", text)
        if match and match.group(1) in QUALIFIERS:
            story_qualifier = match.group(1)
    if story_qualifier and project["_stem_qualifier"] != story_qualifier and story_qualifier in project["_qualifiers_on_stem"]:
        return None, "qualifier_conflict"
    if project["_stem_qualifier"] and raw_variant and story_qualifier != project["_stem_qualifier"]:
        qualified_stem = f"{stem} {project['_stem_qualifier']}"
        if not _word_in(text, qualified_stem):
            return None, "qualifier_conflict"
    qualified_variant = bool(project["_stem_qualifier"]) and _word_in(text, f"{stem} {project['_stem_qualifier']}")

    name_tokens = project["_name_tokens"]
    overlap = len(name_tokens & tokens)
    overlap_required = max(2, min(3, len(name_tokens))) if name_tokens else 99
    name_overlap = overlap >= overlap_required

    distinctive_parties = [p for p in project["_operator_parties"] if p not in GENERIC_OPERATOR_CORES and len(p) >= 3]
    operator_party_hit = any(_word_in(text, party) for party in distinctive_parties)
    operator_party_in_title = any(_word_in(title_text, party) for party in distinctive_parties)
    operator_hit = base._phrase_hit(project["operator"], text, tokens) or operator_party_hit
    county_hit = base._phrase_hit(project["county"], location_text, location_tokens)
    region_hit = base._phrase_hit(project["region"], location_text, location_tokens)
    authority_hit = base._phrase_hit(project["planning_authority"], location_text, location_tokens)
    country_hit = bool(project["country"]) and _word_in(location_text, base.norm(project["country"]))
    location_hit = county_hit or region_hit or authority_hit
    corroborating = operator_hit or location_hit

    technology_hit = context["solar_context"] if project["technology"] == "solar" else context["bess_context"]
    conflicting_technology = bool(not technology_hit and (
        context["wind_context"]
        or (project["technology"] == "solar" and context["bess_context"])
        or (project["technology"] == "bess" and context["solar_context"])
    ))
    capacity_relation = _capacity_relation(project, context["news_capacities_mw"])
    full_exact = name_exact or title_name_exact
    variant_exact = variant or title_variant or qualified_variant

    if project["_name_stem_foreign_collision"] and not full_exact and not explicit_ref:
        return None, "foreign_stem_collision"
    detected_foreign, unexplained_foreign = base._foreign_locations(text, project)
    if unexplained_foreign and not explicit_ref:
        return None, "foreign_location_veto"
    if conflicting_technology and not explicit_ref:
        return None, "technology_conflict_gate"
    specific_event = context["event"] != "PROJECT UPDATE"
    official_bypass = bool(context["official_source"] and (full_exact or (variant_exact and not project["_generic_name"])))
    technology_inferred = bool(not technology_hit and ((planning_ref_hit and context["official_source"]) or official_bypass or explicit_ref))
    if not technology_hit and not technology_inferred:
        return None, "technology_gate"

    route = "NAME"
    stem_duplicate = project["_name_stem_duplicate"] and not qualified_variant
    if explicit_ref:
        identity, route = True, "EXPLICIT_REPD_REF"
    elif planning_ref_hit:
        identity, route = True, "PLANNING_REFERENCE"
    elif project["_generic_name"]:
        identity = full_exact and corroborating
    elif project["_name_duplicate"]:
        identity = full_exact and (corroborating or context["official_source"])
    elif full_exact:  # C3
        identity = True
    elif variant_exact and stem_duplicate:
        identity = corroborating or context["official_source"]
    elif variant_exact:
        identity = (
            single_stem or qualified_variant or multi_token_adjacent  # C4
            or corroborating or context["official_source"] or specific_event
        )
    elif single_stem and raw_variant and operator_party_hit:  # C5 (operator disambiguates a shared stem)
        identity, route = True, "STEM_PLUS_OPERATOR"
    else:
        identity = name_overlap and corroborating
    if not identity:
        return None, "identity_gate"

    published = story["published"].date() if isinstance(story.get("published"), datetime) else None
    if _stale(project, published, context) and not full_exact and route not in {"EXPLICIT_REPD_REF", "PLANNING_REFERENCE"}:
        return None, "stale_record_candidate"  # C7
    if capacity_relation == "contradiction" and route not in {"EXPLICIT_REPD_REF", "PLANNING_REFERENCE"}:
        return None, "capacity_contradiction"  # C1

    components = {
        "planning_reference": 52 if (planning_ref_hit or explicit_ref) else 0,
        "project_name": (
            42 if title_name_exact else 38 if (title_variant or (qualified_variant and raw_title_variant))
            else 34 if name_exact else 32 if variant_exact else 24 if route == "STEM_PLUS_OPERATOR"
            else min(18, overlap * 6)
        ),
        "operator": 13 if operator_hit else 0,
        "location_or_authority": 12 if location_hit else 0,
        "technology": 10 if technology_hit else 6 if technology_inferred else 0,
        "official_source": 8 if context["official_source"] else 0,
        "capacity_corroboration": 5 if capacity_relation == "match" else 0,
        "event_specificity": 5 if specific_event else 0,
    }
    try:
        age_days = max(0, (base.scoring_reference() - story["published"]).days)
    except Exception:
        age_days = base.LOOKBACK_DAYS
    components["recency"] = 10 if age_days <= 14 else 8 if age_days <= 30 else 5 if age_days <= 90 else 2
    components["source_quality"] = context["source_quality_score"]
    score = min(100, sum(components.values()))
    strong = bool(
        explicit_ref or planning_ref_hit or full_exact or qualified_variant
        or (variant_exact and len(stem_tokens) >= 2 and not stem_duplicate)
    )
    rank = (
        6 if explicit_ref else 5 if planning_ref_hit
        else 4 if (title_name_exact or title_variant) and corroborating
        else 3 if title_name_exact or title_variant or qualified_variant
        else 2 if name_exact or variant_exact else 1
    )
    evidence = {
        "binder": BINDER_VERSION, "binding_route": route,
        "identity_gate_passed": True, "technology_gate_passed": True,
        "foreign_location_gate_passed": True, "foreign_veto_passed": True,
        "duplicate_name_gate_passed": True, "capacity_only": False,
        "capacity_is_corroboration_only": True,
        "explicit_repd_ref_hit": explicit_ref, "planning_reference_hit": planning_ref_hit,
        "exact_project_name_hit": name_exact, "exact_project_name_in_headline": title_name_exact,
        "distinctive_name_variant_hit": variant, "distinctive_name_variant_in_headline": title_variant,
        "qualified_stem_hit": qualified_variant, "distinctive_name_stem": stem or None,
        "stem_qualifier": project["_stem_qualifier"] or None, "story_qualifier": story_qualifier or None,
        "multi_token_stem_descriptor_adjacent": multi_token_adjacent,
        "strong_identity_anchor": strong, "operator_hit": operator_hit,
        "operator_party_hit": operator_party_hit, "operator_parties": project["_operator_parties"],
        "county_hit": county_hit, "region_hit": region_hit, "planning_authority_hit": authority_hit,
        "country_hit": country_hit, "technology_context_hit": technology_hit,
        "technology_context_inferred": technology_inferred, "official_source": context["official_source"],
        "priority_source": context["priority_source"], "source_quality_tier": context["source_quality_tier"],
        "capacity_relation": capacity_relation, "capacity_match": capacity_relation == "match",
        "duplicate_project_name": project["_name_duplicate"], "stale_record": _stale(project, published, context),
        "foreign_locations_detected": detected_foreign, "score_components": components,
        "event_v2": context["event"],
    }
    return {"project": project, "score": score, "evidence": evidence, "anchor_rank": rank, "strong_anchor": strong,
            "operator_party_in_title": operator_party_in_title, "location_hit": location_hit or country_hit,
            "capacity_relation": capacity_relation}, "accepted_candidate"


def _operator_route(story: dict, context: dict, projects: list[dict]) -> tuple[dict | None, str]:
    """C6: bind an unnamed article only when operator + evidence identify one project."""
    if context["portfolio"]:
        return None, "operator_route_portfolio"
    title = context["title_text"]
    capacities = context["news_capacities_mw"]
    pool = []
    for project in projects:
        parties = [p for p in project["_operator_parties"] if p not in GENERIC_OPERATOR_CORES and len(p) >= 3]
        if not parties or not any(_word_in(title, party) for party in parties):
            continue
        technology_hit = context["solar_context"] if project["technology"] == "solar" else context["bess_context"]
        if not technology_hit:
            continue
        relation = _capacity_relation(project, capacities)
        if relation in {"contradiction", "differs"}:
            continue
        location = (
            base._phrase_hit(project["county"], context["location_text"], context["location_tokens"])
            or base._phrase_hit(project["region"], context["location_text"], context["location_tokens"])
            or base._phrase_hit(project["planning_authority"], context["location_text"], context["location_tokens"])
            or (bool(project["country"]) and project["country"].lower() != "england"
                and _word_in(context["location_text"], base.norm(project["country"])))
        )
        if relation != "match" and not location:
            continue
        published = story["published"].date() if isinstance(story.get("published"), datetime) else None
        if _stale(project, published, context) or project["_status_norm"] in TERMINAL_STATUSES:
            continue
        foreign, unexplained = base._foreign_locations(context["text"], project)
        if unexplained:
            continue
        pool.append((project, relation, location))
    # Narrow by the strongest evidence present: location first, then capacity.
    if any(location for _p, _r, location in pool):
        pool = [entry for entry in pool if entry[2]]
    if any(relation == "match" for _p, relation, _l in pool):
        pool = [entry for entry in pool if entry[1] == "match"]
    developments = {project["gg_development_id"] for project, _r, _l in pool}
    if len(developments) != 1:
        return None, "operator_route_not_unique" if pool else "operator_route_no_candidate"
    pool.sort(key=lambda entry: (entry[1] != "match", entry[0]["repd_ref"]))
    project, relation, location = pool[0]
    components = {
        "operator": 25, "capacity_corroboration": 15 if relation == "match" else 0,
        "location_or_authority": 15 if location else 0, "technology": 10,
        "event_specificity": 5 if context["event"] != "PROJECT UPDATE" else 0,
        "official_source": 8 if context["official_source"] else 0,
        "source_quality": context["source_quality_score"],
    }
    score = min(100, sum(components.values()))
    evidence = {
        "binder": BINDER_VERSION, "binding_route": "OPERATOR_CORROBORATED",
        "identity_gate_passed": True, "technology_gate_passed": True, "foreign_location_gate_passed": True,
        "foreign_veto_passed": True, "duplicate_name_gate_passed": True, "capacity_only": False,
        "capacity_is_corroboration_only": True, "operator_parties": project["_operator_parties"],
        "capacity_relation": relation, "location_hit": bool(location), "strong_identity_anchor": False,
        "unique_operator_candidate_development": True, "score_components": components,
        "event_v2": context["event"],
    }
    if score < FLOOR_OPERATOR_ROUTE:
        return None, "operator_route_below_floor"
    return {"project": project, "score": score, "evidence": evidence, "anchor_rank": 0, "strong_anchor": False}, "accepted"


def _rebind_current_version(project: dict, by_ref: dict[str, dict]) -> tuple[dict, str | None]:
    """C8: a Revised record whose CURRENT_VERSION is in the universe re-binds to it."""
    if project["_status_norm"] != "revised":
        return project, None
    for ref in project.get("_current_version_refs") or []:
        current = by_ref.get(ref)
        if current is not None and current["technology"] == project["technology"]:
            return current, project["repd_ref"]
    return project, None


def resolve_story(story: dict, projects: list[dict], by_ref: dict[str, dict] | None = None) -> tuple[dict | None, str, dict]:
    by_ref = by_ref or {project["repd_ref"]: project for project in projects}
    context = story_context(story)
    text, tokens = context["text"], context["tokens"]
    pool = []
    for project in projects:
        name_tokens = project["_name_tokens"]
        need = max(2, min(3, len(name_tokens))) if name_tokens else 99
        if (
            project["repd_ref"] in context["explicit_repd_refs"]
            or (project["_planning_ref_ok"] and _word_in(text, project["_planning_ref_norm"]))
            or _word_in(text, project["_name_norm"])
            or _word_in(text, project["_name_stem_norm"])
            or len(name_tokens & tokens) >= need
        ):
            pool.append(project)
    reasons: Counter = Counter()
    candidates = []
    for project in pool:
        candidate, reason = evaluate_candidate(project, story, context)
        reasons[reason] += 1
        if candidate is not None:
            candidates.append(candidate)
    qualified = [c for c in candidates if c["score"] >= (base.FLOOR_STRONG if c["strong_anchor"] else base.FLOOR_WEAK)]
    route_detail = None
    if not qualified and not candidates:
        operator_candidate, route_detail = _operator_route(story, context, projects)
        if operator_candidate is not None:
            qualified = [operator_candidate]
    if not qualified:
        reason = "below_confidence_threshold" if candidates else (
            "stale_record_candidate" if reasons.get("stale_record_candidate") else "no_canonical_identity")
        return None, reason, {"identity_candidates": len(candidates), "qualified_candidates": 0,
                              "pair_reasons": dict(reasons), "operator_route": route_detail}
    qualified.sort(key=lambda c: (-c["score"], -c["anchor_rank"], c["project"]["repd_ref"]))
    winner = qualified[0]
    runner = qualified[1] if len(qualified) > 1 else None
    margin = None
    if runner:
        margin = winner["score"] - runner["score"]
        exclusive = winner["anchor_rank"] >= 5 and runner["anchor_rank"] < 5
        same_dev = winner["project"]["gg_development_id"] == runner["project"]["gg_development_id"]
        if margin < base.AMBIGUITY_MARGIN and not exclusive and not same_dev:
            return None, "ambiguous_primary_match", {
                "identity_candidates": len(candidates), "qualified_candidates": len(qualified),
                "top_repd_ref": winner["project"]["repd_ref"], "runner_up_repd_ref": runner["project"]["repd_ref"],
                "score_margin": margin, "pair_reasons": dict(reasons)}
    project, superseded = _rebind_current_version(winner["project"], by_ref)
    evidence = dict(winner["evidence"])
    evidence.update({
        "candidate_project_count": len(candidates), "qualified_project_count": len(qualified),
        "runner_up_score": runner["score"] if runner else None, "score_margin": margin,
        "confidence_floor": (FLOOR_OPERATOR_ROUTE if evidence["binding_route"] == "OPERATOR_CORROBORATED"
                             else base.FLOOR_STRONG if winner["strong_anchor"] else base.FLOOR_WEAK),
        "superseded_repd_ref": superseded,
    })
    capacities = context["news_capacities_mw"]
    item = {
        "gg_article_id": base._article_id(story), "project_id": project["repd_ref"],
        "primary_repd_ref": project["repd_ref"], "repd_ref": project["repd_ref"],
        "gg_project_id": project["gg_project_id"], "gg_development_id": project["gg_development_id"],
        "identity_status": project["identity_status"], "role": "PRIMARY_MATCH",
        "eligible_for_news_signal": True, "repd_record_updated": project["repd_record_updated"],
        "planning_application_reference": project["planning_application_reference"],
        "planning_authority": project["planning_authority"], "project": project["name"],
        "technology": project["technology"], "capacity_mw": project["capacity_mw"],
        "news_capacity_mw": capacities[0] if len(capacities) == 1 else None,
        "news_capacities_mw": capacities, "operator": project["operator"], "county": project["county"],
        "region": project["region"], "country": project["country"], "status": project["status"],
        "event": event_v2(story["title"] + " " + story.get("description", "")),
        "headline": re.sub(r"\s+-\s+[^-]{2,80}$", "", story["title"]).strip(),
        "published": story["published"].date().isoformat(), "source": story.get("source") or "Google News",
        "source_url": story.get("source_url"), "url": story["link"], "confidence": winner["score"],
        "match_evidence": evidence,
        "news_binding_rule": "one globally best PRIMARY_MATCH; capacity is corroboration only; refaware-1",
    }
    return item, "accepted", {"identity_candidates": len(candidates), "qualified_candidates": len(qualified),
                              "pair_reasons": dict(reasons)}


def load_universe(path: Path) -> tuple[dict, list[dict]]:
    """Load any major-projects.v6-schema snapshot; counts come from the snapshot itself."""
    snapshot = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = snapshot.get("projects") or []
    solar = sum(str(r.get("technology")).lower() == "solar" for r in rows)
    bess = sum(str(r.get("technology")).lower() == "bess" for r in rows)
    if "solar_count" in snapshot and (snapshot["solar_count"], snapshot["bess_count"]) != (solar, bess):
        raise RuntimeError("snapshot declared solar/bess counts disagree with its rows")
    saved = (base.PROJECTS_PATH, base.EXPECTED_SOLAR_PROJECTS, base.EXPECTED_BESS_PROJECTS, base.EXPECTED_PROJECTS)
    try:
        base.PROJECTS_PATH = Path(path)
        base.EXPECTED_SOLAR_PROJECTS, base.EXPECTED_BESS_PROJECTS = solar, bess
        base.EXPECTED_PROJECTS = solar + bess
        snap, projects = base.load_project_snapshot()
    finally:
        base.PROJECTS_PATH, base.EXPECTED_SOLAR_PROJECTS, base.EXPECTED_BESS_PROJECTS, base.EXPECTED_PROJECTS = saved
    return snap, prepare_projects(projects, snap)


# ---------------------------------------------------------------------------
# Status-change-driven candidates (automation/repd/diff.py output)
# ---------------------------------------------------------------------------
MILESTONE_EVENTS = {
    "consented": "CONSENT", "under_construction": "CONSTRUCTION", "operational": "OPERATIONAL",
    "refused": "REFUSAL", "withdrawn": "WITHDRAWN",
}


def repd_status_change_candidates(diff: dict, projects: list[dict]) -> list[dict]:
    """Official REPD status transitions for universe projects, as news candidates.

    These are REPD facts, not headlines: role REPD_STATUS_CHANGE,
    eligible_for_news_signal False, so they never become a NEWS SIGNAL and never
    alter the official status shown in the table (NEWS_SIGNAL_V5.md).
    """
    by_ref = {project["repd_ref"]: project for project in projects}
    previous_status: dict[str, str | None] = {}
    for transition in (diff.get("status_transitions") or {}).get("transitions") or []:
        for ref in transition.get("refs") or []:
            previous_status[str(ref)] = transition.get("from")
    labels = (diff.get("new") or {}).get("label"), (diff.get("previous") or {}).get("label")
    out = []
    for category, block in ((diff.get("milestones") or {}).get("categories") or {}).items():
        event = MILESTONE_EVENTS.get(category)
        if not event:
            continue
        for ref in block.get("refs") or []:
            project = by_ref.get(str(ref))
            if project is None:
                continue
            ref = str(ref)
            basis = "transition" if ref in previous_status else "new_record"
            key = f"{ref}|{category}|{labels[0]}"
            out.append({
                "gg_status_change_id": "GG2050-REPDCHG-" + hashlib.sha256(key.encode()).hexdigest()[:16].upper(),
                "role": "REPD_STATUS_CHANGE", "eligible_for_news_signal": False,
                "repd_ref": ref, "gg_project_id": project["gg_project_id"],
                "gg_development_id": project["gg_development_id"], "project": project["name"],
                "technology": project["technology"], "capacity_mw": project["capacity_mw"],
                "operator": project["operator"], "county": project["county"], "region": project["region"],
                "country": project["country"], "event": event, "milestone": category,
                "milestone_label": block.get("label"), "basis": basis,
                "previous_status": previous_status.get(ref), "status": project["status"],
                "repd_record_updated": project["repd_record_updated"],
                "release_from": labels[1], "release_to": labels[0],
                "headline": f"REPD {labels[0]}: {project['name']} ({project['capacity_mw']:g} MW {project['technology']}) "
                            f"{(block.get('label') or category).lower()}",
                "corroborating_articles": [],
            })
    out.sort(key=lambda item: (-item["capacity_mw"], item["milestone"], int(item["repd_ref"])))
    return out


def corroborate(status_changes: list[dict], articles: list[dict]) -> int:
    """Attach article IDs whose PRIMARY_MATCH and event agree with an official transition."""
    by_ref: dict[str, list[dict]] = {}
    for article in articles:
        by_ref.setdefault(str(article.get("repd_ref")), []).append(article)
    linked = 0
    for change in status_changes:
        for article in by_ref.get(change["repd_ref"], []):
            if article.get("event") == change["event"] or (
                change["event"] == "REFUSAL" and article.get("event") == "DELAY"
            ):
                change["corroborating_articles"].append(article["gg_article_id"])
                article.setdefault("corroborates_repd_status_change", []).append(change["gg_status_change_id"])
                linked += 1
    return linked
