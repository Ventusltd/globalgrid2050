#!/usr/bin/env python3
"""Project signals: the combiner. Three optional part files and the planning-file fallback become one file.

  python automation/news/signals/combine.py --official parts/official.json --trade parts/trade.json \
      --index parts/index.json --previous dist/project_signals.json --out dist/project_signals.json

Output: dist/project_signals.json, schema project-signals.v1 (the shared contract, section 5), keyed by REPD Ref ID
for each of the 200 largest solar projects: "signals" (headline, link, publisher, date; newest first, at most
five, no link twice) and "planning_file" (always present, labelled "planning file", never placed in "signals").

Rules
- Every part file is optional. A part that is absent, unreadable or of another schema is recorded under "parts"
  and the run carries on with the rest; with no part at all every project still has its planning file.
- Items for a reference outside the 200, without a usable https link, from a source that is not allowed, or whose
  title carries one of the project's "exclude" phrases are dropped and counted.
- Signals already published in the previous file are kept, so a story that has rolled off a feed does not vanish.
- The planning file comes from, in order: a --planning file, the planning_file module when it can be imported
  (planning_file_for), aliases.json, and a last resort built here (counted separately, never marked verified).
- counts.nothing must be 0: the exit code is 2 if any project has neither a signal nor a planning file.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEWS = HERE.parent
for _path in (str(NEWS), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import datacentre_feed as D  # noqa: E402  canonical links and text cleaning (reused, not copied)

SCHEMA = "project-signals.v1"
PART_SCHEMA = "project-signals-part.v1"
TRUTH_SCHEMA = "project-signals-ground-truth.v1"
SCOPE = "200 largest Solar Photovoltaics rows, REPD October 2026"
TEAMS = ("official", "trade", "index")
FAMILIES = ("official", "bbc", "trade", "national", "regional")
NEWS_FAMILIES = ("bbc", "trade", "national", "regional")
KINDS = ("pins_project", "ecu_case", "pedw_case", "application", "search_page")
MAX_SIGNALS = 5
EXCLUDED_DOMAINS = ("google.com", "google.co.uk", "reuters.com")
PINS_PROJECT = "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/%s"
ECU_SEARCH = "https://www.energyconsents.scot/ApplicationSearch.aspx"
PEDW_SEARCH = "https://planningcasework.service.gov.wales/"
REGISTER_FINDER = "https://www.gov.uk/search-register-planning-decisions"


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path):
    if not path or not Path(path).exists():
        return None, "absent"
    try:
        return json.loads(Path(path).read_text(encoding="utf-8")), "ok"
    except (ValueError, OSError):
        return None, "unreadable"


def _excluded(link):
    host = (urllib.parse.urlsplit(link).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in EXCLUDED_DOMAINS) or ".google." in "." + host + "."


def clean_item(raw, team):
    """A part's item in the contract's shape, or (None, reason)."""
    if not isinstance(raw, dict):
        return None, "not an object"
    link = D.canonical_link(raw.get("link") if isinstance(raw.get("link"), str) else "")
    title = D.clean_text(raw.get("title") if isinstance(raw.get("title"), str) else "", 300)
    if not link or not title:
        return None, "no title or link"
    if _excluded(link):
        return None, "source not allowed"
    date = raw.get("date")
    date = date[:10] if isinstance(date, str) and re.match(r"\d{4}-\d{2}-\d{2}", date) else None
    family = raw.get("family") if raw.get("family") in FAMILIES else ("official" if team == "official" else
                                                                        "trade" if team == "trade" else "regional")
    return {"repd_ref": str(raw.get("repd_ref") or ""), "title": title, "link": link,
            "publisher": D.clean_text(str(raw.get("publisher") or ""), 80) or (urllib.parse.urlsplit(link).hostname or ""),
            "date": date, "family": family, "basis": D.clean_text(str(raw.get("basis") or ""), 240),
            "confidence": "confirmed" if raw.get("confidence") == "confirmed" else "uncertain"}, ""


def title_key(title):
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def order_key(item):
    date = int(item["date"].replace("-", "")) if item["date"] else 0
    return (item["confidence"] != "confirmed", -date, FAMILIES.index(item["family"]), item["link"])


def select(items, cap=MAX_SIGNALS):
    """No link twice, no headline twice; confirmed before uncertain, then newest first (undated last), then family
    order; at most `cap`, keeping one item of each family present where that is possible."""
    seen_links, seen_titles, unique = set(), set(), []
    for item in sorted(items, key=order_key):
        key = title_key(item["title"])
        if item["link"] in seen_links or key in seen_titles:
            continue
        seen_links.add(item["link"])
        seen_titles.add(key)
        unique.append(item)
    if len(unique) <= cap:
        return unique
    chosen = unique[:cap]
    for family in FAMILIES:
        if any(i["family"] == family for i in chosen):
            continue
        extra = next((i for i in unique[cap:] if i["family"] == family), None)
        if extra is None:
            continue
        counts = {}
        for i in chosen:
            counts[i["family"]] = counts.get(i["family"], 0) + 1
        for position in range(len(chosen) - 1, -1, -1):               # replace the last item of a repeated family
            if counts[chosen[position]["family"]] > 1:
                chosen[position] = extra
                break
    return sorted(chosen, key=order_key)


# ---------------------------------------------------------------- planning file

def last_resort(row):
    """A planning file built from the REPD row alone. Never verified; a search page unless the reference is a
    Planning Inspectorate project number."""
    ref = (row.get("planning_ref") or "").strip()
    authority = (row.get("planning_authority") or "").strip()
    country = (row.get("country") or "").strip()
    if re.fullmatch(r"EN0\d{5}", ref, re.I):
        return {"authority": "The Planning Inspectorate", "reference": ref.upper(), "url": PINS_PROJECT % ref.upper(),
                "kind": "pins_project", "verified": False, "note": ""}
    shown = ref or "the project name"
    if re.match(r"ECU", ref, re.I) or (country == "Scotland" and re.search(r"scottish (?:government|ministers)|energy consents", authority, re.I)):
        return {"authority": "Scottish Government Energy Consents Unit", "reference": ref, "url": ECU_SEARCH,
                "kind": "search_page", "verified": False, "note": "search for %s" % shown}
    if re.match(r"DNS|CAS-", ref, re.I) or (country == "Wales" and re.search(r"welsh (?:government|ministers)|PEDW|planning and environment decisions", authority, re.I)):
        return {"authority": "Planning and Environment Decisions Wales", "reference": ref, "url": PEDW_SEARCH,
                "kind": "search_page", "verified": False, "note": "search for %s" % shown}
    return {"authority": authority or "Local planning authority", "reference": ref, "url": REGISTER_FINDER,
            "kind": "search_page", "verified": False,
            "note": "find the planning register of %s, then search for %s" % (authority or "the local planning authority", shown)}


def clean_planning_file(raw):
    if not isinstance(raw, dict):
        return None
    url = D.canonical_link(raw.get("url") if isinstance(raw.get("url"), str) else "")
    if not url:
        return None
    kind = raw.get("kind") if raw.get("kind") in KINDS else "search_page"
    reference = D.clean_text(str(raw.get("reference") or ""), 120)
    note = D.clean_text(str(raw.get("note") or ""), 200)
    if kind == "search_page" and not note and reference:
        note = "search for %s" % reference
    return {"label": "planning file", "authority": D.clean_text(str(raw.get("authority") or ""), 120),
            "reference": reference, "url": url, "kind": kind, "verified": raw.get("verified") is True, "note": note}


def module_planning_file(row):
    """Lead 1's builder, only if its module is present. Any failure means "not available"."""
    try:
        import planning_file as PF  # noqa: PLC0415  optional module from another pull request
    except Exception:
        return None
    for name in ("planning_file_for", "build_planning_file", "planning_file"):
        fn = getattr(PF, name, None)
        if callable(fn):
            try:
                return clean_planning_file(fn(dict(row)))
            except Exception:
                return None
    return None


