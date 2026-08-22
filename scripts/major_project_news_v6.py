#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus

import requests

ROOT = Path(__file__).resolve().parents[1]
REPD_PATH = ROOT / "dist" / "repd_master.json"
MANIFEST_PATH = ROOT / "dist" / "manifest_v4.json"
NEWS_OUT = ROOT / "dist" / "major_project_news_v6.json"
PROJECTS_OUT = ROOT / "dist" / "major_projects_v6.json"

SOLAR_MIN_EXCLUSIVE = 1.0
BESS_MIN_EXCLUSIVE = 100.0
LOOKBACK_DAYS = 183
MAX_HEADLINES = 300
MAX_PER_PROJECT = 3
MIN_SCORE = 68
BATCH_SIZE = 25
MAX_BATCH_CHARS = 1350
WORKERS = 12

PRIORITY_SOURCES = {
    "DESNZ / GOV.UK": "gov.uk",
    "Planning Inspectorate": "planninginspectorate.gov.uk",
    "BBC": "bbc.co.uk",
    "Solar Power Portal": "solarpowerportal.co.uk",
    "Energy-Storage.News": "energy-storage.news",
    "PV Magazine": "pv-magazine.com",
}

BROAD_QUERIES = [
    '"solar farm" UK MW',
    '"solar park" UK MW',
    '"solar energy park" UK MW',
    '"solar photovoltaics" UK planning MW',
    '"battery energy storage" UK MW',
    'BESS UK MW',
    '"battery storage" UK grid',
    '"development consent" solar UK',
    '"planning consent" solar UK',
    '"planning permission" solar farm UK',
    '"financial close" solar UK',
    '"financial close" battery UK',
    '"construction" solar farm UK',
    '"construction" battery storage UK',
    '"commercial operation" solar UK',
    '"commercial operation" battery UK',
    '"energised" battery UK',
    '"acquisition" solar farm UK',
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
    ("OPERATIONAL", ["commercial operation", "operational", "energised", "energized", "commissioned", "goes live", "entered operation"]),
    ("CONSTRUCTION", ["construction", "breaking ground", "build begins", "under construction", "construction starts"]),
    ("CONSENT", ["development consent", "planning consent", "approved", "approval", "consented", "permission granted", "planning permission"]),
    ("FINANCIAL CLOSE", ["financial close", "financing", "funding secured", "debt financing"]),
    ("ACQUISITION", ["acquires", "acquired", "acquisition", "sold to", "sale of", "portfolio sale"]),
    ("GRID CONNECTION", ["grid connection", "connected to the grid", "connection agreement", "grid offer"]),
    ("EXPANSION", ["expansion", "expanded", "extension", "upsized"]),
    ("DELAY / REFUSAL", ["refused", "rejected", "delayed", "delay", "judicial review"]),
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
FOREIGN_PHRASES = {
    "new jersey", "california", "texas", "australia", "canada", "germany", "italy", "spain",
    "india", "china", "south africa", "new zealand", "ireland", "united states", "u s roundup",
    "new york", "arizona", "nevada", "florida", "ohio", "virginia",
}


def clean(v):
    s = str(v or "")
    return "" if s.lower() in {"nan", "none", "null", "not set"} else s.strip()


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower().replace("&", " and "))).strip()


def toks(v):
    return {t for t in norm(v).split() if len(t) >= 3 and t not in STOP}


