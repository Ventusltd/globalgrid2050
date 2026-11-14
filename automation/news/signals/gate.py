#!/usr/bin/env python3
"""Project signals: one title gate shared by the three collectors and the combiner.

A headline that carries a project's name is not yet a headline about the project: "Fosse Way" is a road,
"Belvoir Castle" a visitor attraction, "Cambridge" a city, "Helios" a project in Spain. Each collector asks this
gate after its own matcher has said yes, and the combiner asks it again for every item, including items carried
from the file published before, so a match the rules now reject is purged.

  judge(ref, title) -> (verdict, reason)

  "none"      the title does not carry any of the project's names: not this gate's business (a match made from a
              feed summary, or by a reviewer who read the article)
  "ok"        the name is in the title with enough beside it
  "possible"  the name is there but the support is thin: keep, never as a confirmed match
  "drop"      the name is there in another sense: not this project

The rule (from the acid test of 14 November 2026, cases_1_false_matches):
- the planning reference in the title is enough;
- otherwise the title must carry a solar term ("solar" not followed by panels, cells, canopy and the like; PV;
  "energy park"; DCO; NSIP), the whole alias with its solar words, or the developer; a name alone, or a name with
  only a county beside it, is dropped;
- a headline placed abroad, or in another UK county than the project's, is dropped;
- a one-word, everyday-word or flagged name needs its solar term directly after it, or a second agreeing fact
  (county, district, developer, capacity); a name shared by two of the 200, or flagged generic, always needs the
  second fact to be more than "possible";
- a capacity in the title far from the REPD figure makes a weak name's match "possible" at most.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

TAIL_RE = re.compile(r"\s+(?:solar|energy|energyfarm|renewables?|photovoltaics?|pv|battery|bess)\b.*$", re.I)
SOLAR_TERM = (r"(?:solar(?:[- ]plus[- ]storage)?(?!\s+(?:panels?|cells?|canop\w+|lights?|lighting|roof\w*|car ?ports?|tiles?|"
              r"thermal|powered|lamps?|trackers?|eclipse|system|bench\w*|charger\w*))|pv|photovoltaics?|energy (?:park|farm)|"
              r"renewable energy (?:project|park)|renewables project|dco|nsip)")
SOLAR_RE = re.compile(r"(?<![\w-])%s(?![\w])" % SOLAR_TERM, re.I)
SMALL_RE = re.compile(r"\broof\w*\b|\bcar ?ports?\b|\bstreet ?lights?\b|\bsolar (?:panels?|cells?|canop\w+|lights?|tiles?) "
                      r"(?:for|on|at|fitted|installed on)\b|\benergy[- ]efficien\w+", re.I)
CONTEXT_RE = re.compile(r"\d\s?(?:MW|GW)\b|\bconsent\b|\bpermit\b|\bBESS\b|\bO&M\b|\bexamination\b|\brefus\w+|\bapprov\w+|\breject\w+|"
                        r"\bdevelopment consent\b", re.I)
# Actual project-development activity, not merely a generic mention of solar.
# Site name and action are a *candidate match*: publisher and REPD evidence
# are checked separately before public confirmation.
DEVELOPMENT_ACTION_RE = re.compile(
    r"\b(?:consent|decision|approv\w*|refus\w*|rejection|reject\w*|"
    r"consult\w*|planning|dco|nsip|paperwork|filed?|filing|submits?|"
    r"pre-examination|permi\w*|financ\w*|invest\w*|epc|o&m|"
    r"energis\w*|energiz\w*|construction|commission\w*|"
    r"operational|acquir\w*|sale|sells?|buys?|delayed|milestones?|"
    r"moves? forward|launch\w*|unveil\w*|tweak\w*|design)\b", re.I
)

PLACE_TAIL = frozenset("farm lane road house hall way castle street bridge airfield aerodrome".split())
FOREIGN_RE = re.compile(
    r"(?<!\w)(?:US|U\.S\.|USA|America|American|Ireland|Irish|County (?:Meath|Kildare|Cork|Wexford|Offaly)|Germany|German|"
    r"France|French|Spain|Spanish|Italy|Italian|Greece|Netherlands|Dutch|Poland|Polish|China|Chinese|India|Indian|Japan|"
    r"Australia|Australian|Canada|Canadian|Texas|California|Missouri|Massachusetts|Vermont|Ontario|Alberta|Arizona|Nevada|"
    r"Florida|Ohio|Indiana|Virginia|Illinois|New Zealand|Brazil|Chile|Mexico|Portugal|Romania|Bulgaria|Hungary|Turkey|"
    r"South Africa|Kenya|Nigeria|Vietnam|Philippines|Denmark|Sweden|Norway|Finland|Belgium|Austria|Switzerland|state contract)"
    r"(?!\w)")
UK_RE = re.compile(r"(?<!\w)(?:UK|U\.K\.|Britain|British|England|English|Scotland|Scottish|Wales|Welsh|DESNZ|Miliband|"
                   r"Planning Inspectorate|Secretary of State)(?!\w)")
COUNTIES = (
    "Bedfordshire Berkshire Buckinghamshire Cambridgeshire Cheshire Cornwall Cumbria Derbyshire Devon Dorset Durham "
    "Essex Gloucestershire Hampshire Herefordshire Hertfordshire Kent Lancashire Leicestershire Lincolnshire Norfolk "
    "Northamptonshire Northumberland Nottinghamshire Oxfordshire Rutland Shropshire Somerset Staffordshire Suffolk "
    "Surrey Warwickshire Wiltshire Worcestershire Merseyside Anglesey Gwynedd Conwy Denbighshire Flintshire Wrexham "
    "Powys Ceredigion Pembrokeshire Carmarthenshire Monmouthshire Aberdeenshire Angus Fife Moray Highland Ayrshire "
    "Lanarkshire Perthshire Stirlingshire Midlothian Cardiff Swansea Newport Gateshead Barnsley").split() + [
    "East Sussex", "West Sussex", "North Yorkshire", "South Yorkshire", "West Yorkshire", "East Yorkshire",
    "East Riding", "Greater Manchester", "West Midlands", "Tyne and Wear", "Isle of Wight", "County Durham",
    "Vale of Glamorgan", "Scottish Borders", "Dumfries and Galloway", "East Lothian", "West Lothian",
    "Perth and Kinross", "Argyll and Bute", "Northern Ireland", "County Antrim", "County Down", "South Gloucestershire",
    "North Lincolnshire", "North East Lincolnshire", "Wensleydale"]
# Old regions in REPD rows and the counties a headline would use instead.
REGIONS = {"grampian": ["Aberdeenshire", "Moray", "Aberdeen"], "tayside": ["Angus", "Perthshire", "Perth and Kinross", "Dundee"],
           "humberside": ["East Yorkshire", "East Riding", "North Lincolnshire", "North East Lincolnshire", "Lincolnshire", "Hull"],
           "hereford and worcester": ["Herefordshire", "Worcestershire"], "clwyd": ["Denbighshire", "Flintshire", "Wrexham", "Conwy"],
           "gwent": ["Monmouthshire", "Newport", "Torfaen", "Caerphilly"], "cleveland": ["Durham", "County Durham", "Hartlepool", "Stockton"],
           "strathclyde": ["Lanarkshire", "Ayrshire"], "central": ["Stirlingshire", "Stirling", "Falkirk"],
           "lothian": ["Midlothian", "East Lothian", "West Lothian"], "dyfed": ["Carmarthenshire", "Pembrokeshire", "Ceredigion"],
           "yorkshire": ["North Yorkshire", "East Yorkshire", "East Riding", "South Yorkshire", "West Yorkshire"],
           "north yorkshire": ["East Yorkshire", "East Riding"], "east yorkshire": ["East Riding"],
           "south glamorgan": ["Cardiff", "Vale of Glamorgan"], "west glamorgan": ["Swansea"], "avon": ["South Gloucestershire", "Somerset"],
           "county durham": ["Durham"], "durham": ["County Durham"]}
EVERYDAY = frozenset(
    "farm farms hill hills lane manor house park grange hall wood woods green north south east west great little new old "
    "high low lower upper moor field fields bridge road drove droves mill church land lands meadow meadows marsh fen "
    "common court lodge cottage barn home top end side long big cross way gate lakes lake valley airfield quarry airport "
    "the of and at on bypass by pass warren breach wick spring springs heath view oak oaks white black red blue stone "
    "water river brook ford corner street castle".split())
DEVELOPER_STOP = frozenset(
    "ltd limited plc llp uk gb group holdings energy energies renewable renewables solar power partners development "
    "developments company co and the of infrastructure capital investments generation green net system systems old "
    "solutions planning pass spring five red white horse iron rush light low carbon switch boom elements defence unknown "
    "canadian shell aura elgin elstree darlington rayleigh farm project projects storage new one first british "
    "international europe european global national island".split())

_TABLE = None


def _norm(text):
    text = (text or "").lower().replace("&", " and ").replace("’", "'").replace("‘", "'").replace("-", " ")
    return " ".join(re.sub(r"[^a-z0-9à-ÿ]+", " ", text).split())


def _has(phrase, text_norm):
    p = _norm(phrase)
    return bool(p) and re.search(r"(?<![a-z0-9])%s(?![a-z0-9])" % re.escape(p), text_norm) is not None


def core_of(alias):
    """The alias without its solar tail; words inside the name are kept ("Fosse Green Energy" -> "Fosse Green")."""
    core = TAIL_RE.sub("", re.sub(r"\([^)]*\)", " ", alias)).strip(" ,-")
    core = re.sub(r"^the\s+", "", core, flags=re.I)
    return core if len(core) >= 3 else ""


def inverted_solar_place(title, record):
    """Match 'solar farm at Foston' against documented alias 'Foston solar farm'.

    Only a place alias with a verified project location qualifies. The
    collector still applies the common title gate and confidence/rights rules.
    This is not a generic acceptance of a loose locality word.
    """
    if not isinstance(title, str):
        return False
    aliases = [a for a in record.get("aliases") or [] if isinstance(a, str)]
    places = list((table().get(str(record.get("repd_ref"))) or {}).get("county_also") or [])
    normalized = _norm(title)
    for alias in aliases:
        core = core_of(alias)
        if (not core or len(_norm(core)) < 5 or _norm(core) not in [_norm(p) for p in places]
                or not re.search(r"\bsolar\s+farm\b", alias, re.I)):
            continue
        if re.search(r"\bsolar farm (?:at|in|near|outside|by) " + re.escape(_norm(core)) + r"\b", normalized):
            return True
    return False


def is_weak_core(core):
    words = _norm(core).split()
    return len(words) <= 1 or all(w in EVERYDAY for w in words) or words[-1] in PLACE_TAIL


def table():
    """{repd_ref: project} from the committed top-200 list, alias table and exclusions (loaded once)."""
    global _TABLE
    if _TABLE is None:
        def load(name):
            try:
                return json.loads((HERE / name).read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return {}
        rows = load("top200_solar.json") or []
        aliases = (load("aliases.json") or {}).get("projects", {})
        rules = (load("exclusions.json") or {}).get("projects", {})
        _TABLE = {}
        for row in rows if isinstance(rows, list) else []:
            ref = str(row.get("repd_ref"))
            _TABLE[ref] = project_of(row, aliases.get(ref), rules.get(ref))
    return _TABLE


def project_of(row, entry=None, rules=None):
    """The fields the gate needs, from a top-200 row, its alias entry and its exclusion rules."""
    entry, rules = entry or {}, rules or {}
    names = [a.strip() for a in entry.get("aliases") or [] if isinstance(a, str) and a.strip()] or \
        [re.split(r"\s+-\s+", row.get("site_name") or "")[-1].strip()]

    def field(key):
        return str(entry.get(key) or row.get(key) or "").strip()

    county = field("county")
    home = [county] + REGIONS.get(county.lower(), []) + list(rules.get("county_also") or [])
    authority = re.sub(r"\b(?:council|borough|district|city|county|metropolitan|unitary|the|of)\b", " ", field("planning_authority"), flags=re.I)
    if not re.search(r"inspectorate|government|ministers|secretary", authority, re.I):
        home.append(" ".join(authority.split()))
    site = field("site_name")
    home += [piece.strip() for piece in re.split(r"\s+-\s+|,", site)[:-1]]
    developers = []
    for name in re.split(r"\s*(?:&|/|,|\band\b)\s*", field("operator")):
        words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9']+", name) if w.lower() not in ("ltd", "limited", "plc", "llp", "uk")]
        distinct = [w for w in words if w.lower() not in DEVELOPER_STOP and (len(w) >= 4 or w.isupper())]
        if len(words) >= 2:
            developers.append(" ".join(words))
        if distinct:
            developers.append(distinct[0])
    try:
        mw = float(entry.get("mw") or row.get("mw") or 0)
    except (TypeError, ValueError):
        mw = 0.0
    return {"repd_ref": str(row.get("repd_ref")), "aliases": names, "planning_ref": field("planning_ref"), "mw": mw,
            "home": [h for h in home if h and len(h) >= 4], "developers": developers, "weak": rules.get("weak_alias"),
            "county_also": list(rules.get("county_also") or []),
            "exclude": [p for p in rules.get("exclude") or [] if isinstance(p, str) and p.strip()]}


def judge(ref, title, project=None, official=False):
    """(verdict, reason): see the module text. `project` (from project_of) replaces the committed tables in tests.
    official=True: the item is from an official register or GOV.UK, where the whole alias is the case's own name."""
    project = project or table().get(str(ref))
    if not project or not isinstance(title, str):
        return "none", ""
    text = _norm(title)
    # Apply the same project-specific false-match exclusions at the collector
    # gate as the combiner (e.g. heat-network energy centres, Fosse Way roads).
    if any(_has(phrase, text) for phrase in project.get("exclude") or []):
        return "drop", "explicitly excluded non-project title"
    names = []                                              # (alias, core, whole alias in title)
    for alias in project["aliases"]:
        core = core_of(alias)
        whole = TAIL_RE.search(alias) is not None and _has(alias, text)
        if whole or (core and _has(core, text)):
            names.append((alias, core or alias, whole))
    planning_ref = project["planning_ref"]
    if len(planning_ref) >= 6 and planning_ref.lower() in title.lower():
        return "ok", "planning reference in the title"
    # A named town getting school rooftop panels, solar canopies or street
    # lights is not evidence that its utility-scale REPD scheme progressed.
    if SMALL_RE.search(title) and not re.search(
            r"\b(?:solar (?:farm|park|plant|project)|NSIP|DCO)\b", title, re.I):
        return "drop", "non-utility rooftop or lighting subject"
    if not names:
        return "none", ""
    if inverted_solar_place(title, {"repd_ref": ref, "aliases": project["aliases"]}):
        return "ok", "evidenced place-form solar-farm title"
    weak_flag = project.get("weak")
    weak = bool(weak_flag) or all(is_weak_core(core) for _alias, core, _whole in names)
    home = any(_has(h, text) for h in project["home"] if not any(_has(h, _norm(a)) for a in project["aliases"]))
    developer = any(_has(d, text) for d in project["developers"]
                    if not any(_has(d, _norm(a)) or _has(core_of(a), _norm(d)) for a in project["aliases"]))
    if FOREIGN_RE.search(title) and not UK_RE.search(title) and not home and not developer:
        return "drop", "the headline is placed outside the UK"
    if weak and not home:
        inside = " ".join(_norm(a) for a in project["aliases"])
        other = [c for c in COUNTIES if _has(c, text) and not _has(c, inside)]
        if other:
            return "drop", "the headline is placed in %s, not the project's county" % other[0]
    solar = SOLAR_RE.search(title) is not None and not SMALL_RE.search(title)
    whole = any(w for _a, _c, w in names) and not SMALL_RE.search(title)
    adjacent = solar and any(re.search(r"(?<![a-z0-9])%s(?: farm)? (?:\d+ ?mw )?%s(?![a-z0-9])" % (
        re.escape(_norm(core)), SOLAR_TERM.replace("[- ]", " ")), text) for _a, core, _w in names)
    capacity = False
    far = False
    if project["mw"]:
        figures = [float(n) * (1000 if unit.lower() == "gw" else 1)
                   for n, unit in re.findall(r"(\d+(?:\.\d+)?)\s?(MW|GW)", title, re.I)]
        capacity = any(abs(f - project["mw"]) <= 0.2 * project["mw"] for f in figures)
        far = bool(figures) and not any(0.45 * project["mw"] <= f <= 2.2 * project["mw"] for f in figures)
    fact = home or developer or capacity
    if official and any(w for _a, _c, w in names) and (not weak or fact) and not far:
        return "ok", "the whole alias in an official title with sufficient identity evidence"
    if not (solar or whole):
        if capacity:
            return ("possible" if weak_flag else "ok"), "the name with the project's capacity"
        everyday = all(all(w in EVERYDAY for w in _norm(core).split()) for _a, core, _w in names)
        if developer and not everyday:
            return "possible", "the name and the developer, but no solar term"
        if not weak and CONTEXT_RE.search(title):
            return "possible", "a distinctive name in a planning or energy headline, but no solar term"
        return "drop", "the name without a solar term"
    if not weak:
        # "North Ray of Light charity solar donation" and "Tealing solar
        # timetable" mention a name and solar but not this power station.
        # Only the whole project alias or a direct solar-development phrase
        # merits the stronger result. General energy news stays possible.
        if whole:
            return "ok", "the full project alias with its solar context"
        site_pattern = re.compile(
            r"(?<![a-z0-9])(?:%s)(?: solar| pv| photovoltaic) "
            r"(?:farm|park|project|plant|scheme|development|array)\b" %
            "|".join(re.escape(_norm(core)) for _alias, core, _w in names)
        )
        if site_pattern.search(text) and not far:
            return "ok", "project core followed by solar development type"
        if DEVELOPMENT_ACTION_RE.search(title) and not far and (fact or any(
                len(_norm(core).split()) >= 2 for _alias, core, _whole in names)):
            return "ok", "distinctive project name plus actual development activity"
        return "possible", "the name and a broad solar mention without project-specific identity"
    if weak_flag:                                           # generic or shared with another row: a fact is required
        if fact and (whole or adjacent) and not far:
            return "ok", "a weak name with a direct solar project phrase and an agreeing fact"
        if whole or adjacent:
            return "possible", "a generic or shared name with no agreeing fact"
        return "drop", "a generic or shared name, not followed by its solar term, with no agreeing fact"
    if whole or adjacent:
        if far and not fact:
            return "possible", "the capacity in the title is far from the project's"
        return "ok", "the name followed directly by its solar term"
    if fact:
        return "possible", "a weak name and a solar term apart, with an agreeing fact"
    return "drop", "a weak name and a solar term apart, with nothing else agreeing"


def for_record(record):
    """The gate's view of a collector's own project record (its aliases, county, operator, reference, capacity),
    with the committed exclusion rules of that reference."""
    ref = str(record.get("repd_ref"))
    committed = table().get(ref) or {}
    made = project_of(record, record, {"weak_alias": committed.get("weak"),
                                       "county_also": committed.get("county_also"),
                                       "exclude": committed.get("exclude")})
    return made


def gated(record, title, found, official=False):
    """A collector's own title match (basis, confidence), or None, after the gate: dropped, or kept as uncertain."""
    if not found:
        return found
    verdict, reason = judge(record.get("repd_ref"), title, project=for_record(record), official=official)
    if verdict == "drop":
        return None
    # Summary-only matches and ambiguous names cannot inherit a collector's
    # confirmed flag unless its evidence really identifies the planning case.
    if verdict in ("possible", "none") and found[1] == "confirmed":
        if verdict == "none" and "planning reference" in str(found[0]).lower():
            return found
        return "%s; kept as uncertain: %s" % (found[0], reason or "no project name in headline"), "uncertain"
    return found