def planning_table(data):
    """{repd_ref: planning_file} from either accepted shape of a --planning file."""
    if not isinstance(data, dict):
        return {}
    projects = data.get("projects") if isinstance(data.get("projects"), dict) else data
    out = {}
    for ref, value in projects.items():
        if isinstance(value, dict):
            out[str(ref)] = value.get("planning_file") if isinstance(value.get("planning_file"), dict) else value
    return out


# ---------------------------------------------------------------- combine

def combine(rows, aliases=None, parts=None, planning=None, previous=None, now_iso=None, use_module=True):
    """rows: the top-200 list. parts: {team: part dict or None}. Returns the combined file as a dict."""
    aliases = (aliases or {}).get("projects", {}) if isinstance(aliases, dict) else {}
    parts, planning = parts or {}, planning_table(planning)
    refs = [str(r["repd_ref"]) for r in rows]
    ref_set = set(refs)
    excludes = {ref: [e.lower() for e in (aliases.get(ref) or {}).get("exclude") or [] if isinstance(e, str) and e.strip()]
                for ref in refs}
    gathered = {ref: [] for ref in refs}
    dropped = {"outside the 200": 0, "no title or link": 0, "source not allowed": 0, "exclude phrase": 0, "not an object": 0}
    sources, part_state = [], {}

    def take(raw, team):
        item, reason = clean_item(raw, team)
        if item is None:
            dropped[reason] += 1
        elif item["repd_ref"] not in ref_set:
            dropped["outside the 200"] += 1
        elif any(phrase in item["title"].lower() for phrase in excludes[item["repd_ref"]]):
            dropped["exclude phrase"] += 1
        else:
            gathered[item["repd_ref"]].append(item)
            return True
        return False

    for team in TEAMS:
        part = parts.get(team)
        if not isinstance(part, dict):
            part_state[team] = {"status": part if isinstance(part, str) else "absent", "items": 0}
            continue
        if part.get("schema") != PART_SCHEMA or not isinstance(part.get("items"), list):
            part_state[team] = {"status": "wrong schema", "items": 0}
            continue
        kept = sum(1 for raw in part["items"] if take(raw, team))
        part_state[team] = {"status": "ok", "items": kept, "generated_at": part.get("generated_at")}
        for source in part.get("sources") or []:
            if isinstance(source, dict):
                sources.append({"team": team, "id": str(source.get("id") or ""), "url": str(source.get("url") or ""),
                                "status": source.get("status") if source.get("status") in ("ok", "partial", "failed") else "failed",
                                "requests": source.get("requests") or 0, "failures": source.get("failures") or 0,
                                "items": source.get("items") or 0,
                                "error": re.sub(r"\S+@\S+", "(address removed)", D.clean_text(str(source.get("error") or ""), 300))})
    carried = 0
    if isinstance(previous, dict) and previous.get("schema") == SCHEMA:
        for ref, project in (previous.get("projects") or {}).items():
            for raw in (project or {}).get("signals") or []:
                if isinstance(raw, dict):
                    carried += bool(take(dict(raw, repd_ref=ref), "index"))

    projects, missing = {}, []
    counts = {"projects": len(refs), "with_signal": 0, "with_signal_by_family": {f: 0 for f in FAMILIES},
              "with_news_signal": 0, "official_signal_only": 0, "with_confirmed_signal": 0, "planning_file_only": 0,
              "planning_file_verified": 0, "planning_file_search_page": 0, "planning_file_last_resort": 0, "nothing": 0}
    for row in rows:
        ref = str(row["repd_ref"])
        entry = aliases.get(ref) or {}
        signals = select(gathered[ref])
        file, origin = None, ""
        file, origin = clean_planning_file(planning.get(ref)), "planning"
        if not file and use_module:
            file, origin = module_planning_file(dict(row, planning_file=entry.get("planning_file"))), "module"
        if not file:
            file, origin = clean_planning_file(entry.get("planning_file")), "aliases"
        if not file:
            file, origin = clean_planning_file(last_resort(row)), "last_resort"
        names = entry.get("aliases") or []
        projects[ref] = {"repd_ref": ref, "rank": row.get("rank"), "site_name": (row.get("site_name") or "").strip(),
                         "alias": names[0] if names and isinstance(names[0], str) else (row.get("site_name") or "").strip(),
                         "signals": signals, "planning_file": file}
        families = {s["family"] for s in signals}
        if signals:
            counts["with_signal"] += 1
            for family in families:
                counts["with_signal_by_family"][family] += 1
            if families & set(NEWS_FAMILIES):
                counts["with_news_signal"] += 1
            else:
                counts["official_signal_only"] += 1
            counts["with_confirmed_signal"] += any(s["confidence"] == "confirmed" for s in signals)
        elif file:
            counts["planning_file_only"] += 1
        else:
            counts["nothing"] += 1
            missing.append(ref)
        if file:
            counts["planning_file_verified"] += file["verified"]
            counts["planning_file_search_page"] += file["kind"] == "search_page"
            counts["planning_file_last_resort"] += origin == "last_resort"
    return {"schema": SCHEMA, "generated_at": now_iso or now_utc(), "scope": SCOPE, "counts": counts,
            "parts": part_state, "dropped": dropped, "carried_from_previous": carried, "sources": sources,
            "projects": projects}