def load_manifest():
    if not MANIFEST_PATH.exists():
        return {}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_projects():
    data = json.loads(REPD_PATH.read_text(encoding="utf-8"))
    out = []
    seen_refs = set()
    for feature in data.get("features", []):
        p = feature.get("properties", {})
        tech = clean(p.get("tech"))
        try:
            mw = float(p.get("capacity") or 0)
        except Exception:
            continue
        if not math.isfinite(mw):
            continue
        solar = tech in {"solar", "solar_roof"} and mw > SOLAR_MIN_EXCLUSIVE
        bess = tech == "bess" and mw > BESS_MIN_EXCLUSIVE
        if not (solar or bess):
            continue

        repd_ref = clean(p.get("repd_ref"))
        repd_updated = clean(p.get("repd_record_updated"))
        if not repd_ref or not repd_updated:
            raise RuntimeError(f"Eligible REPD project missing official binding: {p.get('name')} ref={repd_ref!r} updated={repd_updated!r}")
        if repd_ref in seen_refs:
            raise RuntimeError(f"Duplicate eligible REPD Ref ID: {repd_ref}")
        seen_refs.add(repd_ref)

        name = clean(p.get("name")) or "Unknown Site"
        category = "solar" if solar else "bess"
        operator = clean(p.get("operator"))
        county = clean(p.get("county") or p.get("local_planning_authority") or p.get("region"))
        planning_ref = clean(p.get("planning_application_reference"))
        out.append(
            {
                "id": repd_ref,
                "repd_ref": repd_ref,
                "repd_record_updated": repd_updated,
                "name": name,
                "operator": operator,
                "county": county,
                "status": clean(p.get("status")),
                "technology": category,
                "capacity_mw": round(mw, 3),
                "planning_authority": clean(p.get("planning_authority") or p.get("local_planning_authority")),
                "planning_application_reference": planning_ref,
                "_name_norm": norm(name),
                "_name_tokens": sorted(toks(name)),
                "_operator_tokens": sorted(toks(operator)),
                "_county_tokens": sorted(toks(county)),
                "_planning_ref_norm": norm(planning_ref),
            }
        )
    return sorted(out, key=lambda x: (-x["capacity_mw"], x["name"]))


