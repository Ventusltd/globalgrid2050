#!/usr/bin/env python3
"""Hourly link-only news screening for the GlobalGrid2050 Energy24 candidate.

No article bodies, publisher images or scraped site pages are republished.
Only qualified links and original short headlines are stored. This is a deterministic
rule-based scanner, NOT an LLM fact checker or automatic assertion of capital spend.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

SCHEMA = "globalgrid2050.energy24.news.v1"
PUBLISHERS = (
    {"id": "desnz", "name": "UK Department for Energy Security and Net Zero",
     "url": "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom",
     "domain": "www.gov.uk", "tier": "official"},
    {"id": "dcd", "name": "Data Center Dynamics",
     "url": "https://www.datacenterdynamics.com/rss/",
     "domain": "www.datacenterdynamics.com", "tier": "attributed"},
    {"id": "storage", "name": "Energy-Storage.news",
     "url": "https://www.energy-storage.news/feed/",
     "domain": "www.energy-storage.news", "tier": "attributed"},
    {"id": "pv", "name": "pv magazine",
     "url": "https://www.pv-magazine.com/feed/",
     "domain": "www.pv-magazine.com", "tier": "attributed"},
)
MARKETS = {
    "London": "Europe/London",
    "New York": "America/New_York",
    "San Francisco": "America/Los_Angeles",
    "Hong Kong": "Asia/Hong_Kong",
    "Tokyo": "Asia/Tokyo",
    "Sydney": "Australia/Sydney",
}
REPD_RE = re.compile(r"\bREPD(?:\s+(?:ref(?:erence)?|id))?\s*[:#\-]?\s*(\d{3,8})\b", re.I)
MW_RE = re.compile(r"(?<![\w.])([\d,]+(?:\.\d+)?)\s*(GW(?:p|ac|dc)?|MW(?:p|ac|dc)?|gigawatts?|megawatts?)\b", re.I)
USD_RE = re.compile(r"(?<!\w)(?:US\s*)?\$\s*([\d,.]+)\s*(trillion|billion|million|tn|bn|m)\b", re.I)
SECTOR_RE = re.compile(r"\b(solar|photovoltaic|battery|bess|energy storage|wind|wind farm|wind power|grid|electricity|substation|transmission|renewable|power plant|data cent(?:er|re)|hyperscale|cloud infrastructure|nuclear)\b", re.I)
DC_RE = re.compile(r"\b(data cent(?:er|re)s?|hyperscal(?:e|er)|colocation|colo campus|server farm)\b", re.I)
AI_RE = re.compile(r"\b(artificial intelligence|AI|ai infrastructure|ai computing|hyperscal(?:e|er)|cloud computing|gpu cluster|data cent(?:er|re)|compute infrastructure)\b", re.I)
CYBER_RE = re.compile(r"\b(cyber(?:security|attack|incident)|ransomware|malware|data breach|critical infrastructure outage|cloud outage|resilience incident)\b", re.I)
ETHICS_RE = re.compile(r"\b(ethics|accountability|data privacy|human rights|governance|safety investigation|regulator|enforcement)\b", re.I)
UNCERTAIN_RE = re.compile(r"\b(rumo[u]?r|unconfirmed|allegedly|sponsored|advertorial|paid partnership)\b", re.I)
BAD_WORDS = frozenset(("fuck","fucking","shit","cunt","motherfucker","bullshit"))
ASSET_TECH_RE = re.compile(r"\b(bess|battery|solar|wind|energy storage|power plant|renewable)\b", re.I)
CORPORATE_FINANCE_RE = re.compile(r"\b(?:(?:buys?|acquires?|purchases?)\b.{0,90}\b(?:stake|shares|equity)\b|holdco\b.{0,40}\b(?:facility|loan)\b|share purchase|buyout|takeover)\b", re.I)
# A reported financing round, equity investment or corporate credit line is not
# project CAPEX. Require explicit construction/project expenditure language in
# the publisher headline before treating USD as a headline qualification.
PROJECT_CAPEX_RE = re.compile(
    r"\\b(?:capex|capital expenditure|construction (?:budget|cost|spend)|"
    r"project (?:budget|cost|capex)|development (?:budget|cost)|"
    r"cost to build|invests?\\b.{0,65}\\b(?:to build|to construct|in (?:a |new )?(?:solar|battery|bess|data cent(?:er|re)|campus|power plant))|"
    r"commits?\\b.{0,65}\\b(?:to build|to construct|for construction))\\b",
    re.I,
)
# A company-wide annual target is not the size of an identified project.
ANNUAL_TARGET_RE = re.compile(
    r"\\b(?:target(?:s|ing)?|aims?|plans?)\\b.{0,45}\\b\\d[\\d,.]*\\s*(?:GW|MW)\\b.{0,25}\\b(?:annually|per year|a year)\\b",
    re.I,
)
URL_ALLOWED = frozenset(("www.gov.uk","gov.uk","www.datacenterdynamics.com","datacenterdynamics.com",
                         "www.energy-storage.news","energy-storage.news","www.pv-magazine.com","pv-magazine.com"))
MIN_CAPEX_USD = 25_000_000
MIN_PROJECT_MW = 50
MAX_AGE_DAYS = 14
MAX_FEED_BYTES = 2_000_000


def normalise_ws(s: str) -> str:
    return " ".join(html.unescape(str(s)).split()).strip()


def clean_title(s: str) -> str:
    s = re.sub(r"<[^>]*>", " ", s or "")
    return normalise_ws(s)[:260]


def family_safe(title: str) -> bool:
    words = re.findall(r"[A-Za-z]+", title.casefold())
    return not (set(words) & BAD_WORDS)


def safe_url(raw: str) -> str | None:
    try:
        url = urlparse((raw or "").strip())
        if url.scheme != "https" or url.username or url.password or not url.hostname:
            return None
        host = url.hostname.lower()
        if host not in URL_ALLOWED or url.port not in (None, 443):
            return None
        clean = url._replace(fragment="", query=urlencode(
            [(k, v) for k, v in parse_qsl(url.query) if not k.lower().startswith("utm_")]))
        return urlunparse(clean)
    except ValueError:
        return None


def parse_date(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = parsedate_to_datetime(raw)
        except (ValueError, TypeError, IndexError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def official_repd_csv(path: Path, expected_count: int = 14967) -> dict[str, dict[str, str]]:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Cannot decode official REPD candidate")
    from io import StringIO
    reader = csv.DictReader(StringIO(text, newline=""))
    if not reader.fieldnames or "Ref ID" not in reader.fieldnames or len(reader.fieldnames) != 53:
        raise ValueError("REPD source schema mismatch: expected exact 53 columns")
    out: dict[str, dict[str, str]] = {}
    for row in reader:
        ref = (row.get("Ref ID") or "").strip()
        if not re.fullmatch(r"\d+", ref) or ref in out:
            raise ValueError("Candidate Ref ID missing or duplicated: " + ref)
        out[ref] = row
    if len(out) != expected_count:
        raise ValueError(f"REPD exact identity count mismatch: found {len(out)}, expected {expected_count}")
    return out


def money_usd(text: str) -> int | None:
    amounts = []
    for match in USD_RE.finditer(text or ""):
        factor = {"m":1e6,"million":1e6,"bn":1e9,"billion":1e9,"tn":1e12,"trillion":1e12}[match.group(2).lower()]
        try:
            amount = float(match.group(1).replace(",", "")) * factor
        except ValueError:
            continue
        if 0 < amount < 1e15:
            amounts.append(round(amount))
    return max(amounts) if amounts else None


def capacity_mw(text: str) -> float | None:
    values = []
    for match in MW_RE.finditer(text or ""):
        unit = match.group(2).lower()
        multiplier = 1000 if unit.startswith("g") else 1
        try:
            v = float(match.group(1).replace(",","")) * multiplier
        except ValueError:
            continue
        if 0 < v < 100_000:
            values.append(v)
    return max(values) if values else None


def xml_value(node: ET.Element, names: tuple[str, ...]) -> str:
    for child in node:
        if child.tag.rsplit("}", 1)[-1] in names:
            if child.tag.rsplit("}", 1)[-1] == "link":
                if child.attrib.get("href"):
                    return child.attrib["href"]
            val = "".join(child.itertext()).strip()
            if val:
                return val
    return ""


def parse_feed(xml_bytes: bytes, publisher: dict) -> list[dict]:
    if len(xml_bytes) > MAX_FEED_BYTES:
        raise ValueError("Overlarge feed: " + publisher["id"])
    root = ET.fromstring(xml_bytes)
    items = [n for n in root.iter() if n.tag.rsplit("}", 1)[-1] in ("item", "entry")]
    records = []
    for n in items[:160]:
        title = clean_title(xml_value(n, ("title",)))
        link = safe_url(xml_value(n, ("link",)))
        published = parse_date(xml_value(n, ("pubDate", "published", "updated", "date")))
        if not title or not link or not published:
            continue
        records.append({
            "headline": title, "url": link, "published": published,
            "context": clean_title(xml_value(n, ("description", "summary"))),
            "publisher": publisher
        })
    return records


class TrustedPublisherRedirect(HTTPRedirectHandler):
    """Reject off-allowlist redirects before making any network request."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if safe_url(newurl) is None:
            raise ValueError("Publisher redirect outside HTTPS host allowlist")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_feed(publisher: dict) -> bytes:
    request = Request(publisher["url"], headers={
        "User-Agent": "GlobalGrid2050-Energy24/1.0 (public source-URL screening; link-only)",
        "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml"
    })
    with build_opener(TrustedPublisherRedirect()).open(request, timeout=18) as response:
        final_url = safe_url(response.geturl())
        if final_url is None:
            raise ValueError("Feed redirected outside a trusted HTTPS publisher")
        payload = response.read(MAX_FEED_BYTES + 1)
        if len(payload) > MAX_FEED_BYTES:
            raise ValueError("Publisher feed exceeded byte limit")
        return payload