# ---------------------------------------------------------------- ground truth (the members' findings)

def load_truth(path):
    data, state = read_json(path)
    if state != "ok" or not isinstance(data, dict) or data.get("schema") != TRUTH_SCHEMA:
        return {}
    return data.get("projects") or {}


def truth_report(truth, signals_by_ref, label="all parts"):
    """Markdown: of the projects the members marked "found", how many the automated run finds, by family."""
    found = {ref: t for ref, t in truth.items() if t.get("status") == "found"}
    if not truth:
        return "### Ground truth\n\nNo ground-truth file.\n"
    hit = [ref for ref in found if signals_by_ref.get(ref)]
    lines = ["### Compared with the members' ground truth (%s)\n" % label,
             "Ground truth covers %d projects: %d found, %d uncertain, %d none, %d not searched." % (
                 len(truth), len(found), sum(1 for t in truth.values() if t.get("status") == "uncertain"),
                 sum(1 for t in truth.values() if t.get("status") == "none"),
                 sum(1 for t in truth.values() if t.get("status") not in ("found", "uncertain", "none"))),
             "Of the %d found by a member, the automated run has at least one signal for **%d**.\n" % (len(found), len(hit)),
             "| family in ground truth | projects | automated: any signal | automated: same family | same link |",
             "|---|---|---|---|---|"]
    for family in FAMILIES:
        refs = [ref for ref, t in found.items() if family in (t.get("families") or [])]
        any_signal = sum(1 for ref in refs if signals_by_ref.get(ref))
        same = sum(1 for ref in refs if any(s["family"] == family for s in signals_by_ref.get(ref) or []))
        links = sum(1 for ref in refs
                    if {D.canonical_link(l) for l in found[ref].get("links") or []} & {s["link"] for s in signals_by_ref.get(ref) or []})
        lines.append("| %s | %d | %d | %d | %d |" % (family, len(refs), any_signal, same, links))
    extra = [ref for ref, t in truth.items() if t.get("status") != "found" and signals_by_ref.get(ref)]
    lines.append("\nAutomated signals for projects a member did not mark found: %d%s." % (
        len(extra), (" (REPD " + ", ".join(sorted(extra, key=lambda r: (len(r), r))[:30]) + ")") if extra else ""))
    missed = sorted((ref for ref in found if not signals_by_ref.get(ref)), key=lambda r: (len(r), r))
    if missed:
        lines.append("Found by a member, not by the run: REPD " + ", ".join(missed[:80]) + ".")
    return "\n".join(lines) + "\n"


