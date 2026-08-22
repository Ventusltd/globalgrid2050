#!/usr/bin/env python3
"""Build the public V6 newspaper from the validated V6 project snapshot.

The project snapshot is an immutable input. News is a separate intelligence
layer: every published article has exactly one canonical primary project while
other records in the development are context-only links.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import time
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PROJECTS_PATH = ROOT / "dist" / "major_projects_v6.json"
MANIFEST_PATH = ROOT / "dist" / "manifest_v6.json"
NEWS_OUT = ROOT / "dist" / "major_project_news_v6.json"
LINKS_OUT = ROOT / "dist" / "project_news_links_v6.json"

SOLAR_MIN_EXCLUSIVE = 1.0
BESS_MIN_EXCLUSIVE = 100.0
EXPECTED_SOURCE_RECORDS = 14_657
EXPECTED_SOLAR_PROJECTS = 3_445
EXPECTED_BESS_PROJECTS = 269
EXPECTED_PROJECTS = EXPECTED_SOLAR_PROJECTS + EXPECTED_BESS_PROJECTS
LOOKBACK_DAYS = 183
MAX_HEADLINES = 300
MAX_REJECTED_ARTICLE_SAMPLES = 50
MIN_SCORE = 68
AMBIGUITY_MARGIN = 8
BATCH_SIZE = 25
MAX_BATCH_CHARS = 1350
WORKERS = 12
CRAWL_BUDGET_SECONDS = 170
# Leave time for a running 12-second request, global project matching and output
# validation before the outer 170-second workflow timeout. Source failures or a
# quiet period produce valid zero-item output through per-query handling.
NETWORK_BUDGET_SECONDS = 122

PRIORITY_SOURCES = {
    "DESNZ / GOV.UK": "gov.uk",
    "Planning Inspectorate": "planninginspectorate.gov.uk",
    "BBC": "bbc.co.uk",
    "Solar Power Portal": "solarpowerportal.co.uk",
    "Energy-Storage.News": "energy-storage.news",
    "PV Magazine": "pv-magazine.com",
}

BROAD_QUERIES = [
    '"solar farm" UK MW', '"solar park" UK MW', '"solar energy park" UK MW',
    '"solar photovoltaics" UK planning MW', '"battery energy storage" UK MW',
    "BESS UK MW", '"battery storage" UK grid', '"development consent" solar UK',
    '"planning consent" solar UK', '"planning permission" solar farm UK',
    '"financial close" solar UK', '"financial close" battery UK',
    '"construction" solar farm UK', '"construction" battery storage UK',
    '"commercial operation" solar UK', '"commercial operation" battery UK',
    '"energised" battery UK', '"acquisition" solar farm UK',
    '"acquisition" battery storage UK',
]

SOURCE_QUERIES = [
    f"site:{domain} UK {topic}"
    for domain in PRIORITY_SOURCES.values()
    for topic in (
        "solar farm planning construction operational MW",
        "solar park consent approved MW",
        "battery storage BESS construction operational MW",
        "energy storage consent finance acquisition MW",
    )
]

EVENTS = [
    # Negative outcomes precede consent words so "planning permission refused"
    # can never be classified as a consent event merely because it contains
    # "planning permission".
    ("REFUSAL", ["refused", "rejected", "refusal", "turned down", "dismissed"]),
    ("DELAY", ["delayed", "delay", "judicial review", "postponed", "deferred"]),
    ("OPERATIONAL", ["commercial operation", "operational", "energised", "energized", "commissioned", "goes live", "entered operation"]),
    ("CONSTRUCTION", ["construction", "breaking ground", "build begins", "under construction", "construction starts"]),
    ("CONSENT", ["development consent", "planning consent", "approved", "approval", "consented", "permission granted", "planning permission"]),
    ("FINANCIAL CLOSE", ["financial close", "financing", "funding secured", "debt financing"]),
    ("ACQUISITION", ["acquires", "acquired", "acquisition", "sold to", "sale of", "portfolio sale"]),
    ("GRID CONNECTION", ["grid connection", "connected to the grid", "connection agreement", "grid offer"]),
    ("EXPANSION", ["expansion", "expanded", "extension", "upsized"]),
]

STOP = {
    "solar", "farm", "park", "energy", "battery", "storage", "bess", "project",
    "limited", "ltd", "plc", "the", "and", "of", "at", "uk", "phase", "site",
    "development", "power", "renewables", "renewable", "scheme",
}
GENERIC_SINGLE = {
    "grange", "manor", "common", "lodge", "hall", "hill", "fields", "field", "wood",
    "woods", "green", "bridge", "bank", "brook", "mill", "moor", "marsh", "meadow", "meadows",
}

# Bare Ireland is intentionally absent: Northern Ireland is valid UK context.
FOREIGN_RULES = {
    "New Jersey": ("new jersey",), "California": ("california",), "Texas": ("texas",),
    "Australia": ("australia", "new south wales", "queensland", "victoria australia"),
    "Canada": ("canada", "alberta", "ontario canada"), "Germany": ("germany",),
    "Italy": ("italy",), "Spain": ("spain",), "India": ("india",), "China": ("china",),
    "South Africa": ("south africa",), "New Zealand": ("new zealand",),
    "Republic of Ireland": ("republic of ireland", "irish republic"),
    "United States": ("united states", "u s roundup"), "New York": ("new york",),
    "Arizona": ("arizona",), "Nevada": ("nevada",), "Florida": ("florida",),
    "Ohio": ("ohio",), "Virginia": ("virginia",), "Massachusetts": ("massachusetts",),
    "Pennsylvania": ("pennsylvania",), "Colorado": ("colorado",),
}

QUERY_PLAN_META: dict[str, object] = {}

# Press headlines routinely replace the official REPD trailing descriptor
# (for example "Solar Farm") with an equivalent (for example "solar project").
# Only the trailing technology boilerplate is removed: the distinctive place
# name remains mandatory and one-token generic stems are never trusted.
NAME_DESCRIPTOR_SUFFIXES = (
    r"solar energy (?:farm|park|project|scheme|development)",
    r"(?:solar|photovoltaic|pv) (?:farm|park|project|scheme|development|array|panels?)",
    r"battery (?:energy )?storage(?: (?:system|facility|project|scheme|development))?",
    r"energy storage(?: (?:system|facility|project|scheme|development))?",
    r"bess(?: (?:project|facility|scheme|development))?",
    r"energy (?:farm|park|project|scheme|development)",
)
NAME_DESCRIPTOR_SUFFIX_RE = re.compile(
    r"\s+(?:and\s+)?(?:" + "|".join(NAME_DESCRIPTOR_SUFFIXES) + r")$"
)


def clean(value):
    text = str(value or "").strip()
    return "" if text.lower() in {"nan", "none", "null", "not set"} else text


def norm(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(value).lower().replace("&", " and "))).strip()


def toks(value):
    return {token for token in norm(value).split() if len(token) >= 3 and token not in STOP}


def distinctive_name_stem(value) -> str:
    """Return a conservative name key with trailing technology wording removed."""
    original = norm(value)
    stem = original
    while stem:
        shortened = NAME_DESCRIPTOR_SUFFIX_RE.sub("", stem).strip()
        shortened = re.sub(r"\s+(?:and|with)$", "", shortened).strip()
        if shortened == stem:
            break
        stem = shortened
    # A stem is a variant only when a suffix was removed. A single generic
    # place token is never trusted; a unique non-generic one-token stem may be
    # retained but the identity gate requires separate public corroboration.
    stem_tokens = toks(stem)
    if (
        stem == original
        or not stem_tokens
        or (len(stem_tokens) == 1 and next(iter(stem_tokens)) in GENERIC_SINGLE)
    ):
        return ""
    return stem


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json_atomic(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        raise RuntimeError("Missing dist/manifest_v6.json; V6 news cannot use a V4/V5 fallback")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("schema") != "globalgrid2050.repd-manifest.v6" or int(manifest.get("schema_version") or 0) != 6:
        raise RuntimeError("dist/manifest_v6.json is not a V6 manifest")
    if manifest.get("status") != "VALIDATED":
        raise RuntimeError(f"V6 manifest is not validated: {manifest.get('status')!r}")
    return manifest


def _phrase_hit(value, text: str, text_tokens: set[str]) -> bool:
    phrase = norm(value)
    if not phrase:
        return False
    if phrase in text:
        return True
    parts = toks(value)
    return bool(parts) and len(parts & text_tokens) >= min(2, len(parts))


def load_project_snapshot() -> tuple[dict, list[dict]]:
    if not PROJECTS_PATH.exists():
        raise RuntimeError("Missing dist/major_projects_v6.json; no V5/private fallback is permitted")
    snapshot = json.loads(PROJECTS_PATH.read_text(encoding="utf-8"))
    if snapshot.get("schema") != "globalgrid2050.major-projects.v6":
        raise RuntimeError("Unexpected V6 project snapshot schema")
    rows = snapshot.get("projects")
    if not isinstance(rows, list):
        raise RuntimeError("V6 project snapshot has no projects array")
    declared_count = snapshot.get("project_count", snapshot.get("count"))
    if declared_count is not None and int(declared_count) != len(rows):
        raise RuntimeError(f"V6 project snapshot count mismatch: declared={declared_count} actual={len(rows)}")
    canonical_projects = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    actual_projects_hash = hashlib.sha256(canonical_projects.encode("utf-8")).hexdigest()
    if clean(snapshot.get("projects_sha256")) != actual_projects_hash:
        raise RuntimeError("V6 project snapshot projects_sha256 does not match its projects array")

    projects = []
    seen_refs, seen_gg = set(), set()
    for index, source in enumerate(rows):
        repd_ref = clean(source.get("repd_ref"))
        gg_project_id = clean(source.get("gg_project_id"))
        gg_development_id = clean(source.get("gg_development_id"))
        if not repd_ref or not gg_project_id or not gg_development_id:
            raise RuntimeError(f"V6 project row {index} lacks canonical REPD/GlobalGrid identity")
        if repd_ref in seen_refs or gg_project_id in seen_gg:
            raise RuntimeError(f"Duplicate V6 project identity: REPD={repd_ref} GG={gg_project_id}")
        seen_refs.add(repd_ref)
        seen_gg.add(gg_project_id)

        technology = clean(source.get("technology")).lower()
        if technology not in {"solar", "bess"}:
            raise RuntimeError(f"Unsupported V6 news technology {technology!r}: REPD {repd_ref}")
        if source.get("capacity_known") is not True:
            raise RuntimeError(f"Threshold-qualified project has unknown capacity: REPD {repd_ref}")
        try:
            capacity_mw = float(source.get("capacity_mw"))
        except Exception as exc:
            raise RuntimeError(f"Invalid official capacity for REPD {repd_ref}") from exc
        if not math.isfinite(capacity_mw):
            raise RuntimeError(f"Non-finite official capacity for REPD {repd_ref}")
        if technology == "solar" and not capacity_mw > SOLAR_MIN_EXCLUSIVE:
            raise RuntimeError(f"Solar threshold regression for REPD {repd_ref}: {capacity_mw}")
        if technology == "bess" and not capacity_mw > BESS_MIN_EXCLUSIVE:
            raise RuntimeError(f"BESS threshold regression for REPD {repd_ref}: {capacity_mw}")

        name = clean(source.get("name")) or "Unknown Site"
        operator, county = clean(source.get("operator")), clean(source.get("county"))
        region, country = clean(source.get("region")), clean(source.get("country"))
        authority = clean(source.get("planning_authority"))
        planning_ref = clean(source.get("planning_application_reference"))
        project = {
            "project_id": repd_ref, "repd_ref": repd_ref,
            "gg_project_id": gg_project_id, "gg_development_id": gg_development_id,
            "identity_status": clean(source.get("identity_status")) or "REPD_BOUND",
            "repd_record_updated": source.get("repd_record_updated") or None,
            "name": name, "operator": operator, "county": county, "region": region,
            "country": country, "status": clean(source.get("status")),
            "technology": technology, "capacity_mw": capacity_mw, "capacity_known": True,
            "planning_authority": authority, "planning_application_reference": planning_ref,
            "related_repd_refs": [clean(ref) for ref in (source.get("related_repd_refs") or []) if clean(ref)],
            "_name_norm": norm(name), "_name_tokens": toks(name),
            "_name_stem_norm": distinctive_name_stem(name),
            "_planning_ref_norm": norm(planning_ref),
        }
        project["_identity_context"] = norm(" ".join((name, county, region, country, authority, planning_ref)))
        projects.append(project)

    name_counts = Counter(project["_name_norm"] for project in projects if project["_name_norm"])
    stem_counts = Counter(project["_name_stem_norm"] for project in projects if project["_name_stem_norm"])
    for project in projects:
        project["_name_stem_tokens"] = toks(project["_name_stem_norm"])
        duplicate_count = name_counts[project["_name_norm"]]
        project["_name_duplicate_count"] = duplicate_count
        project["_name_duplicate"] = duplicate_count > 1
        project["_name_stem_duplicate_count"] = stem_counts.get(project["_name_stem_norm"], 0)
        project["_name_stem_duplicate"] = project["_name_stem_duplicate_count"] > 1
        # Names made entirely from technology boilerplate (for example
        # "Solar Farm" or "Battery Storage") have no distinctive tokens and
        # must never pass identity on their text alone. The same applies to a
        # single generic place token such as "Grange" or "Common".
        project["_generic_name"] = not project["_name_tokens"] or (
            len(project["_name_tokens"]) == 1
            and next(iter(project["_name_tokens"])) in GENERIC_SINGLE
        )
    solar_count = sum(project["technology"] == "solar" for project in projects)
    bess_count = sum(project["technology"] == "bess" for project in projects)
    if (len(projects), solar_count, bess_count) != (
        EXPECTED_PROJECTS,
        EXPECTED_SOLAR_PROJECTS,
        EXPECTED_BESS_PROJECTS,
    ):
        raise RuntimeError(
            "V6 Q2 project universe mismatch: "
            f"projects={len(projects)} solar={solar_count} bess={bess_count}"
        )
    projects.sort(key=lambda project: (project["name"].casefold(), project["repd_ref"]))
    return snapshot, projects


def load_projects() -> list[dict]:
    return load_project_snapshot()[1]


def fetch_rss(query: str) -> list[dict]:
    requested = f"{query} when:6m"
    url = "https://news.google.com/rss/search?q=" + quote_plus(requested) + "&hl=en-GB&gl=GB&ceid=GB:en"
    request = Request(url, headers={"User-Agent": "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"})
    with urlopen(request, timeout=12) as response:
        root = ET.fromstring(response.read())
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    rows = []
    for item in root.findall(".//item"):
        title, link = clean(item.findtext("title")), clean(item.findtext("link"))
        description = clean(item.findtext("description"))
        source_node = item.find("source")
        source = clean(source_node.text if source_node is not None else "")
        source_url = clean(source_node.attrib.get("url") if source_node is not None else "")
        try:
            published = parsedate_to_datetime(clean(item.findtext("pubDate")))
            published = (published if published.tzinfo else published.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        except Exception:
            continue
        if title and link and published >= cutoff:
            rows.append({"title": title, "link": link, "description": re.sub(r"<[^>]+>", " ", description),
                         "published": published, "source": source, "source_url": source_url})
    return rows


def event(text: str) -> str:
    normalized = norm(text)
    for label, needles in EVENTS:
        if any(norm(needle) in normalized for needle in needles):
            return label
    return "PROJECT UPDATE"


def source_quality(source: str, url: str) -> tuple[int, str, bool, bool]:
    """Score provenance by traceability, without making five publishers a gate."""
    source_text = norm(source)
    try:
        hostname = (urlparse(clean(url)).hostname or "").lower()
    except Exception:
        hostname = ""
    official_host = any(
        hostname == domain or hostname.endswith("." + domain)
        for domain in ("gov.uk", "planninginspectorate.gov.uk")
    )
    official = official_host
    configured_priority = official or any(
        domain == hostname or hostname.endswith("." + domain)
        for domain in PRIORITY_SOURCES.values()
    )
    if official:
        return 20, "official_government_or_planning", True, True
    if configured_priority:
        return 15, "configured_priority_publication", False, True
    # A named publisher with its own resolvable source URL receives a modest
    # provenance score. This admits reputable trade/local/developer sources
    # without turning the confidence rule into a fixed publisher whitelist;
    # identity must still pass independently before these points can matter.
    if source_text and hostname and "news.google." not in hostname:
        return 10, "traceable_named_public_source", False, False
    if source_text or hostname:
        return 7, "partially_traceable_public_source", False, False
    return 5, "unattributed_public_source", False, False


def source_bonus(source: str, url: str) -> int:
    return source_quality(source, url)[0]


def extract_news_capacities(text: str) -> list[float]:
    values = []
    for match in re.findall(r"\b(\d{1,4}(?:\.\d+)?)\s*mw(?:p)?\b", text, flags=re.I):
        try:
            value = float(match)
        except Exception:
            continue
        if math.isfinite(value) and value not in values:
            values.append(value)
    return values


def capacity_match(project: dict, text: str) -> bool:
    return any(abs(value - project["capacity_mw"]) <= max(2.0, project["capacity_mw"] * 0.15)
               for value in extract_news_capacities(text))


def _contains_normalized_phrase(text: str, phrase: str) -> bool:
    normalized = norm(phrase)
    return bool(normalized) and f" {normalized} " in f" {text} "


def _foreign_locations(text: str, project: dict) -> tuple[list[str], list[str]]:
    detected, unexplained = [], []
    for label, phrases in FOREIGN_RULES.items():
        hits = [phrase for phrase in phrases if _contains_normalized_phrase(text, phrase)]
        if not hits:
            continue
        detected.append(label)
        if not any(_contains_normalized_phrase(project["_identity_context"], phrase) for phrase in hits):
            unexplained.append(label)
    # "Ireland" is a foreign-geography veto only when it is not the valid UK
    # phrase "Northern Ireland" and is not part of the project's official
    # identity. This catches Dublin/Ireland leakage without rejecting NI assets.
    if (
        _contains_normalized_phrase(text, "ireland")
        and not _contains_normalized_phrase(text, "northern ireland")
        and "Republic of Ireland" not in detected
    ):
        detected.append("Ireland")
        if not _contains_normalized_phrase(project["_identity_context"], "ireland"):
            unexplained.append("Ireland")
    return detected, unexplained


def _story_context(story: dict) -> dict:
    raw_text = " ".join((story.get("title", ""), story.get("description", ""), story.get("source", ""), story.get("source_url", "")))
    text = norm(raw_text)
    tokens = set(text.split())
    source_score, source_tier, official_source, priority_source = source_quality(
        story.get("source", ""), story.get("source_url", "")
    )
    return {
        "text": text, "title_text": norm(story.get("title")), "tokens": tokens,
        "official_source": official_source, "priority_source": priority_source,
        "source_quality_score": source_score, "source_quality_tier": source_tier,
        "solar_context": bool({"solar", "photovoltaic", "photovoltaics", "pv"} & tokens),
        "bess_context": bool({"battery", "bess", "storage"} & tokens),
        "wind_context": bool({"wind", "turbine", "turbines", "offshore"} & tokens),
        # Extract from the raw text: normalisation turns 46.5 MW into "46 5 mw"
        # and would otherwise manufacture a false 5 MW article capacity.
        "news_capacities_mw": extract_news_capacities(raw_text),
    }


def evaluate_candidate(project: dict, story: dict, context: dict | None = None) -> tuple[dict | None, str]:
    context = context or _story_context(story)
    text, title_text, text_tokens = context["text"], context["title_text"], context["tokens"]
    name_tokens = project["_name_tokens"]
    name_exact = _contains_normalized_phrase(text, project["_name_norm"])
    title_name_exact = _contains_normalized_phrase(title_text, project["_name_norm"])
    name_variant_exact = _contains_normalized_phrase(text, project["_name_stem_norm"])
    title_name_variant_exact = _contains_normalized_phrase(title_text, project["_name_stem_norm"])
    overlap = len(name_tokens & text_tokens)
    overlap_required = max(2, min(3, len(name_tokens))) if name_tokens else 99
    name_overlap = overlap >= overlap_required
    planning_ref_hit = bool(project["_planning_ref_norm"] and project["_planning_ref_norm"] in text)
    operator_hit = _phrase_hit(project["operator"], text, text_tokens)
    county_hit = _phrase_hit(project["county"], text, text_tokens)
    region_hit = _phrase_hit(project["region"], text, text_tokens)
    authority_hit = _phrase_hit(project["planning_authority"], text, text_tokens)
    location_hit = county_hit or region_hit or authority_hit
    technology_hit = context["solar_context"] if project["technology"] == "solar" else context["bess_context"]
    conflicting_technology = bool(
        not technology_hit
        and (
            context["wind_context"]
            or (project["technology"] == "solar" and context["bess_context"])
            or (project["technology"] == "bess" and context["solar_context"])
        )
    )
    capacity_hit = any(
        abs(value - project["capacity_mw"]) <= max(2.0, project["capacity_mw"] * 0.15)
        for value in context["news_capacities_mw"]
    )
    detected_foreign, unexplained_foreign = _foreign_locations(text, project)
    if unexplained_foreign:
        return None, "foreign_location_veto"
    if conflicting_technology:
        return None, "technology_conflict_gate"
    full_exact_identity = title_name_exact or name_exact
    variant_exact_identity = title_name_variant_exact or name_variant_exact
    distinctive_exact_identity = (
        not project["_generic_name"]
        and (full_exact_identity or variant_exact_identity)
    )
    specific_event = event(text) != "PROJECT UPDATE"
    technology_inferred = bool(
        not technology_hit
        and (
            (planning_ref_hit and context["official_source"])
            or (
                distinctive_exact_identity
                and context["priority_source"]
                and (
                    title_name_exact
                    or name_exact
                    or specific_event
                )
            )
        )
    )
    if not technology_hit and not technology_inferred:
        return None, "technology_gate"

    corroborating_identity = operator_hit or location_hit
    exact_identity = full_exact_identity or variant_exact_identity
    if planning_ref_hit:
        identity_gate = True
    elif project["_generic_name"]:
        # A publisher's reputation cannot disambiguate "The Grange" or
        # another generic site name; project-specific corroboration remains
        # mandatory.
        identity_gate = (name_exact or title_name_exact) and corroborating_identity
    elif project["_name_duplicate"] or (variant_exact_identity and project["_name_stem_duplicate"]):
        # An official source may establish the development identity for exact
        # duplicate component records. Component ambiguity is still resolved
        # globally below; this never silently assigns the story to both.
        identity_gate = exact_identity and (corroborating_identity or context["official_source"])
    elif full_exact_identity:
        identity_gate = True
    elif variant_exact_identity:
        stem_is_single_token = len(project["_name_stem_tokens"]) == 1
        identity_gate = (
            corroborating_identity
            if stem_is_single_token
            else (corroborating_identity or context["priority_source"] or specific_event)
        )
    else:
        identity_gate = name_overlap and corroborating_identity
    if not identity_gate:
        return None, "identity_gate"

    anchors = []
    if planning_ref_hit: anchors.append("planning_reference")
    if title_name_exact: anchors.append("exact_project_name_in_headline")
    elif name_exact: anchors.append("exact_project_name")
    elif title_name_variant_exact or name_variant_exact: anchors.append("distinctive_name_variant")
    elif name_overlap: anchors.append("distinctive_project_name_tokens")
    if operator_hit: anchors.append("operator_applicant")
    if county_hit: anchors.append("county")
    if region_hit: anchors.append("region")
    if authority_hit: anchors.append("planning_authority")
    if technology_hit: anchors.append("technology_context")
    if technology_inferred: anchors.append("technology_context_inferred_from_source_and_identity")
    if context["official_source"]: anchors.append("official_source")
    if capacity_hit: anchors.append("capacity_corroboration_only")

    components = {
        "planning_reference": 52 if planning_ref_hit else 0,
        "project_name": (
            42 if title_name_exact else 38 if title_name_variant_exact
            else 34 if name_exact else 32 if name_variant_exact
            else min(18, overlap * 6)
        ),
        "operator": 13 if operator_hit else 0,
        "location_or_authority": 12 if location_hit else 0,
        "technology": 10 if technology_hit else 6 if technology_inferred else 0,
        "official_source": 8 if context["official_source"] else 0,
        "capacity_corroboration": 5 if capacity_hit else 0,
        "event_specificity": 5 if specific_event else 0,
    }
    try:
        age_days = max(0, (datetime.now(timezone.utc) - story["published"]).days)
    except Exception:
        age_days = LOOKBACK_DAYS
    components["recency"] = 10 if age_days <= 14 else 8 if age_days <= 30 else 5 if age_days <= 90 else 2
    components["source_quality"] = context["source_quality_score"]
    candidate_score = min(100, sum(components.values()))
    evidence = {
        "identity_gate_passed": True, "technology_gate_passed": True,
        "foreign_location_gate_passed": True, "anchors": anchors,
        "foreign_veto_passed": True, "duplicate_name_gate_passed": True,
        "capacity_only": False,
        "planning_reference_hit": planning_ref_hit, "exact_project_name_hit": name_exact,
        "exact_project_name_in_headline": title_name_exact,
        "distinctive_name_variant_hit": name_variant_exact,
        "distinctive_name_variant_in_headline": title_name_variant_exact,
        "distinctive_name_stem": project["_name_stem_norm"] or None,
        "distinctive_name_token_overlap": overlap, "operator_hit": operator_hit,
        "county_hit": county_hit, "region_hit": region_hit,
        "planning_authority_hit": authority_hit, "technology_context_hit": technology_hit,
        "technology_context_inferred": technology_inferred,
        "official_source": context["official_source"], "capacity_match": capacity_hit,
        "priority_source": context["priority_source"],
        "source_quality_tier": context["source_quality_tier"],
        "capacity_is_corroboration_only": True,
        "duplicate_project_name": project["_name_duplicate"],
        "duplicate_project_name_count": project["_name_duplicate_count"],
        "foreign_locations_detected": detected_foreign, "score_components": components,
    }
    rank = (
        5 if planning_ref_hit
        else 4 if (title_name_exact or title_name_variant_exact) and corroborating_identity
        else 3 if title_name_exact or title_name_variant_exact
        else 2 if name_exact or name_variant_exact
        else 1
    )
    return {"project": project, "score": candidate_score, "evidence": evidence, "anchor_rank": rank}, "accepted_candidate"


def gate(project: dict, story: dict) -> bool:
    return evaluate_candidate(project, story)[0] is not None


def score(project: dict, story: dict) -> int:
    candidate, _ = evaluate_candidate(project, story)
    return candidate["score"] if candidate else -999


def chunk_names(names: list[str]) -> list[list[str]]:
    chunks, current, characters = [], [], 0
    for name in names:
        safe, added = name.replace('"', "").strip(), len(name) + 7
        if current and (len(current) >= BATCH_SIZE or characters + added > MAX_BATCH_CHARS):
            chunks.append(current); current, characters = [], 0
        current.append(safe); characters += added
    if current: chunks.append(current)
    return chunks


def queries(projects: list[dict]) -> list[str]:
    planned = list(BROAD_QUERIES) + list(SOURCE_QUERIES)
    for technology in ("solar", "bess"):
        names = [project["name"] for project in projects if project["technology"] == technology]
        suffix = "solar UK" if technology == "solar" else '"battery storage" UK'
        for group in chunk_names(names):
            planned.append("(" + " OR ".join('"' + name + '"' for name in group) + ") " + suffix)
    QUERY_PLAN_META.clear()
    QUERY_PLAN_META.update({"source_first_queries": len(BROAD_QUERIES) + len(SOURCE_QUERIES)})
    return list(dict.fromkeys(planned))


def _story_key(story: dict) -> tuple[str, str, str]:
    return norm(story.get("title")), norm(story.get("source_url") or story.get("source")), story["published"].date().isoformat()


def _article_id(story: dict) -> str:
    key = "|".join((norm(story.get("title")), norm(story.get("source")), story["published"].date().isoformat()))
    return "GG2050-NEWS-" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:16].upper()


def _query_bucket(query: str) -> str:
    match = re.search(r"site:([^\s]+)", query, flags=re.I)
    return match.group(1).lower() if match else "broad_or_targeted"


def _candidate_project_pool(context: dict, projects: list[dict]) -> list[dict]:
    """Cheaply retain every project that could pass the identity gate.

    The full matcher remains authoritative. This prefilter only removes records
    that have no planning-reference, exact-name, name-variant or sufficient
    name-token overlap in the story, and therefore cannot pass identity.
    """
    text, text_tokens = context["text"], context["tokens"]
    selected = []
    for project in projects:
        name_tokens = project["_name_tokens"]
        overlap_required = max(2, min(3, len(name_tokens))) if name_tokens else 99
        if (
            (project["_planning_ref_norm"] and project["_planning_ref_norm"] in text)
            or _contains_normalized_phrase(text, project["_name_norm"])
            or _contains_normalized_phrase(text, project["_name_stem_norm"])
            or len(name_tokens & text_tokens) >= overlap_required
        ):
            selected.append(project)
    return selected


def _resolve_story(story: dict, projects: list[dict]) -> tuple[dict | None, str, dict]:
    context, candidates, pair_reasons = _story_context(story), [], Counter()
    candidate_pool = _candidate_project_pool(context, projects)
    if len(candidate_pool) < len(projects):
        pair_reasons["identity_prefilter"] = len(projects) - len(candidate_pool)
    for project in candidate_pool:
        candidate, reason = evaluate_candidate(project, story, context)
        pair_reasons[reason] += 1
        if candidate is not None: candidates.append(candidate)
    qualified = [candidate for candidate in candidates if candidate["score"] >= MIN_SCORE]
    if not qualified:
        reason = "below_confidence_threshold" if candidates else "no_canonical_identity"
        return None, reason, {
            "identity_candidates": len(candidates), "qualified_candidates": 0,
            "top_score": max((candidate["score"] for candidate in candidates), default=None),
            "pair_reasons": dict(pair_reasons),
        }

    qualified.sort(key=lambda candidate: (-candidate["score"], -candidate["anchor_rank"], candidate["project"]["repd_ref"]))
    winner, runner_up = qualified[0], qualified[1] if len(qualified) > 1 else None
    if runner_up:
        margin = winner["score"] - runner_up["score"]
        planning_exclusive = winner["evidence"]["planning_reference_hit"] and not runner_up["evidence"]["planning_reference_hit"]
        if margin < AMBIGUITY_MARGIN and not planning_exclusive:
            return None, "ambiguous_primary_match", {
                "identity_candidates": len(candidates), "qualified_candidates": len(qualified),
                "top_score": winner["score"], "runner_up_score": runner_up["score"],
                "score_margin": margin, "top_repd_ref": winner["project"]["repd_ref"],
                "runner_up_repd_ref": runner_up["project"]["repd_ref"],
                "pair_reasons": dict(pair_reasons),
            }
    else:
        margin = None

    project, evidence = winner["project"], winner["evidence"]
    evidence.update({"candidate_project_count": len(candidates), "qualified_project_count": len(qualified),
                     "runner_up_score": runner_up["score"] if runner_up else None, "score_margin": margin})
    capacities = context["news_capacities_mw"]
    item = {
        "gg_article_id": _article_id(story), "project_id": project["repd_ref"],
        "primary_repd_ref": project["repd_ref"], "repd_ref": project["repd_ref"],
        "gg_project_id": project["gg_project_id"], "gg_development_id": project["gg_development_id"],
        "identity_status": project["identity_status"], "role": "PRIMARY_MATCH",
        "eligible_for_news_signal": True, "repd_record_updated": project["repd_record_updated"],
        "planning_application_reference": project["planning_application_reference"],
        "planning_authority": project["planning_authority"], "project": project["name"],
        "technology": project["technology"], "capacity_mw": project["capacity_mw"],
        "news_capacity_mw": capacities[0] if len(capacities) == 1 else None,
        "news_capacities_mw": capacities, "operator": project["operator"],
        "county": project["county"], "region": project["region"], "country": project["country"],
        "status": project["status"], "event": event(story["title"] + " " + story.get("description", "")),
        "headline": re.sub(r"\s+-\s+[^-]{2,80}$", "", story["title"]).strip(),
        "published": story["published"].date().isoformat(), "source": story.get("source") or "Google News",
        "source_url": story.get("source_url"), "url": story["link"], "confidence": winner["score"],
        "match_evidence": evidence,
        "news_binding_rule": "one globally best PRIMARY_MATCH; capacity is corroboration only",
    }
    return item, "accepted", {
        "identity_candidates": len(candidates), "qualified_candidates": len(qualified),
        "top_score": winner["score"], "pair_reasons": dict(pair_reasons),
    }


def _build_links(items: list[dict], projects: list[dict]) -> list[dict]:
    by_ref = {project["repd_ref"]: project for project in projects}
    by_development: dict[str, list[dict]] = defaultdict(list)
    for project in projects: by_development[project["gg_development_id"]].append(project)
    links = []
    for item in items:
        primary = by_ref[item["repd_ref"]]
        links.append({"gg_article_id": item["gg_article_id"], "gg_project_id": primary["gg_project_id"],
                      "gg_development_id": primary["gg_development_id"], "repd_ref": primary["repd_ref"],
                      "role": "PRIMARY_MATCH", "eligible_for_news_signal": True, "confidence": item["confidence"]})
        related_refs = set(primary.get("related_repd_refs") or [])
        related_refs.update(project["repd_ref"] for project in by_development.get(primary["gg_development_id"], [])
                            if project["repd_ref"] != primary["repd_ref"])
        attached = []
        for ref in sorted(related_refs, key=lambda value: (int(value) if value.isdigit() else 10**18, value)):
            related = by_ref.get(ref)
            if not related or related["repd_ref"] == primary["repd_ref"]: continue
            links.append({"gg_article_id": item["gg_article_id"], "gg_project_id": related["gg_project_id"],
                          "gg_development_id": related["gg_development_id"], "repd_ref": related["repd_ref"],
                          "role": "RELATED_DEVELOPMENT", "eligible_for_news_signal": False, "confidence": None})
            attached.append(related["repd_ref"])
        item["development_related_repd_refs"] = attached
    return links


def collect(projects: list[dict]) -> tuple[list[dict], list[dict], dict]:
    started, start_clock = datetime.now(timezone.utc), time.monotonic()
    deadline = start_clock + NETWORK_BUDGET_SECONDS
    planned_queries = queries(projects)
    source_first_count = int(QUERY_PLAN_META.get("source_first_queries") or (len(BROAD_QUERIES) + len(SOURCE_QUERIES)))
    phases = [("source_first", planned_queries[:source_first_count]),
              ("targeted_backstop", planned_queries[source_first_count:])]
    raw, seen, query_errors = [], set(), []
    query_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"configured": 0, "completed": 0, "failed": 0, "candidates": 0})
    execution_stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"configured": 0, "completed": 0, "failed": 0, "candidates": 0}
    )
    query_execution_groups: dict[str, tuple[str, ...]] = {}
    for index, query in enumerate(planned_queries):
        groups = ["source_first" if index < source_first_count else "targeted_backstop"]
        if index >= source_first_count and query.startswith("(") and query.endswith(") solar UK"):
            groups.append("solar_targeted_backstop")
        query_execution_groups[query] = tuple(groups)
        for group in groups:
            execution_stats[group]["configured"] += 1
    for query in planned_queries: query_stats[_query_bucket(query)]["configured"] += 1
    completed_queries = failed_queries = raw_candidate_count = 0
    for phase_name, phase_queries in phases:
        if not phase_queries or time.monotonic() >= deadline: continue
        executor = ThreadPoolExecutor(max_workers=WORKERS)
        futures = {executor.submit(fetch_rss, query): query for query in phase_queries}
        try:
            for future in as_completed(futures, timeout=max(0.1, deadline - time.monotonic())):
                query, bucket = futures[future], _query_bucket(futures[future])
                try:
                    rows = future.result(); completed_queries += 1
                    query_stats[bucket]["completed"] += 1; query_stats[bucket]["candidates"] += len(rows)
                    for group in query_execution_groups[query]:
                        execution_stats[group]["completed"] += 1
                        execution_stats[group]["candidates"] += len(rows)
                    raw_candidate_count += len(rows)
                except Exception as exc:
                    failed_queries += 1; query_stats[bucket]["failed"] += 1
                    for group in query_execution_groups[query]:
                        execution_stats[group]["failed"] += 1
                    if len(query_errors) < 25:
                        query_errors.append({"phase": phase_name, "query": query[:300], "error": type(exc).__name__})
                    continue
                for story in rows:
                    key = _story_key(story)
                    if key not in seen: seen.add(key); raw.append(story)
        except FuturesTimeoutError:
            for future, query in futures.items():
                if not future.done():
                    future.cancel(); failed_queries += 1; query_stats[_query_bucket(query)]["failed"] += 1
                    for group in query_execution_groups[query]:
                        execution_stats[group]["failed"] += 1
            if len(query_errors) < 25:
                query_errors.append({"phase": phase_name, "query": "<remaining queries>", "error": "network_budget_exhausted"})
        finally:
            executor.shutdown(wait=True, cancel_futures=True)
        if time.monotonic() >= deadline: break

    accepted, rejection_reasons, pair_rejection_reasons = [], Counter(), Counter()
    rejected_article_samples = []
    identity_candidate_pairs = qualified_candidate_pairs = ambiguous_count = 0
    for story in raw:
        item, resolution, detail = _resolve_story(story, projects)
        identity_candidate_pairs += int(detail.get("identity_candidates") or 0)
        qualified_candidate_pairs += int(detail.get("qualified_candidates") or 0)
        pair_rejection_reasons.update({
            reason: int(count)
            for reason, count in (detail.get("pair_reasons") or {}).items()
            if reason != "accepted_candidate"
        })
        if item is None:
            rejection_reasons[resolution] += 1
            ambiguous_count += resolution == "ambiguous_primary_match"
            if len(rejected_article_samples) < MAX_REJECTED_ARTICLE_SAMPLES:
                published = story.get("published")
                rejected_article_samples.append({
                    "title": clean(story.get("title")),
                    "source": clean(story.get("source")) or "Google News",
                    "published": published.date().isoformat() if isinstance(published, datetime) else clean(published),
                    "resolution": resolution,
                    "identity_candidates": int(detail.get("identity_candidates") or 0),
                    "qualified_candidates": int(detail.get("qualified_candidates") or 0),
                    "top_score": detail.get("top_score"),
                    "pair_reasons": dict(sorted((detail.get("pair_reasons") or {}).items())),
                })
        else: accepted.append(item)
    accepted.sort(key=lambda item: (item["published"], item["confidence"], item["headline"]), reverse=True)
    accepted_before_limit, accepted = len(accepted), accepted[:MAX_HEADLINES]
    links = _build_links(accepted, projects)
    source_telemetry = []
    for label, domain in PRIORITY_SOURCES.items():
        source_telemetry.append({"name": label, "domain": domain,
                                 **query_stats.get(domain, {"configured": 0, "completed": 0, "failed": 0, "candidates": 0})})
    telemetry = {
        "started_at": started.isoformat(), "completed_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": round(time.monotonic() - start_clock, 3),
        "crawl_budget_seconds": CRAWL_BUDGET_SECONDS, "network_budget_seconds": NETWORK_BUDGET_SECONDS,
        "source_first": True, "queries_configured": len(planned_queries),
        "queries_completed": completed_queries, "queries_failed_or_cancelled": failed_queries,
        "queried_sources": source_telemetry, "query_plan": dict(QUERY_PLAN_META), "query_errors": query_errors,
        "query_execution": {key: dict(value) for key, value in sorted(execution_stats.items())},
        "rss_candidates_returned": raw_candidate_count, "deduplicated_article_candidates": len(raw),
        "identity_candidate_pairs": identity_candidate_pairs, "confidence_qualified_pairs": qualified_candidate_pairs,
        "articles_accepted_before_limit": accepted_before_limit, "articles_published": len(accepted),
        "articles_rejected": len(raw) - accepted_before_limit, "articles_ambiguous": ambiguous_count,
        "articles_dropped_by_headline_limit": max(0, accepted_before_limit - len(accepted)),
        "rejection_reasons": dict(sorted(rejection_reasons.items())), "zero_accepted_is_valid": True,
        "pair_rejection_reasons": dict(sorted(pair_rejection_reasons.items())),
        "rejected_article_samples": rejected_article_samples,
        "rejected_article_sample_limit": MAX_REJECTED_ARTICLE_SAMPLES,
    }
    print("queries", len(planned_queries), "completed", completed_queries, "candidates", len(raw),
          "accepted", len(accepted), "rejected", telemetry["articles_rejected"], "ambiguous", ambiguous_count)
    return accepted, links, telemetry


def main() -> dict:
    project_hash_before = file_sha256(PROJECTS_PATH)
    manifest = load_manifest()
    snapshot, projects = load_project_snapshot()
    manifest_snapshot = manifest.get("public_snapshot") or {}
    manifest_counts = manifest.get("canonical_counts") or {}
    if (
        manifest.get("source_record_count") != EXPECTED_SOURCE_RECORDS
        or manifest.get("source_unique_ref_count") != EXPECTED_SOURCE_RECORDS
        or manifest_counts.get("solar") != EXPECTED_SOLAR_PROJECTS
        or manifest_counts.get("bess") != EXPECTED_BESS_PROJECTS
        or manifest_counts.get("combined") != EXPECTED_PROJECTS
    ):
        raise RuntimeError("V6 manifest does not describe the reconciled Q2 2026 source universe")
    if (
        manifest_snapshot.get("path") != "dist/major_projects_v6.json"
        or manifest_snapshot.get("project_count") != len(projects)
        or manifest_snapshot.get("projects_sha256") != snapshot.get("projects_sha256")
    ):
        raise RuntimeError("V6 manifest is not bound to the supplied public project snapshot")
    # collect() isolates per-query network errors and records them in telemetry.
    # Programming/schema errors intentionally propagate and fail closed.
    items, links, telemetry = collect(projects)
    if file_sha256(PROJECTS_PATH) != project_hash_before:
        raise RuntimeError("News crawler modified immutable dist/major_projects_v6.json")

    now = datetime.now(timezone.utc).isoformat()
    solar_count = sum(project["technology"] == "solar" for project in projects)
    bess_count = sum(project["technology"] == "bess" for project in projects)
    supplied = sum(bool(project.get("repd_record_updated")) for project in projects)
    update_coverage = round(supplied / len(projects), 8) if projects else 1.0
    official_count = sum(bool(item.get("match_evidence", {}).get("official_source")) for item in items)
    source_meta = {
        "owner": manifest.get("source_owner"), "page": manifest.get("source_page"),
        "csv": manifest.get("source_url"), "excel": manifest.get("source_excel_url"),
        "edition": manifest.get("source_dataset_title"), "page_last_updated": manifest.get("source_page_last_updated"),
        "validated_at": manifest.get("validated_at"), "source_record_count": manifest.get("source_record_count"),
        "source_unique_ref_count": manifest.get("source_unique_ref_count"), "csv_xlsx_reconciled": True,
    }
    payload = {
        "schema": "globalgrid2050.major-project-news.v6", "updated": now,
        "lookback_days": LOOKBACK_DAYS, "news_horizon_days": LOOKBACK_DAYS,
        "crawl_target_seconds": CRAWL_BUDGET_SECONDS, "crawl_target_minutes": 3,
        "thresholds": {"solar_mw_exclusive": SOLAR_MIN_EXCLUSIVE, "bess_mw_exclusive": BESS_MIN_EXCLUSIVE},
        "eligible_projects": len(projects), "eligible_solar": solar_count, "eligible_bess": bess_count,
        "headline_count": len(items), "official_source_headlines": official_count,
        "priority_sources": list(PRIORITY_SOURCES), "repd_bound": True, "globalgrid_id_required": True,
        "repd_edition": source_meta["edition"], "repd_source_page_last_updated": source_meta["page_last_updated"],
        "repd_source_url": source_meta["csv"], "repd_record_update_coverage": update_coverage,
        "repd_record_update_policy": "official value when supplied; null preserved and never inferred",
        "project_snapshot": {"path": "dist/major_projects_v6.json", "sha256": project_hash_before,
                             "declared_projects_sha256": snapshot.get("projects_sha256"),
                             "validated_at": snapshot.get("validated_at")},
        "source": source_meta,
        "quality_gate": "identity before score; one global PRIMARY_MATCH; duplicate-name ambiguity rejection; technology and context-aware foreign gates; capacity corroboration only",
        "discovery_policy": "source-first bounded crawl + rotating project-name completeness backstop; no V5/private fallback",
        "news_signal_scope": "Only PRIMARY_MATCH is eligible for NEWS SIGNAL; RELATED_DEVELOPMENT is context only",
        "rejected_candidates": telemetry["articles_rejected"], "ambiguous_candidates": telemetry["articles_ambiguous"],
        "query_count": telemetry["queries_configured"], "raw_story_count": telemetry["deduplicated_article_candidates"],
        "telemetry": telemetry, "items": items,
    }
    link_payload = {
        "schema": "globalgrid2050.project-news-links.v6", "generated_at": now,
        "article_count": len(items), "link_count": len(links),
        "primary_link_count": sum(link["role"] == "PRIMARY_MATCH" for link in links),
        "related_development_link_count": sum(link["role"] == "RELATED_DEVELOPMENT" for link in links),
        "rules": {"one_primary_match_per_article": True, "primary_match_drives_news_signal": True,
                  "related_development_drives_news_signal": False,
                  "related_development_never_confirms_repd_status": True},
        "links": links,
    }
    write_json_atomic(NEWS_OUT, payload)
    write_json_atomic(LINKS_OUT, link_payload)
    if file_sha256(PROJECTS_PATH) != project_hash_before:
        raise RuntimeError("News output write changed immutable V6 project snapshot")
    print("eligible", len(projects), "solar", solar_count, "bess", bess_count,
          "headlines", len(items), "official", official_count)
    return payload


if __name__ == "__main__":
    main()