def region_for_title(text: str, publisher_id: str) -> str:
    if publisher_id == "desnz":
        return "UK"
    if re.search(r"\b(UK|British|Britain|England|Scotland|Wales|London|Sunderland|Birmingham)\b", text):
        return "UK"
    if re.search(r"\b(United States|US |USA|Texas|California|New York|Virginia|Nevada|Ohio)\b", text):
        return "USA"
    if re.search(r"\b(Australia|Sydney|Melbourne|Queensland|Victoria|Perth)\b", text):
        return "Australia"
    if re.search(r"\b(Japan|Tokyo)\b", text):
        return "Japan"
    if re.search(r"\b(Hong Kong|China|Singapore|Taiwan|South Korea)\b", text):
        return "Asia"
    if re.search(r"\b(Germany|Netherlands|France|Spain|Poland|Italy)\b", text):
        return "Europe"
    return "Unspecified"


def classify(item: dict, repd: dict, now: datetime) -> tuple[dict | None, str]:
    title, url = item["headline"], item["url"]
    published, source = item["published"], item["publisher"]
    if published > now + timedelta(hours=1) or published < now - timedelta(days=MAX_AGE_DAYS):
        return None, "stale_or_future"
    if not family_safe(title):
        return None, "unprofessional_headline"
    if UNCERTAIN_RE.search(title):
        return None, "sponsored_or_unconfirmed"
    context = title + " " + item["context"][:380]
    if not (SECTOR_RE.search(title) or AI_RE.search(title) or CYBER_RE.search(title)):
        return None, "outside_sector"
    ids = set(REPD_RE.findall(context))
    ref = next(iter(ids)) if len(ids) == 1 else None
    if len(ids) > 1:
        return None, "ambiguous_repd_refs"
    reported_usd = money_usd(title) or money_usd(item["context"])
    # Never publish a finance amount as project CAPEX without explicit
    # construction/project spending evidence in the actual headline.
    capex = reported_usd if PROJECT_CAPEX_RE.search(title) else None
    mw = capacity_mw(title) or capacity_mw(item["context"])
    if ANNUAL_TARGET_RE.search(title):
        mw = None
    # Preserve a distinct, auditable rejection reason for finance-only
    # equity and holding-company transactions, even when no CAPEX qualifies.
    if not ref and reported_usd is not None and (mw is None or mw < MIN_PROJECT_MW) and CORPORATE_FINANCE_RE.search(title):
        return None, "corporate_financing_not_project_capex"
    dc = bool(DC_RE.search(title))
    cyber = bool(CYBER_RE.search(title))
    ethics = bool(ETHICS_RE.search(title))
    ai = bool(AI_RE.search(title))
    if ref:
        if ref not in repd:
            return None, "unknown_repd_ref"
        official_mw_text = (repd[ref].get("Installed Capacity (MWelec)") or "").strip()
        try:
            official_mw = float(official_mw_text)
        except ValueError:
            return None, "repd_capacity_missing"
        if official_mw < MIN_PROJECT_MW:
            return None, "below_50mw"
        cat = "uk-repd"
        mw = official_mw
    else:
        if cyber:
            cat = "cybersecurity"
        elif ethics and (SECTOR_RE.search(context) or ai):
            cat = "ethics"
        elif dc and not ASSET_TECH_RE.search(title):
            # A BESS powering a data centre is still a BESS project. A mention
            # of a hyperscaler must not turn its headline into a facility claim.
            cat = "data-centres"
        elif ai and capex is not None:
            cat = "ai-investment"
        else:
            cat = "global-projects"
        if cat in ("cybersecurity", "ethics"):
            # Unquantified matters are a clearly labelled policy/watch category,
            # never a project or an alleged REPD incident.
            if not (CYBER_RE.search(title) or ETHICS_RE.search(title)):
                return None, "strategic_topic_only_in_summary"
            if not (SECTOR_RE.search(context) or ai):
                return None, "strategic_not_energy"
        elif (mw is None or mw < MIN_PROJECT_MW) and (capex is None or capex < MIN_CAPEX_USD):
            return None, "below_or_unverified_threshold"
        if capex is not None and (mw is None or mw < MIN_PROJECT_MW) and CORPORATE_FINANCE_RE.search(title):
            # A transaction in a developer's equity or holding company is NOT
            # automatically a $25m project expenditure. Hold in finance review.
            return None, "corporate_financing_not_project_capex"
    # A reported USD figure is evidence attributed to the named publication.
    # No USD estimate is invented for articles in other currencies.
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()
    record = {
        "id": key,
        "headline": title,
        "url": url,
        "source": source["name"],
        "published_utc": published.isoformat().replace("+00:00", "Z"),
        "category": cat,
        "region": region_for_title(title, source["id"]),
        "repd_ref": ref,
        "capacity_mw": mw,
        "capex_usd": capex,
        "evidence_tier": source["tier"],
        "strategic_context": cat in ("cybersecurity", "ethics"),
        "source_type": "official_feed" if source["tier"] == "official" else "publisher_feed",
        "qualification": "repd_exact_ref" if ref else "USD_CAPEX" if capex and capex >= MIN_CAPEX_USD else "MW_CAPACITY" if mw and mw >= MIN_PROJECT_MW else "STRATEGIC_WATCH",
    }
    priority = (80 if cat == "uk-repd" else 70 if cat == "data-centres" else 50 if cat == "ai-investment" else 35 if cat == "global-projects" else 20)
    if source["tier"] == "official":
        priority += 20
    priority += max(0, min(14, 14-(now-published).days))
    record["priority"] = priority
    return record, "accepted"


