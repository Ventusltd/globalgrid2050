"""automation/news/names.py - one shared name normalisation for events, binder and relevance.

Every module in automation/news that compares a project name, an operator or a headline uses
these functions, so a REPD site name, a news headline and a previous feed entry are reduced
the same way. The rules follow the matcher already in the repository
(scripts/major_project_news_v6.py: norm, distinctive_name_stem, descriptor_adjacent) and are
restated here as a pure, importable module so that frozen file is never imported or edited.

Standard library only.
"""
from __future__ import annotations

import re

_WS = re.compile(r"\s+")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")

# REPD site names append addresses and technology after commas, spaced dashes or "near".
SEGMENT_SPLIT_RE = re.compile(r"\s+-\s*|\s*-\s+|,|\bnear\b", flags=re.I)

# Words that describe a scheme rather than name it. Stripped from both ends of a stem.
NAME_BOILERPLATE = frozenset({
    "solar", "farm", "farms", "park", "parks", "battery", "batteries", "storage", "energy",
    "bess", "pv", "photovoltaic", "photovoltaics", "project", "projects", "scheme",
    "development", "renewable", "renewables", "power", "station", "substation", "panels",
    "panel", "plant", "works", "hub", "facility", "system", "systems", "ltd", "limited",
    "plc", "site", "the", "and", "of", "at", "on", "in", "for", "to", "land", "extension",
    "array", "units", "unit", "roof", "mounted", "ground", "wind", "windfarm", "turbine",
    "turbines", "offshore", "onshore", "proposed", "phase", "1", "2", "3",
    "centre", "center", "complex", "installation", "ess", "grid", "services", "mw",
})

# A stem of one of these words alone names nothing (The Grange, Manor Farm, ...).
GENERIC_SINGLE = frozenset({
    "grange", "manor", "common", "lodge", "hall", "hill", "fields", "field", "wood", "woods",
    "bridge", "bank", "brook", "mill", "moor", "marsh", "meadow", "meadows", "home", "house",
    "court", "new", "north", "south", "east", "west", "high", "low", "old", "lane", "road",
    "street", "way", "cottage", "barn", "top", "end", "great", "little", "upper", "lower",
    "church", "school", "college", "university", "hospital", "business", "industrial",
    "estate", "airport", "port", "dock", "quarry", "colliery", "unnamed",
})

# A multi-word stem made only of these words is an address, not a name ('Country Lane', 'New Road').
ADDRESS_ONLY = frozenset({
    "lane", "road", "street", "way", "avenue", "drive", "close", "new", "north", "south", "east",
    "west", "country", "park", "farm", "place", "high", "low", "old", "upper", "lower", "great",
    "little", "main", "station", "the", "industrial", "estate", "business", "trading", "unit",
})

# Technology words that may sit beside a one-token stem in a headline ("Hessay Solar").
DESCRIPTORS = frozenset({
    "solar", "pv", "photovoltaic", "battery", "bess", "storage", "energy", "wind", "windfarm",
    "renewable", "renewables", "data", "datacentre",
})

TECH_WORDS = {
    "solar": frozenset({"solar", "pv", "photovoltaic", "photovoltaics", "mwp"}),
    "battery": frozenset({"battery", "batteries", "bess", "storage", "mwh"}),
    "wind": frozenset({"wind", "windfarm", "turbine", "turbines"}),
}

LEGAL_SUFFIXES = frozenset({
    "ltd", "limited", "plc", "llp", "lp", "inc", "llc", "gmbh", "sa", "bv", "ag", "co",
    "company", "the", "and", "uk", "u", "k",
})


def clean(value) -> str:
    """Trim; treat nan/none/null/not set as blank."""
    text = "" if value is None else str(value).replace("_x000D_", " ")
    text = _WS.sub(" ", text).strip()
    return "" if text.lower() in {"nan", "none", "null", "not set"} else text


def norm(value) -> str:
    """Lowercase, '&' to 'and', every non-alphanumeric run to one space."""
    text = clean(value).lower().replace("&", " and ")
    return _WS.sub(" ", _NON_ALNUM.sub(" ", text)).strip()


def padded(value) -> str:
    """norm() with a leading and trailing space, for whole-phrase containment tests."""
    return f" {norm(value)} "


def contains_phrase(padded_text: str, phrase: str) -> bool:
    """True when the normalised phrase occurs on token boundaries in padded_text."""
    return bool(phrase) and f" {phrase} " in padded_text


def phrase_spans(padded_text: str, phrase: str) -> list[tuple[int, int]]:
    """Character spans of every token-boundary occurrence of phrase in padded_text."""
    if not phrase:
        return []
    needle = f" {phrase} "
    spans, start = [], 0
    while True:
        i = padded_text.find(needle, start)
        if i < 0:
            return spans
        spans.append((i + 1, i + 1 + len(phrase)))
        start = i + 1