def fetch_rss(query):
    q = f"{query} when:6m"
    url = "https://news.google.com/rss/search?q=" + quote_plus(q) + "&hl=en-GB&gl=GB&ceid=GB:en"
    r = requests.get(url, headers={"User-Agent": "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"}, timeout=12)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    rows = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title"))
        link = clean(item.findtext("link"))
        desc = clean(item.findtext("description"))
        src = item.find("source")
        source = clean(src.text if src is not None else "")
        source_url = clean(src.attrib.get("url") if src is not None else "")
        try:
            dt = parsedate_to_datetime(clean(item.findtext("pubDate")))
            dt = (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        except Exception:
            continue
        if title and link and dt >= cutoff:
            rows.append(
                {
                    "title": title,
                    "link": link,
                    "description": re.sub(r"<[^>]+>", " ", desc),
                    "published": dt,
                    "source": source,
                    "source_url": source_url,
                }
            )
    return rows


def event(text):
    t = norm(text)
    for label, needles in EVENTS:
        if any(norm(n) in t for n in needles):
            return label
    return "PROJECT UPDATE"


def source_bonus(source, url):
    x = norm(source) + " " + norm(url)
    if any(v in x for v in ("gov uk", "planning inspectorate", "planninginspectorate")):
        return 24
    if any(v in x for v in ("solar power portal", "energy storage news", "pv magazine", "bbc")):
        return 20
    return 5


def capacity_match(project, text):
    for m in re.findall(r"\b(\d{1,4}(?:\.\d+)?)\s*mw(?:p)?\b", text):
        try:
            if abs(float(m) - project["capacity_mw"]) <= max(2.0, project["capacity_mw"] * 0.15):
                return True
        except Exception:
            pass
    return False


def gate(project, story):
    text = norm(story["title"] + " " + story["description"] + " " + story["source"])
    title_text = norm(story["title"])
    tt = set(text.split())
    names = set(project["_name_tokens"])
    op = set(project["_operator_tokens"])
    county = set(project["_county_tokens"])
    exact = bool(project["_name_norm"] and project["_name_norm"] in text)
    title_exact = bool(project["_name_norm"] and project["_name_norm"] in title_text)
    overlap = len(names & tt)
    op_hit = bool(op & tt)
    county_hit = bool(county & tt)
    cap_hit = capacity_match(project, text)
    planning_ref_hit = bool(project["_planning_ref_norm"] and project["_planning_ref_norm"] in text)
    source_text = norm(story["source"] + " " + story["source_url"])
    official = any(x in source_text for x in ("gov uk", "planning inspectorate", "planninginspectorate"))
    tech_hit = ("solar" in tt or "photovoltaic" in tt or "photovoltaics" in tt or "pv" in tt) if project["technology"] == "solar" else bool({"battery", "bess", "storage"} & tt)

    foreign = any(norm(x) in text and norm(x) not in project["_name_norm"] for x in FOREIGN_PHRASES)
    if foreign and not (title_exact and (county_hit or planning_ref_hit or official)):
        return False
    if not exact and overlap < 2 and not planning_ref_hit:
        return False
    if len(names) == 1 and next(iter(names), "") in GENERIC_SINGLE and not (title_exact and tech_hit and (op_hit or county_hit or cap_hit or planning_ref_hit or official)):
        return False
    if not tech_hit and not planning_ref_hit and not (official and title_exact) and not (title_exact and cap_hit and (op_hit or county_hit)):
        return False
    return True


def score(project, story):
    if not gate(project, story):
        return -999
    text = norm(story["title"] + " " + story["description"] + " " + story["source"])
    title_text = norm(story["title"])
    tt = set(text.split())
    names = set(project["_name_tokens"])
    op = set(project["_operator_tokens"])
    county = set(project["_county_tokens"])
    exact = project["_name_norm"] in text
    title_exact = project["_name_norm"] in title_text
    overlap = len(names & tt)
    planning_ref_hit = bool(project["_planning_ref_norm"] and project["_planning_ref_norm"] in text)

    sc = 78 if title_exact else 70 if exact else 58 if overlap >= 3 else 42
    if planning_ref_hit:
        sc += 35
    sc += 18 if op and len(op & tt) >= min(2, len(op)) else 8 if op & tt else 0
    sc += 12 if county & tt else 0
    sc += 16 if capacity_match(project, text) else 0
    age = max(0, (datetime.now(timezone.utc) - story["published"]).days)
    sc += 18 if age <= 14 else 14 if age <= 30 else 10 if age <= 90 else 6
    sc += 12 if event(text) != "PROJECT UPDATE" else 0
    return sc + source_bonus(story["source"], story["source_url"])


def chunk_names(names):
    chunks = []
    current = []
    chars = 0
    for name in names:
        safe = name.replace('"', "").strip()
        add = len(safe) + 7
        if current and (len(current) >= BATCH_SIZE or chars + add > MAX_BATCH_CHARS):
            chunks.append(current)
            current = []
            chars = 0
        current.append(safe)
        chars += add
    if current:
        chunks.append(current)
    return chunks


def queries(projects):
    qs = list(BROAD_QUERIES) + list(SOURCE_QUERIES)
    for category in ("solar", "bess"):
        names = [p["name"] for p in projects if p["technology"] == category]
        suffix = "solar UK" if category == "solar" else '"battery storage" UK'
        for group in chunk_names(names):
            ors = " OR ".join('"' + x + '"' for x in group)
            qs.append("(" + ors + ") " + suffix)
    # preserve order while removing accidental duplicate queries
    return list(dict.fromkeys(qs))


def collect(projects):
    raw = []
    seen = set()
    qs = queries(projects)
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(fetch_rss, q): q for q in qs}
        for future in as_completed(futures):
            try:
                rows = future.result()
            except Exception as exc:
                print("WARN", futures[future][:160], exc)
                continue
            for story in rows:
                key = (norm(story["title"]), story["source_url"] or story["source"])
                if story["link"] not in seen and key not in seen:
                    seen.add(story["link"])
                    seen.add(key)
                    raw.append(story)

    matches = []
    global_seen = set()
    rejected = 0
    for project in projects:
        candidates = []
        for story in raw:
            if not gate(project, story):
                rejected += 1
                continue
            sc = score(project, story)
            if sc >= MIN_SCORE:
                candidates.append((story["published"].timestamp(), sc, story))
        candidates.sort(reverse=True, key=lambda x: (x[0], x[1]))
        kept = 0
        for _, sc, story in candidates:
            headline_key = norm(story["title"])
            if not headline_key or headline_key in global_seen:
                continue
            global_seen.add(headline_key)
            matches.append(
                {
                    "project_id": project["repd_ref"],
                    "repd_ref": project["repd_ref"],
                    "repd_record_updated": project["repd_record_updated"],
                    "planning_application_reference": project["planning_application_reference"],
                    "project": project["name"],
                    "technology": project["technology"],
                    "capacity_mw": project["capacity_mw"],
                    "operator": project["operator"],
                    "county": project["county"],
                    "status": project["status"],
                    "event": event(story["title"] + " " + story["description"]),
                    "headline": re.sub(r"\s+-\s+[^-]{2,80}$", "", story["title"]).strip(),
                    "published": story["published"].date().isoformat(),
                    "source": story["source"] or "Google News",
                    "source_url": story["source_url"],
                    "url": story["link"],
                    "confidence": min(100, int(sc)),
                }
            )
            kept += 1
            if kept >= MAX_PER_PROJECT:
                break

    matches.sort(key=lambda x: (x["published"], x["confidence"], x["capacity_mw"]), reverse=True)
    print("queries", len(qs), "raw", len(raw), "rejected", rejected, "matches", len(matches))
    return matches[:MAX_HEADLINES], rejected, len(qs), len(raw)