def local_market_times(now: datetime) -> dict[str, str]:
    return {city: now.astimezone(ZoneInfo(tz)).isoformat(timespec="minutes")
            for city, tz in MARKETS.items()}


def build_snapshot(repd: dict, feeds: list[tuple[dict, bytes | Exception]], now: datetime) -> tuple[dict, dict]:
    records, seen_links, seen_titles = [], set(), set()
    rejects: dict[str, int] = {}
    source_health = []
    for publisher, feed in feeds:
        if isinstance(feed, Exception):
            source_health.append({"id": publisher["id"], "status": "FAILED", "count": 0, "error": str(feed)[:160]})
            continue
        try:
            items = parse_feed(feed, publisher)
        except (ET.ParseError, ValueError) as exc:
            source_health.append({"id": publisher["id"], "status": "FAILED", "count": 0, "error": str(exc)[:160]})
            continue
        source_health.append({"id": publisher["id"], "status": "OK", "count": len(items)})
        for item in items:
            rec, reason = classify(item, repd, now)
            if rec is None:
                rejects[reason] = rejects.get(reason, 0) + 1
                continue
            title_key = re.sub(r"[^a-z0-9]+", "", rec["headline"].casefold())
            if rec["url"] in seen_links or title_key in seen_titles:
                rejects["duplicate"] = rejects.get("duplicate", 0) + 1
                continue
            seen_links.add(rec["url"]); seen_titles.add(title_key)
            records.append(rec)
    records.sort(key=lambda x: (-x["priority"], -parse_date(x["published_utc"]).timestamp(), x["id"]))
    stamp = now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    snapshot = {
        "schema": SCHEMA,
        "generated_utc": stamp,
        "release": "2026q3",
        "source_repd_identity_count": len(repd),
        "sources": [{k:v for k,v in x.items() if k != "error"} for x in source_health],
        "articles": records[:100],
    }
    audit = {
        "schema": "globalgrid2050.energy24.news-audit.v1",
        "generated_utc": stamp,
        "markets": local_market_times(now),
        "sources": source_health,
        "accepted": len(records),
        "published": len(snapshot["articles"]),
        "rejected": rejects,
        "thresholds": {"min_repd_mw":50,"min_reported_capex_usd":25_000_000,
                       "strategic_topics": ["cybersecurity","ethics"],
                       "fx_conversion": "none; other currencies require separate review"},
        "identity_rule": "Exact REPD Ref ID and official Q3 membership only. No name-based link.",
        "rights": "Publisher link and short headline only. No article body, image or full synopsis.",
    }
    return snapshot, audit