def summary(result, truth=None):
    c = result["counts"]
    lines = ["## Project signals: combined file\n",
             "Generated %s. %s.\n" % (result["generated_at"], result["scope"]),
             "| | projects |\n|---|---|",
             "| with at least one signal | **%d** of %d |" % (c["with_signal"], c["projects"]),
             "| with a news signal (BBC, trade, national or regional) | %d |" % c["with_news_signal"],
             "| with an official signal only | %d |" % c["official_signal_only"],
             "| with a confirmed signal | %d |" % c["with_confirmed_signal"],
             "| with a planning file only | %d |" % c["planning_file_only"],
             "| with nothing (must be 0) | %d |" % c["nothing"],
             "\nBy family: " + ", ".join("%s %d" % kv for kv in c["with_signal_by_family"].items()) + ".",
             "Planning files: %d verified, %d search pages, %d built as a last resort from the REPD row." % (
                 c["planning_file_verified"], c["planning_file_search_page"], c["planning_file_last_resort"]),
             "Parts: " + ", ".join("%s %s (%d items)" % (t, s["status"], s["items"]) for t, s in result["parts"].items())
             + ". Kept from the previous file: %d. Dropped: %s.\n" % (
                 result["carried_from_previous"], ", ".join("%s %d" % kv for kv in result["dropped"].items() if kv[1]) or "none"),
             "| team | source | status | requests | failures | items | error |\n|---|---|---|---|---|---|---|"]
    for s in result["sources"]:
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % (s["team"], s["id"], s["status"], s["requests"], s["failures"],
                                                                s["items"], s["error"].replace("|", "/")))
    if truth is not None:
        lines.append("\n" + truth_report(truth, {ref: p["signals"] for ref, p in result["projects"].items()}))
    lines.append("\n### The 200\n\n| rank | REPD | alias | shown | date | publisher | title or reference |\n|---|---|---|---|---|---|---|")
    for p in sorted(result["projects"].values(), key=lambda p: p["rank"] or 0):
        if p["signals"]:
            s = p["signals"][0]
            lines.append("| %s | %s | %s | %s%s | %s | %s | [%s](%s) |" % (
                p["rank"], p["repd_ref"], p["alias"].replace("|", "/"), s["family"],
                "" if s["confidence"] == "confirmed" else " (uncertain)", s["date"] or "", s["publisher"].replace("|", "/"),
                s["title"].replace("|", "/").replace("[", "(").replace("]", ")"), s["link"]))
        else:
            f = p["planning_file"] or {}
            lines.append("| %s | %s | %s | planning file | | %s | [%s](%s) |" % (
                p["rank"], p["repd_ref"], p["alias"].replace("|", "/"), (f.get("authority") or "").replace("|", "/"),
                (f.get("reference") or f.get("kind") or "none").replace("|", "/"), f.get("url") or ""))
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    for team in TEAMS:
        ap.add_argument("--" + team, default=None, help="part file of team %s (optional)" % team)
    ap.add_argument("--top200", default=str(HERE / "top200_solar.json"))
    ap.add_argument("--aliases", default=str(HERE / "aliases.json"))
    ap.add_argument("--planning", default=None, help="optional {repd_ref: planning_file} file")
    ap.add_argument("--previous", default=None, help="the file published last time; its signals are kept")
    ap.add_argument("--truth", default=str(HERE / "index_ground_truth.json"))
    ap.add_argument("--out", default="dist/project_signals.json")
    ap.add_argument("--summary", default=None, help="write a Markdown summary here")
    ap.add_argument("--now", default=None)
    args = ap.parse_args(argv)

    rows = json.loads(Path(args.top200).read_text(encoding="utf-8"))
    aliases, _ = read_json(args.aliases)
    parts = {}
    for team in TEAMS:
        data, state = read_json(getattr(args, team))
        parts[team] = data if state == "ok" else state
    planning, _ = read_json(args.planning)
    previous, _ = read_json(args.previous)
    result = combine(rows, aliases, parts, planning, previous, args.now)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(out)
    if args.summary:
        truth = load_truth(args.truth) if args.truth and Path(args.truth).exists() else None
        Path(args.summary).write_text(summary(result, truth), encoding="utf-8")
    print(json.dumps({"out": str(out), **{k: v for k, v in result["counts"].items() if not isinstance(v, dict)},
                      "parts": {t: s["status"] for t, s in result["parts"].items()}}))
    if result["counts"]["nothing"]:
        print("FAIL: %d project(s) have neither a signal nor a planning file" % result["counts"]["nothing"], file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