def _strip_boilerplate(tokens: list[str]) -> list[str]:
    tokens = list(tokens)
    while tokens and tokens[0] in NAME_BOILERPLATE:
        tokens.pop(0)
    while tokens and tokens[-1] in NAME_BOILERPLATE:
        tokens.pop()
    return tokens


def _stem_of(segment: str) -> str:
    tokens = _strip_boilerplate(norm(segment).split())
    if not tokens:
        return ""
    if len(tokens) == 1 and (tokens[0] in GENERIC_SINGLE or len(tokens[0]) < 4 or tokens[0].isdigit()):
        return ""
    if len(tokens) > 1 and all(t in ADDRESS_ONLY or t.isdigit() for t in tokens):
        return ""
    return " ".join(tokens)


def segments(site_name) -> list[str]:
    return [s for s in (part.strip() for part in SEGMENT_SPLIT_RE.split(clean(site_name))) if s]


def distinctive_stem(site_name) -> str:
    """The leading public identity of a REPD site name, boilerplate stripped at both ends.

    'Springwell, Lincoln - Springwell Solar Farm & Battery Storage' -> 'springwell'
    'West Burton Power Station, North Road - Battery Storage'       -> 'west burton'
    'The Grange'                                                     -> '' (generic)
    """
    parts = segments(site_name)
    return _stem_of(parts[0]) if parts else ""


def name_aliases(site_name) -> dict:
    """Stems a headline could use for one REPD site.

    primary  - stem of the first segment (the usual public name)
    trailing - stem of the last segment when it differs (e.g. 'Coalburn II ...' after an address)
    places   - stems of middle segments (usually a village or road): weak evidence only
    """
    parts = segments(site_name)
    primary = _stem_of(parts[0]) if parts else ""
    trailing = _stem_of(parts[-1]) if len(parts) > 1 else ""
    if trailing == primary:
        trailing = ""
    places = []
    for seg in parts[1:-1]:
        stem = _stem_of(seg)
        if stem and stem not in (primary, trailing) and stem not in places:
            places.append(stem)
    return {"primary": primary, "trailing": trailing, "places": places}


def descriptor_adjacent(padded_text: str, stem: str) -> bool:
    """A one-token stem must sit right before a technology word ('hessay solar'),
    optionally with one short token between ('kells 50mw solar' is not accepted; 'x ii bess' is)."""
    if not stem or " " in stem:
        return False
    tokens = padded_text.split()
    unsafe_predecessors = {"the", "on", "of", "at", "in"}
    for i, tok in enumerate(tokens):
        if tok != stem or (i and tokens[i - 1] in unsafe_predecessors):
            continue
        if i + 1 < len(tokens) and tokens[i + 1] in DESCRIPTORS:
            return True
        if i + 2 < len(tokens) and len(tokens[i + 1]) <= 3 and tokens[i + 2] in DESCRIPTORS:
            return True
    return False


def tech_context(padded_text: str) -> set[str]:
    """Technology families a text mentions: subset of {'solar', 'battery', 'wind'}."""
    toks = set(padded_text.split())
    return {fam for fam, words in TECH_WORDS.items() if toks & words}


def tech_family(repd_technology) -> str:
    t = norm(repd_technology)
    if "solar" in t:
        return "solar"
    if t == "battery" or "storage" in t or "flywheel" in t:
        return "battery"
    if "wind" in t:
        return "wind"
    return "other"


def operator_key(value) -> str:
    """Operator reduced for comparing two releases: case, punctuation, connectors and legal
    suffixes removed, tokens sorted. 'Photovolt Development Partners / SolarFive' and
    'Photovolt Development Partners & SolarFive' give the same key."""
    toks = sorted({t for t in norm(value).split() if t not in LEGAL_SUFFIXES})
    return " ".join(toks)


def operator_tokens(value) -> set[str]:
    """Distinctive operator tokens (length >= 4, not legal or generic words) for headline hits."""
    generic = NAME_BOILERPLATE | LEGAL_SUFFIXES | {"private", "developer", "group", "holdings",
                                                  "capital", "partners", "investments", "services",
                                                  "international", "global", "europe", "british",
                                                  "national", "council", "county", "borough",
                                                  "district", "city", "farmers", "estates"}
    return {t for t in norm(value).split() if len(t) >= 4 and t not in generic and not t.isdigit()}


def site_display(site_name) -> str:
    """Site name for a headline: whitespace collapsed, nothing else changed."""
    return clean(site_name)