def select_validated_release(repo_root: Path, release_id: str = "auto") -> tuple[str, Path, int]:
    """Choose newest descriptor with a locally committed cleaned REPD dataset.

    This does not follow the latest gov.uk URL or silently advance a production
    pointer. A future REPD quarter must first have a pinned descriptor, validated
    candidate file and owner release process.
    """
    release_dir = repo_root / "automation/repd/releases"
    descriptors = []
    for file in sorted(release_dir.glob("20??q[1-4].json")):
        info = json.loads(file.read_text(encoding="utf-8"))
        key = info.get("release_id", "")
        if info.get("schema") != "globalgrid2050.repd-release-descriptor.v1":
            continue
        if not re.fullmatch(r"20\d{2}q[1-4]", key):
            continue
        if release_id != "auto" and release_id != key:
            continue
        candidate = repo_root / ("repd-" + key + ".csv")
        if not candidate.is_file():
            continue
        count = info.get("expected", {}).get("unique_refs")
        if type(count) is not int or count <= 0:
            continue
        descriptors.append((key, candidate, count))
    if not descriptors:
        raise ValueError("No approved local REPD version has a matching descriptor and candidate")
    # Quarter ids are chronologically sortable; never select a January root CSV.
    return max(descriptors, key=lambda x: x[0])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repd", default="", help="Explicit validated full REPD CSV (optional)")
    parser.add_argument("--release-id", default="auto", help="Committed quarter id or auto")
    parser.add_argument("--repo-root", default=".")

    parser.add_argument("--out", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--offline-fixtures", default="")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    if args.repd:
        selected_id = args.release_id if args.release_id != "auto" else "2026q3"
        expected = select_validated_release(Path(args.repo_root), selected_id)[2]
        path = Path(args.repd)
    else:
        selected_id, path, expected = select_validated_release(Path(args.repo_root), args.release_id)
    repd = official_repd_csv(path, expected)
    feeds = []
    for publisher in PUBLISHERS:
        try:
            data = (Path(args.offline_fixtures) / (publisher["id"] + ".xml")).read_bytes() if args.offline_fixtures else fetch_feed(publisher)
        except Exception as exc:
            data = exc
        feeds.append((publisher, data))
    snapshot, audit = build_snapshot(repd, feeds, now)
    snapshot["release"] = selected_id
    audit["release"] = selected_id
    audit["validated_repd_file"] = str(path)
    failed = sum(s["status"] == "FAILED" for s in audit["sources"])
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.audit).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    Path(args.audit).write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"REPD {len(repd)} refs | feed failures {failed}/{len(PUBLISHERS)} | headlines {len(snapshot['articles'])}")
    if failed == len(PUBLISHERS):
        print("FAIL CLOSED: no source feed available; do not publish this run", file=sys.stderr)
        return 1
    if not snapshot["articles"]:
        print("FAIL CLOSED: zero qualified headlines; preserve previous known-good snapshot", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