def main():
    projects = load_projects()
    manifest = load_manifest()
    now = datetime.now(timezone.utc).isoformat()
    public_projects = [{k: v for k, v in p.items() if not k.startswith("_")} for p in projects]
    solar_count = sum(1 for p in public_projects if p["technology"] == "solar")
    bess_count = sum(1 for p in public_projects if p["technology"] == "bess")
    source_meta = {
        "owner": manifest.get("source_owner", "Department for Energy Security and Net Zero (DESNZ)"),
        "page": manifest.get("source_page"),
        "csv": manifest.get("source_url"),
        "excel": manifest.get("source_excel_url"),
        "edition": manifest.get("source_dataset_title"),
        "page_last_updated": manifest.get("source_page_last_updated"),
        "master_last_sync": manifest.get("last_sync"),
    }

    PROJECTS_OUT.write_text(
        json.dumps(
            {
                "schema": "globalgrid2050.major-projects.v6",
                "updated": now,
                "thresholds": {"solar_mw_exclusive": SOLAR_MIN_EXCLUSIVE, "bess_mw_exclusive": BESS_MIN_EXCLUSIVE},
                "count": len(public_projects),
                "solar_count": solar_count,
                "bess_count": bess_count,
                "repd_bound": True,
                "source": source_meta,
                "projects": public_projects,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    headlines, rejected, query_count, raw_count = collect(projects)
    official_count = sum(
        1
        for item in headlines
        if any(x in norm(item.get("source", "") + " " + item.get("source_url", "")) for x in ("gov uk", "planning inspectorate", "planninginspectorate"))
    )
    NEWS_OUT.write_text(
        json.dumps(
            {
                "schema": "globalgrid2050.major-project-news.v6",
                "updated": now,
                "lookback_days": LOOKBACK_DAYS,
                "news_horizon_days": LOOKBACK_DAYS,
                "crawl_target_minutes": 3,
                "thresholds": {"solar_mw_exclusive": SOLAR_MIN_EXCLUSIVE, "bess_mw_exclusive": BESS_MIN_EXCLUSIVE},
                "eligible_projects": len(projects),
                "eligible_solar": solar_count,
                "eligible_bess": bess_count,
                "headline_count": len(headlines),
                "official_source_headlines": official_count,
                "priority_sources": list(PRIORITY_SOURCES),
                "repd_bound": True,
                "repd_edition": source_meta.get("edition"),
                "repd_source_page_last_updated": source_meta.get("page_last_updated"),
                "repd_source_url": source_meta.get("csv"),
                "quality_gate": "official REPD Ref ID + official record update date + project identity + UK/location veto + energy context + generic-name corroboration",
                "rejected_candidates": rejected,
                "query_count": query_count,
                "raw_story_count": raw_count,
                "method": "DESNZ REPD eligibility -> six-month concurrent discovery -> official project binding -> identity/location gates -> scoring -> dedupe",
                "items": headlines,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("eligible", len(projects), "solar", solar_count, "bess", bess_count, "headlines", len(headlines), "official", official_count)


if __name__ == "__main__":
    main()
