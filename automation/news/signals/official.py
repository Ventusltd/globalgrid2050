#!/usr/bin/env python3
"""Official-source signals for the 200 largest solar projects in the REPD (team "official").

For each project in top200_solar.json, with the press alias from aliases.json, this asks sources that permit
automated access and keeps headlines, links and dates only (never page text):

  pins-register   the Planning Inspectorate's national infrastructure project list (one CSV download), matched on the
                  project reference (EN01xxxx) and, failing that, on the alias; gives the stage and milestone dates
  govuk-search    the GOV.UK search API (https://www.gov.uk/api/search.json): exact alias phrase, and the planning
                  reference where the project has a national one; decision pages for development consent, notices
  ecu-case        the Scottish Energy Consents Unit case page for an ECU reference (title and existence)

Output (see SIGNALS-CONTRACT.md, "project-signals-part.v1"): items {repd_ref, title, link, publisher, date, family
"official", basis, confidence} and one health record per source. One failing source never stops a run; the exit code
is non-zero only when every source failed.

Politeness: a descriptive User-Agent, at most one request a second per host, a per-run cap per host, one retry after
ten seconds on HTTP 429, 20 second timeouts.

  python automation/news/signals/official.py --out part-official.json [--probe summary.md] [--limit N]
  python automation/news/signals/official.py --discover summary.md      (prints what each source returns; CI aid)
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))

if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import dates as DATES  # noqa: E402  one date rule shared by the collectors and the combiner
import gate as GATE  # noqa: E402  the title gate shared with trade.py, index.py and combine.py
import datacentre_feed as D  # noqa: E402  clean_text, canonical_link, parse_date

SCHEMA_PART = "project-signals-part.v1"
USER_AGENT = "GlobalGrid2050-ProjectSignals/1.0 (+https://globalgrid2050.com)"
TIMEOUT_S = 20
MAX_BYTES = 6_000_000
MIN_INTERVAL_S = 1.0
HOST_CAP = 450
TITLE_LIMIT = 300

PINS_HOST = "https://national-infrastructure-consenting.planninginspectorate.gov.uk"
PINS_CSV = PINS_HOST + "/api/applications-download"
PINS_PROJECT = PINS_HOST + "/projects/{ref}"
GOVUK_SEARCH = "https://www.gov.uk/api/search.json"
ECU_CASE = "https://www.energyconsents.scot/ApplicationDetails.aspx?cr={ref}"

PINS_REF_RE = re.compile(r"\bEN0\d{5,6}\b", re.I)
ECU_REF_RE = re.compile(r"\bECU\d{8}\b", re.I)
NATIONAL_REF_RE = re.compile(r"\b(?:EN0\d{5,6}|ECU\d{8}|DNS/\d{7}|CAS-\d{5}-[A-Z0-9]{6})\b", re.I)
TOPIC_RE = re.compile(r"\b(solar|photovoltaic|pv|energy|renewables?|battery|development consent)\b", re.I)
DISTINCTIVE_RE = re.compile(r"\b(solar|photovoltaic|pv|energy|renewables?)\b", re.I)


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- fetching

class FetchError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


_CONTEXTS = {}      # host -> ssl context completed with the issuer certificate, or None when that failed


def _completed_context(host, opener=urllib.request.urlopen):
    """For a server that does not send its intermediate certificate (the Energy Consents Unit site): read the
    issuer's address from the server certificate (Authority Information Access), fetch that one certificate and
    add it to a normal verifying context. Verification is never switched off: the chain must still end at a
    trusted root, so a wrong or forged issuer certificate simply fails as before."""
    import os
    import ssl
    import tempfile
    pem = ssl.get_server_certificate((host, 443), timeout=TIMEOUT_S)        # read only, nothing trusted yet
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as handle:
        handle.write(pem)
    try:
        info = ssl._ssl._test_decode_cert(handle.name)                      # noqa: SLF001  the only stdlib decoder
    finally:
        os.unlink(handle.name)
    context = ssl.create_default_context()
    added = 0
    for issuer in info.get("caIssuers") or ():
        if not issuer.lower().startswith(("http://", "https://")):
            continue
        req = urllib.request.Request(issuer, headers={"User-Agent": USER_AGENT})
        with opener(req, timeout=TIMEOUT_S) as response:                    # noqa: S310
            data = response.read(200_000)
        context.load_verify_locations(cadata=data.decode("ascii") if data.lstrip().startswith(b"-----BEGIN")
                                      else ssl.DER_cert_to_PEM_cert(data))
        added += 1
    if not added:
        raise FetchError("server certificate names no issuer address")
    return context


def _incomplete_chain(exc):
    return "CERTIFICATE_VERIFY_FAILED" in str(exc) and "local issuer" in str(exc)


def _open(url, accept):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept,
                                               "Accept-Language": "en-GB,en;q=0.8"})
    host = urllib.parse.urlsplit(url).hostname or ""
    context = _CONTEXTS.get(host)
    try:
        response = urllib.request.urlopen(req, timeout=TIMEOUT_S, context=context)  # noqa: S310 (https URLs built here)
    except urllib.error.HTTPError:
        raise
    except urllib.error.URLError as exc:
        if not _incomplete_chain(exc) or host in _CONTEXTS:
            raise
        try:
            _CONTEXTS[host] = _completed_context(host)
        except Exception as inner:  # noqa: BLE001
            _CONTEXTS[host] = None
            raise FetchError("the server sends an incomplete certificate chain and its issuer certificate could not "
                             "be fetched (%s); not fetched, verification stays on" % type(inner).__name__) from None
        response = urllib.request.urlopen(req, timeout=TIMEOUT_S, context=_CONTEXTS[host])  # noqa: S310
    with response:
        return response.status, response.geturl(), response.headers.get("Content-Type", ""), \
            response.read(MAX_BYTES + 1)[:MAX_BYTES]


class Fetcher:
    """One request a second per host, a cap per host, one retry after ten seconds on HTTP 429."""

    def __init__(self, opener=_open, sleep=time.sleep, clock=time.monotonic, min_interval=MIN_INTERVAL_S,
                 host_cap=HOST_CAP):
        self.opener, self.sleep, self.clock = opener, sleep, clock
        self.min_interval, self.host_cap = min_interval, host_cap
        self.last = {}
        self.count = {}
        self.down = {}          # host -> error, after a timeout or connection failure: not asked again this run

    def _wait(self, host):
        if self.count.get(host, 0) >= self.host_cap:
            raise FetchError("per-run cap of %d requests reached for %s" % (self.host_cap, host))
        previous = self.last.get(host)
        if previous is not None:
            gap = self.min_interval - (self.clock() - previous)
            if gap > 0:
                self.sleep(gap)
        self.last[host] = self.clock()
        self.count[host] = self.count.get(host, 0) + 1

    def get(self, url, accept="*/*"):
        """Returns (final_url, content_type, bytes). Raises FetchError."""
        host = urllib.parse.urlsplit(url).hostname or ""
        if not url.startswith("https://") or not host:
            raise FetchError("not an https URL")
        if host in self.down:
            raise FetchError(self.down[host])
        for attempt in (0, 1):
            self._wait(host)
            try:
                status, final, ctype, body = self.opener(url, accept)
                if status != 200:
                    raise FetchError("HTTP %s" % status, status)
                return final, ctype, body
            except urllib.error.HTTPError as exc:
                if exc.code == 429 and attempt == 0:
                    self.sleep(10)
                    continue
                raise FetchError("HTTP %s" % exc.code, exc.code) from None
            except FetchError:
                raise
            except Exception as exc:  # noqa: BLE001  URLError, timeouts, TLS, reset: all one failed request
                self.down[host] = "%s: %s" % (type(exc).__name__, str(exc)[:120])
                raise FetchError(self.down[host]) from None
        raise FetchError("HTTP 429", 429)


def health(source_id, url):
    return {"id": source_id, "url": url, "status": "ok", "requests": 0, "failures": 0, "items": 0, "error": ""}


def close_health(record):
    if record["requests"] == 0:
        record["status"] = "ok" if not record["error"] else "failed"
    elif record["failures"] >= record["requests"]:
        record["status"] = "failed"
    elif record["failures"]:
        record["status"] = "partial"
    return record


# ---------------------------------------------------------------- inputs

def load_projects(top_path=None, alias_path=None):
    """The 200 projects, each merged with its alias entry. Without an alias entry a derived alias is used."""
    top = json.loads(Path(top_path or HERE / "top200_solar.json").read_text(encoding="utf-8"))
    alias_file = Path(alias_path or HERE / "aliases.json")
    table = json.loads(alias_file.read_text(encoding="utf-8")).get("projects", {}) if alias_file.exists() else {}
    projects = []
    for row in top:
        ref = str(row["repd_ref"])
        entry = table.get(ref, {})
        aliases = [a for a in entry.get("aliases", []) if a and a.strip()]
        status = entry.get("alias_status", "derived")
        if not aliases:
            aliases, status = [derive_alias(row["site_name"])], "derived"
        projects.append({
            "repd_ref": ref, "rank": row["rank"], "site_name": row["site_name"].strip(),
            "operator": (row.get("operator") or "").strip(), "mw": row.get("mw"),
            "county": (row.get("county") or "").strip(), "country": row.get("country") or "",
            "planning_authority": (row.get("planning_authority") or "").strip(),
            "planning_ref": (row.get("planning_ref") or "").strip(),
            "aliases": aliases, "alias_status": status, "exclude": entry.get("exclude", []),
            "planning_file": entry.get("planning_file"),
        })
    return projects


TAIL_RE = re.compile(
    r"\s*(?:[-–,(]\s*)?(?:&|and|with|\+)?\s*\b(?:solar (?:farm|park|panels?|array|pv farm|photovoltaic array|project)"
    r"|battery(?: energy)? storage(?: system| facility)?|energy storage(?: facility| park)?|bess|co-?located"
    r"|phase \d+|solar)\b.*$", re.I)


def derive_alias(site_name):
    """"Springwell, Lincoln - Springwell Solar Farm & Battery Storage" -> "Springwell Solar Farm"."""
    name = " ".join(site_name.split())
    if " - " in name:
        left, right = [p.strip() for p in name.split(" - ", 1)]
        generic = re.match(r"(?:solar|battery|energy storage|photovoltaic|pv)\b", right, re.I)
        name = left.split(",")[0].strip() if generic else right
    name = re.sub(r"\s*&\s*(?:battery|energy)\b.*$", "", name, flags=re.I).strip(" -,")
    name = re.sub(r"^the\s+", "", name, flags=re.I)
    if not DISTINCTIVE_RE.search(name):
        name += " Solar Farm"
    return name


# ---------------------------------------------------------------- matching (contract section 3)

def _norm(text):
    text = (text or "").lower().replace("&", " and ").replace("’", "'")
    return " ".join(re.sub(r"[^a-z0-9à-ÿ']+", " ", text).split())


def phrase_in(phrase, text):
    p, t = _norm(phrase), _norm(text)
    return bool(p) and re.search(r"(?<![a-z0-9])%s(?![a-z0-9])" % re.escape(p), t) is not None


def alias_core(alias):
    """The alias without a generic tail: "Botley West Solar Farm" -> "Botley West"."""
    core = re.sub(r"\s+(?:solar|energy|renewable|pv)\b.*$", "", alias, flags=re.I).strip()
    return core if len(core) >= 4 else alias


def _facts(project):
    facts = []
    for word in re.findall(r"[A-Za-z][A-Za-z']{3,}", project.get("operator", "")):
        if word.lower() not in {"limited", "energy", "solar", "renewables", "power", "development", "partners",
                                "holdings", "group", "farm", "green", "project", "developments", "storage"}:
            facts.append(word)
    if project.get("county"):
        facts.append(project["county"])
    return facts


def match(project, title, summary=""):
    """The module's own rule (_match), then the shared title gate (gate.py): a headline placed abroad or in another
    county, or a bare name without a solar term, is not this project. The whole alias is enough in an official title."""
    return GATE.gated(project, title, _match(project, title, summary), official=True)


def _match(project, title, summary=""):
    """(basis, confidence) when the item is tied to the project by the shared rule, else None."""
    text = "%s %s" % (title, summary)
    for phrase in project.get("exclude", []):
        if phrase_in(phrase, text):
            return None
    ref = project.get("planning_ref", "")
    if ref and NATIONAL_REF_RE.fullmatch(ref) and ref.lower() in text.lower():
        return "planning reference %s in the %s" % (ref, "title" if ref.lower() in title.lower() else "summary"), \
            "confirmed"
    confidence = "confirmed" if project.get("alias_status") == "confirmed" else "uncertain"
    for alias in project["aliases"]:
        distinctive = DISTINCTIVE_RE.search(alias) is not None
        if phrase_in(alias, title) and (distinctive or TOPIC_RE.search(text)):
            return "alias '%s' in the title" % alias, confidence
        core = alias_core(alias)
        if core != alias and len(_norm(core).split()) >= 2 and phrase_in(core, title) and TOPIC_RE.search(title):
            return "alias '%s' (as '%s') in the title with a solar or energy term" % (alias, core), confidence
        if phrase_in(alias, summary) and distinctive:
            for fact in _facts(project):
                if phrase_in(fact, text):
                    return "alias '%s' in the summary and '%s' agrees" % (alias, fact), confidence
    return None


def item(project, title, link, publisher, date, basis, confidence):
    link = D.canonical_link(link)
    title = D.clean_text(title, TITLE_LIMIT)
    if not link or not title:
        return None
    return {"repd_ref": project["repd_ref"], "title": title, "link": link, "publisher": publisher,
            "date": date, "family": "official", "basis": basis, "confidence": confidence}


# ---------------------------------------------------------------- source: Planning Inspectorate project list

DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d", "%d %B %Y", "%d %b %Y", "%d-%m-%Y", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M")


def parse_day(value):
    """A register date in any of its spellings -> YYYY-MM-DD, or None."""
    value = (value or "").strip()
    if not value:
        return None
    found = DATES.day(value)        # day first unless the value cannot be read that way; implausible years are None
    if found or re.match(r"\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}", value):
        return found
    iso = D.parse_date(value)
    if iso:
        return iso[:10]
    head = value.replace("Z", "").split(".")[0]
    for fmt in DATE_FORMATS:
        try:
            return dt.datetime.strptime(head, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_pins_csv(body):
    """Rows of the project list as dicts with: ref, name, applicant, stage, dates {column label: YYYY-MM-DD}."""
    text = body.decode("utf-8-sig", "replace") if isinstance(body, bytes) else body
    reader = csv.reader(io.StringIO(text))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        return []
    low = [h.lower() for h in header]

    def col(*needles):
        for needle in needles:
            for i, h in enumerate(low):
                if needle in h:
                    return i
        return None

    c_ref, c_name = col("project reference", "reference"), col("project name", "name")
    c_app, c_stage = col("applicant"), col("stage")
    if c_ref is None or c_name is None:
        raise ValueError("project list: no reference or name column in %r" % header[:8])
    date_cols = [i for i, h in enumerate(low) if h.startswith("date") and "anticipated" not in h]
    rows = []
    for raw in reader:
        if len(raw) <= max(c_ref, c_name):
            continue
        dates = {}
        for i in date_cols:
            day = parse_day(raw[i]) if i < len(raw) else None
            if day:
                dates[header[i]] = day
        rows.append({"ref": raw[c_ref].strip().upper(), "name": raw[c_name].strip(),
                     "applicant": raw[c_app].strip() if c_app is not None and c_app < len(raw) else "",
                     "stage": raw[c_stage].strip() if c_stage is not None and c_stage < len(raw) else "",
                     "dates": dates})
    return rows


def _milestone(label):
    label = re.sub(r"^date\s+(?:of\s+)?", "", label.strip(), flags=re.I)
    return label[:1].lower() + label[1:]


def pins_lookup(project, rows):
    """(row, how) for the project in the project list: by reference first, then by alias and applicant or topic."""
    ref = project.get("planning_ref", "").upper()
    if PINS_REF_RE.fullmatch(ref):
        for row in rows:
            if row["ref"] == ref:
                return row, "reference %s" % ref
    if "inspectorate" not in project.get("planning_authority", "").lower() and not PINS_REF_RE.fullmatch(ref):
        return None, ""
    for row in rows:
        for alias in project["aliases"]:
            if phrase_in(alias, row["name"]) or (len(_norm(alias_core(alias)).split()) >= 2
                                                 and phrase_in(alias_core(alias), row["name"])
                                                 and TOPIC_RE.search(row["name"])):
                return row, "alias '%s' is the register's project name '%s'" % (alias, row["name"])
    return None, ""


def pins_items(projects, rows, today):
    """One item per project found in the list: its newest milestone that is not in the future."""
    out, found = [], {}
    for project in projects:
        row, how = pins_lookup(project, rows)
        if not row:
            continue
        found[project["repd_ref"]] = row
        past = sorted(((day, label) for label, day in row["dates"].items() if day <= today), reverse=True)
        link = PINS_PROJECT.format(ref=row["ref"])
        if past:
            day, label = past[0]
            title = "%s: %s" % (row["name"], _milestone(label))
            if row["stage"]:
                title += " (stage: %s)" % row["stage"]
            basis = "Planning Inspectorate project list, %s; title composed from the list's '%s' and stage" % (
                how, label)
        else:
            day = None
            title = "%s: on the national infrastructure register%s" % (
                row["name"], " (stage: %s)" % row["stage"] if row["stage"] else "")
            basis = "Planning Inspectorate project list, %s; no dated milestone yet" % how
        made = item(project, title, link, "Planning Inspectorate", day, basis,
                    "confirmed" if how.startswith("reference") else "uncertain")
        if made:
            made["kind"] = "register_milestone"
            out.append(made)
    return out, found


def source_pins(projects, fetcher, today):
    record = health("pins-register", PINS_CSV)
    rows = []
    record["requests"] += 1
    try:
        _, _, body = fetcher.get(PINS_CSV, "text/csv, */*")
        rows = parse_pins_csv(body)
        if not rows:
            raise ValueError("project list is empty")
    except (FetchError, ValueError) as exc:
        record["failures"] += 1
        record["error"] = str(exc)[:200]
        return [], close_health(record), {}
    items, found = pins_items(projects, rows, today)
    record["items"] = len(items)
    record["rows"] = len(rows)
    return items, close_health(record), found


# ---------------------------------------------------------------- source: GOV.UK search API

GOVUK_FIELDS = ("title", "link", "public_timestamp", "organisations", "format", "description")


def govuk_url(query, count=20):
    params = [("q", query), ("count", str(count)), ("order", "-public_timestamp")]
    params += [("fields", f) for f in GOVUK_FIELDS]
    return GOVUK_SEARCH + "?" + urllib.parse.urlencode(params)


def govuk_results(body):
    data = json.loads(body.decode("utf-8", "replace") if isinstance(body, bytes) else body)
    out = []
    for r in data.get("results", []):
        link = r.get("link") or ""
        if link.startswith("/"):
            link = "https://www.gov.uk" + link
        orgs = [o.get("title") for o in (r.get("organisations") or []) if isinstance(o, dict) and o.get("title")]
        out.append({"title": r.get("title") or "", "link": link, "summary": r.get("description") or "",
                    "date": DATES.day(r.get("public_timestamp") or ""),
                    "publisher": orgs[0] if orgs else "GOV.UK", "format": r.get("format") or ""})
    return out


def govuk_queries(project):
    queries = ['"%s"' % project["aliases"][0]]
    ref = project.get("planning_ref", "")
    if PINS_REF_RE.fullmatch(ref):
        queries.append(ref)
    return queries


def source_govuk(projects, fetcher, per_project=3):
    record = health("govuk-search", GOVUK_SEARCH)
    items = []
    for project in projects:
        kept, seen = [], set()
        for query in govuk_queries(project):
            record["requests"] += 1
            try:
                _, _, body = fetcher.get(govuk_url(query), "application/json")
                results = govuk_results(body)
            except (FetchError, ValueError) as exc:
                record["failures"] += 1
                record["error"] = str(exc)[:200]
                continue
            for r in results:
                hit = match(project, r["title"], r["summary"])
                if not hit or r["link"] in seen:
                    continue
                made = item(project, r["title"], r["link"], r["publisher"], r["date"],
                            "GOV.UK search for %s: %s" % (query, hit[0]), hit[1])
                if made:
                    seen.add(r["link"])
                    made["kind"] = "govuk_page"
                    kept.append(made)
        kept.sort(key=lambda i: i["date"] or "", reverse=True)
        items += kept[:per_project]
    record["items"] = len(items)
    return items, close_health(record)


# ---------------------------------------------------------------- source: Scottish Energy Consents Unit case page

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)


def html_title(body):
    m = TITLE_RE.search(body.decode("utf-8", "replace") if isinstance(body, bytes) else body)
    return D.clean_text(m.group(1), 200) if m else ""


def page_mentions(body, *needles):
    text = _norm(D.clean_text(body.decode("utf-8", "replace") if isinstance(body, bytes) else body, MAX_BYTES))
    return any(_norm(n) and _norm(n) in text for n in needles if n)


def source_ecu(projects, fetcher):
    """An ECU case page that answers and names the reference is an official, undated notice of the case."""
    record = health("ecu-case", ECU_CASE.format(ref="<reference>"))
    items = []
    for project in projects:
        ref = project.get("planning_ref", "").upper()
        if not ECU_REF_RE.fullmatch(ref):
            continue
        record["requests"] += 1
        url = ECU_CASE.format(ref=ref)
        try:
            _, _, body = fetcher.get(url, "text/html")
        except FetchError as exc:
            record["failures"] += 1
            record["error"] = str(exc)[:200]
            continue
        if not page_mentions(body, ref):
            record["failures"] += 1
            record["error"] = "case page does not show %s" % ref
            continue
        named = next((a for a in project["aliases"] if page_mentions(body, alias_core(a))), None)
        made = item(project, "%s: Section 36 application %s (Energy Consents Unit case)" % (project["aliases"][0], ref),
                    url, "Scottish Government Energy Consents Unit", None,
                    "Energy Consents Unit case page for %s%s; title composed from the reference" % (
                        ref, ", which names '%s'" % alias_core(named) if named else ""),
                    "confirmed" if named else "uncertain")
        if made:
            made["kind"] = "case_page"
            items.append(made)
    record["items"] = len(items)
    return items, close_health(record)


# ---------------------------------------------------------------- run, report

def dedupe(items):
    seen, out = set(), []
    for it in items:
        key = (it["repd_ref"], it["link"])
        if key not in seen:
            seen.add(key)
            out.append(it)
    return out


def run(projects, fetcher, today, sources=("pins", "govuk", "ecu")):
    items, records, extra = [], [], {}
    if "pins" in sources:
        got, record, found = source_pins(projects, fetcher, today)
        items += got
        records.append(record)
        extra["pins_found"] = {ref: row["ref"] for ref, row in found.items()}
    if "govuk" in sources:
        got, record = source_govuk(projects, fetcher)
        items += got
        records.append(record)
    if "ecu" in sources:
        got, record = source_ecu(projects, fetcher)
        items += got
        records.append(record)
    return dedupe(items), records, extra


def build_part(items, records, now_iso):
    return {"schema": SCHEMA_PART, "team": "official", "generated_at": now_iso, "items": items, "sources": records}


def by_project(items):
    table = {}
    for it in items:
        table.setdefault(it["repd_ref"], []).append(it)
    for group in table.values():
        group.sort(key=lambda i: (i["date"] is not None, i["date"] or ""), reverse=True)
    return table


def cell(text):
    return str(text if text is not None else "").replace("|", "/").replace("\n", " ")


def probe_report(projects, items, records, now_iso):
    table = by_project(items)
    with_any = [p for p in projects if p["repd_ref"] in table]
    with_page = [p for p in projects if any(i.get("kind") == "govuk_page" for i in table.get(p["repd_ref"], []))]
    with_milestone = [p for p in projects
                      if any(i.get("kind") == "register_milestone" for i in table.get(p["repd_ref"], []))]
    without = [p for p in projects if p["repd_ref"] not in table]
    lines = ["## Official sources: %d of %d projects with at least one official signal" % (
        len(with_any), len(projects)), "",
        "Generated %s. GOV.UK page: %d projects; Planning Inspectorate register milestone: %d; "
        "Energy Consents Unit case page: %d; items: %d." % (
            now_iso, len(with_page), len(with_milestone),
            len({i["repd_ref"] for i in items if i.get("kind") == "case_page"}), len(items)), "",
        "| source | status | requests | failures | items | error |", "|---|---|---|---|---|---|"]
    for r in records:
        lines.append("| %s | %s | %s | %s | %s | %s |" % (r["id"], r["status"], r["requests"], r["failures"],
                                                           r["items"], cell(r["error"])))
    failed = [r["id"] for r in records if r["status"] != "ok"]
    lines += ["", "Sources that failed or were partial: %s" % (", ".join(failed) or "none"), "",
              "### Newest official signal per project", "",
              "| rank | REPD | alias | date | publisher | title | basis |", "|---|---|---|---|---|---|---|"]
    for p in with_any:
        top = table[p["repd_ref"]][0]
        lines.append("| %s | %s | %s | %s | %s | [%s](%s) | %s |" % (
            p["rank"], p["repd_ref"], cell(p["aliases"][0]), top["date"] or "", cell(top["publisher"]),
            cell(top["title"])[:110], top["link"], cell(top["basis"])[:110]))
    lines += ["", "### Projects with no official signal (%d)" % len(without), "",
              ", ".join("%s %s" % (p["repd_ref"], cell(p["aliases"][0])) for p in without) or "none", ""]
    return "\n".join(lines)


DISCOVER = [
    (PINS_CSV, "text/csv, */*"),
    (PINS_PROJECT.format(ref="EN010147"), "text/html"),
    (PINS_HOST + "/projects/EN010147/project-updates", "text/html"),
    (PINS_HOST + "/projects/EN010147/documents", "text/html"),
    (PINS_HOST + "/projects/EN0110020", "text/html"),
    (PINS_HOST + "/project-search?searchTerm=Botley", "text/html"),
    (govuk_url('"Botley West Solar Farm"', 5), "application/json"),
    (govuk_url("EN010147", 5), "application/json"),
    (govuk_url('"Cottam Solar Project"', 5), "application/json"),
    (ECU_CASE.format(ref="ECU00005085"), "text/html"),
    ("https://www.energyconsents.scot/ApplicationSearch.aspx", "text/html"),
    ("https://planningcasework.service.gov.wales/", "text/html"),
    ("https://planningcasework.service.gov.wales/en/case/CAS-01772-Z5P5D2", "text/html"),
    ("https://planningcasework.service.gov.wales/case/CAS-01772-Z5P5D2", "text/html"),
    ("https://planningcasework.service.gov.wales/en/case/DNS-3274702", "text/html"),
    ("https://planningcasework.service.gov.wales/en/case-search?q=CAS-01772-Z5P5D2", "text/html"),
    ("https://planningcasework.service.gov.wales/en/case-search?searchTerm=3274702", "text/html"),
]
HREF_RE = re.compile(r'href="([^"#]{2,200})"', re.I)


def discover(fetcher, urls=DISCOVER):
    """What each candidate source returns: status, type, size, title, first bytes and telling links. A CI aid."""
    lines = ["## Source discovery", ""]
    for url, accept in urls:
        lines.append("### `%s`" % url)
        try:
            final, ctype, body = fetcher.get(url, accept)
        except FetchError as exc:
            lines += ["FAILED: %s" % exc, ""]
            continue
        text = body.decode("utf-8", "replace")
        lines.append("ok; final `%s`; type `%s`; %d bytes; title: %s" % (final, ctype, len(body),
                                                                       cell(html_title(body))))
        if "html" in ctype:
            hrefs = [h for h in dict.fromkeys(HREF_RE.findall(text))
                     if re.search(r"project|case|EN0|ECU|update|document|download|api|search", h, re.I)]
            lines += ["links: " + " ; ".join("`%s`" % h for h in hrefs[:40]), "",
                      "text: " + cell(D.clean_text(re.sub(r"(?is)<(script|style).*?</\1>", " ", text), 1500))]
        else:
            lines += ["```", text[:1500].replace("```", "'''"), "```"]
        lines.append("")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=None, help="write the part file (project-signals-part.v1) here")
    ap.add_argument("--probe", default=None, help="write a Markdown coverage report here")
    ap.add_argument("--discover", default=None, help="write a Markdown report of what each source returns and stop")
    ap.add_argument("--top", default=None)
    ap.add_argument("--aliases", default=None)
    ap.add_argument("--limit", type=int, default=0, help="only the first N projects by rank")
    ap.add_argument("--sources", default="pins,govuk,ecu")
    ap.add_argument("--now", default=None)
    args = ap.parse_args(argv)

    fetcher = Fetcher()
    if args.discover:
        report = discover(fetcher)
        Path(args.discover).write_text(report, encoding="utf-8")
        return 0
    now_iso = args.now or now_utc()
    projects = load_projects(args.top, args.aliases)
    if args.limit:
        projects = projects[:args.limit]
    items, records, _ = run(projects, fetcher, now_iso[:10], tuple(args.sources.split(",")))
    part = build_part(items, records, now_iso)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(part, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.probe:
        Path(args.probe).write_text(probe_report(projects, items, records, now_iso), encoding="utf-8")
    print(json.dumps({"projects": len(projects), "with_official_signal": len({i["repd_ref"] for i in items}),
                      "items": len(items), "sources": {r["id"]: r["status"] for r in records}}))
    return 1 if records and all(r["status"] == "failed" for r in records) else 0


if __name__ == "__main__":
    sys.exit(main())
