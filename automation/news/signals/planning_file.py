#!/usr/bin/env python3
"""The planning-file fallback for the 200 largest solar projects in the REPD.

Owner, 14 November 2026: "Default to its local authority planning application file if nothing significant
discovered." So every project gets one link to its planning file, of the best kind available:

  pins_project   the Planning Inspectorate project page for a national infrastructure reference (EN01xxxx)
  ecu_case       the Scottish Energy Consents Unit case for a Section 36 reference (ECU0000xxxx)
  pedw_case      the Planning and Environment Decisions Wales case, where a case address is known
  application    the local planning authority's own page for the application, where a direct address can be built
                 from the reference (or was recorded with the alias table)
  search_page    the authority's planning register search page, with the reference for the reader to paste

A planning file is labelled "planning file", carries the authority and the reference, and is never a news signal.
The table of authority to register is planning_registers.json (every authority among the 200; a test enforces it).

  planning_file_for(project) -> dict            offline, used by the combiner
  python automation/news/signals/planning_file.py --out planning-files.json [--verify] [--probe summary.md]
                                                [--official part-official.json]

--verify fetches each register home once and each direct link once (one request a second per host) and sets
"verified" from what answered: a direct link is verified when the page answers and shows the reference or the
project's name; a link that is gone (404, 410, no such host) falls back to the search page.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import official as O  # noqa: E402  Fetcher, load_projects, matching helpers

SCHEMA = "project-planning-files.v1"
LABEL = "planning file"
KINDS = ("pins_project", "ecu_case", "pedw_case", "application", "search_page")
DIRECT = ("pins_project", "ecu_case", "pedw_case", "application")
GENERIC_SEARCH = "https://www.gov.uk/search-register-planning-decisions"
GONE = (404, 410)

_registers = None


def load_registers(path=None):
    global _registers
    if path is None and _registers is not None:
        return _registers
    table = json.loads(Path(path or HERE / "planning_registers.json").read_text(encoding="utf-8"))["authorities"]
    if path is None:
        _registers = table
    return table


def _specific(url, register):
    """A member-recorded address that points at a case, not at a register's front page."""
    u = urllib.parse.urlsplit(url)
    if u.scheme != "https" or not u.hostname:
        return False
    fronts = {(register or {}).get(k, "").rstrip("/") for k in ("home", "search", "council")}
    return url.rstrip("/") not in fronts and (len(u.path.strip("/")) > 0 or bool(u.query)) and \
        not re.search(r"search\.do\?action=(simple|advanced)", url)


def _reference_forms(ref):
    return {"ref": urllib.parse.quote(ref, safe="/"), "ref_lower_dashed": ref.lower().replace("/", "-"),
            "ref_digits": re.sub(r"\D", "", ref)}


def search_page(register, authority, reference, why=""):
    register = register or {}
    dead = register.get("check", {}).get("status") == "gone"
    url = (register.get("council") if dead else register.get("search") or register.get("home")) \
        or register.get("council") or GENERIC_SEARCH
    note = "Search the register for %s." % reference if reference else "Search the register for the site name."
    if register.get("notes"):
        note += " " + register["notes"]
    if why:
        note += " " + why
    return {"label": LABEL, "authority": register.get("label") or authority, "reference": reference, "url": url,
            "kind": "search_page", "verified": False, "note": note.strip()}


def planning_file_for(project, registers=None):
    """The best planning-file link for one project, without the network. `project` is a dict with planning_authority,
    planning_ref and, optionally, the alias table's planning_file (a member's finding)."""
    registers = load_registers() if registers is None else registers
    authority = (project.get("planning_authority") or "").strip()
    reference = (project.get("planning_ref") or "").strip()
    register = registers.get(authority)
    member = project.get("planning_file") if isinstance(project.get("planning_file"), dict) else None

    def made(kind, url, auth, ref, note="", verified=False):
        return {"label": LABEL, "authority": auth, "reference": ref, "url": url, "kind": kind,
                "verified": bool(verified), "note": note}

    pins = registers.get("The Planning Inspectorate - National Infrastructure", {})
    ecu = registers.get("Scottish Government (S36)", {})
    en_ref = reference.upper() if O.PINS_REF_RE.fullmatch(reference) else None
    if not en_ref and member and member.get("kind") == "pins_project":
        found = O.PINS_REF_RE.search("%s %s" % (member.get("url", ""), member.get("reference", "")))
        en_ref = found.group(0).upper() if found else None
    if en_ref:
        note = "" if en_ref == reference.upper() else \
            "REPD records the reference %s; the national infrastructure reference is %s." % (reference, en_ref)
        return made("pins_project", O.PINS_PROJECT.format(ref=en_ref),
                    pins.get("label", "Planning Inspectorate (national infrastructure)"), en_ref, note)
    if O.ECU_REF_RE.fullmatch(reference):
        return made("ecu_case", O.ECU_CASE.format(ref=reference.upper()),
                    ecu.get("label", "Scottish Government Energy Consents Unit"), reference.upper())
    if member and member.get("kind") in DIRECT and _specific(member.get("url", ""), register):
        return made(member["kind"], member["url"], (register or {}).get("label") or member.get("authority") or authority,
                    member.get("reference") or reference, "", member.get("verified") is True)
    if register and register.get("application") and reference and \
            re.fullmatch(register.get("ref_re", r".+"), reference):
        return made(register.get("kind", "application"), register["application"].format(**_reference_forms(reference)),
                    register.get("label") or authority, reference)
    if not register and member and str(member.get("url", "")).startswith("https://"):
        return made("search_page", member["url"], member.get("authority") or authority,
                    member.get("reference") or reference, "Search the register for %s." % reference)
    return search_page(register, authority, reference)


# ---------------------------------------------------------------- verification (network)

def _check(fetcher, url, cache):
    """('ok', body) | ('gone', reason) | ('blocked', reason): gone is a 404/410 or a host that does not resolve."""
    if url in cache:
        return cache[url]
    try:
        _, _, body = fetcher.get(url, "text/html, */*")
        result = ("ok", body)
    except O.FetchError as exc:
        text = str(exc)
        gone = exc.status in GONE or "Name or service not known" in text or "No address associated" in text \
            or "getaddrinfo" in text or "nodename nor servname" in text
        result = ("gone" if gone else "blocked", text[:120])
    cache[url] = result
    return result


def verify(projects, fetcher, registers=None):
    """Planning files with "verified" set from the network, and one health record per register."""
    registers = load_registers() if registers is None else registers
    cache, files, checks = {}, {}, {}

    def register_check(authority):
        register = registers.get(authority)
        if register is None:
            return None
        if authority not in checks:
            record = {"authority": authority, "url": register.get("search") or register.get("home"),
                      "status": "", "error": "", "used": ""}
            status, detail = _check(fetcher, record["url"], cache)
            if status != "ok" and register.get("search") and register.get("home"):
                status2, detail2 = _check(fetcher, register["home"], cache)
                if status2 == "ok":
                    status, detail, record["url"] = status2, detail2, register["home"]
            record["status"] = status
            if status == "ok":
                record["used"] = record["url"]
            else:
                record["error"] = detail
                if register.get("council"):
                    status3, _ = _check(fetcher, register["council"], cache)
                    if status3 == "ok":
                        record["used"] = register["council"]
                        record["status"] = "council_page_only" if status == "gone" else "blocked"
            checks[authority] = record
        return checks[authority]

    for project in projects:
        made = dict(planning_file_for(project, registers))
        made["verified"] = False
        made["check"] = ""
        authority = project.get("planning_authority", "")
        if made["kind"] in DIRECT:
            status, detail = _check(fetcher, made["url"], cache)
            if status == "ok":
                names = [O.alias_core(a) for a in project.get("aliases", [])]
                if O.page_mentions(detail, made["reference"], *names):
                    made["verified"], made["check"] = True, "page answers and shows the reference or the name"
                elif made["url"].lower().endswith(".pdf"):
                    made["verified"], made["check"] = True, "document answers"
                else:
                    made["check"] = "page answers but does not show the reference"
            elif status == "blocked":
                made["check"] = "not fetched (%s); link kept, unverified" % detail
            else:
                made = search_page(registers.get(authority), authority, project.get("planning_ref", ""),
                                   "The direct link did not answer (%s)." % detail)
                made["check"] = "direct link gone"
        if made["kind"] == "search_page":
            record = register_check(authority)
            if record is None:
                made["check"] = made.get("check") or "authority not in the register table"
            elif record["status"] == "ok":
                made["url"] = record["url"]
                made["check"] = (made.get("check") + "; " if made.get("check") else "") + "register page answers"
            elif record["used"]:
                if record["status"] == "council_page_only":
                    made["url"] = record["used"]
                made["check"] = "register page: %s (%s)" % (record["status"], record["error"])
            else:
                made["check"] = "register page: %s (%s)" % (record["status"], record["error"])
            made["register_status"] = record["status"] if record else "unknown"
        files[project["repd_ref"]] = made
    return files, [checks[a] for a in sorted(checks)]


# ---------------------------------------------------------------- output

def counts_of(files, total):
    direct_ok = [r for r, f in files.items() if f["kind"] in DIRECT and f["verified"]]
    direct_unverified = [r for r, f in files.items() if f["kind"] in DIRECT and not f["verified"]]
    search = [r for r, f in files.items() if f["kind"] == "search_page"]
    return {"projects": total, "with_planning_file": len(files), "verified_direct": len(direct_ok),
            "direct_unverified": len(direct_unverified), "search_page": len(search),
            "search_page_register_answers": sum(1 for r in search if files[r].get("register_status") == "ok"),
            "nothing": total - len(files),
            "by_kind": {k: sum(1 for f in files.values() if f["kind"] == k) for k in KINDS}}


def build(projects, files, register_records, now_iso, verified_run):
    return {"schema": SCHEMA, "generated_at": now_iso, "verified_run": verified_run,
            "counts": counts_of(files, len(projects)),
            "projects": {p["repd_ref"]: {"repd_ref": p["repd_ref"], "planning_file": files[p["repd_ref"]]}
                         for p in projects if p["repd_ref"] in files},
            "registers": register_records}


def probe_report(projects, files, register_records, now_iso, official=None):
    c = counts_of(files, len(projects))
    signalled = {i["repd_ref"] for i in (official or {}).get("items", [])}
    verified = {r for r, f in files.items() if f["kind"] in DIRECT and f["verified"]}
    search_only = [p for p in projects if p["repd_ref"] not in signalled and p["repd_ref"] not in verified
                   and files.get(p["repd_ref"], {}).get("kind") == "search_page"]
    unverified_only = [p for p in projects if p["repd_ref"] not in signalled and p["repd_ref"] not in verified
                       and files.get(p["repd_ref"], {}).get("kind") in DIRECT]
    nothing = [p for p in projects if p["repd_ref"] not in signalled and p["repd_ref"] not in files]
    failed = ["%s (%s)" % (s["id"], s["status"]) for s in (official or {}).get("sources", []) if s["status"] != "ok"]
    bad_registers = [r for r in register_records if r["status"] != "ok"]
    lines = ["## Project signals, official sources and planning files: %d projects" % len(projects), "",
             "Generated %s." % now_iso, "",
             "| measure | projects |", "|---|---|"]
    if official is not None:
        lines.append("| at least one official signal | %d |" % len(signalled))
    lines += ["| a verified planning file (direct link that answered and shows the reference or name) | %d |" % len(verified),
              "| a direct planning-file link that could not be verified from here | %d |" % c["direct_unverified"],
              "| a search-page planning file | %d (register page answered for %d) |" % (
                  c["search_page"], c["search_page_register_answers"])]
    if official is not None:
        lines += ["| no official signal and no verified file: only a search-page fallback | %d |" % len(search_only),
                  "| no official signal and only an unverified direct link | %d |" % len(unverified_only),
                  "| an official signal or a planning file (the guarantee) | %d |" % (len(projects) - len(nothing))]
    lines += ["| nothing at all | %d |" % len(nothing), "",
              "Planning files by kind: " + ", ".join("%s %d" % (k, v) for k, v in c["by_kind"].items()), "",
              "Sources that failed or were partial: %s" % (", ".join(failed) or "none"), "",
              "Registers that did not answer: %d of %d checked" % (len(bad_registers), len(register_records)), ""]
    if bad_registers:
        lines += ["| authority | status | address tried | error | page used |", "|---|---|---|---|---|"]
        lines += ["| %s | %s | %s | %s | %s |" % (O.cell(r["authority"]), r["status"], r["url"], O.cell(r["error"]),
                                                 r["used"]) for r in bad_registers]
        lines.append("")
    lines += ["Projects with nothing: %s" % (", ".join("%s %s" % (p["repd_ref"], O.cell(p["site_name"]))
                                                       for p in nothing) or "none"), "",
              "### Planning file per project", "",
              "| rank | REPD | project | authority | reference | kind | verified | check |",
              "|---|---|---|---|---|---|---|---|"]
    for p in projects:
        f = files.get(p["repd_ref"])
        if f:
            lines.append("| %s | %s | %s | %s | [%s](%s) | %s | %s | %s |" % (
                p["rank"], p["repd_ref"], O.cell(p["aliases"][0]), O.cell(f["authority"]),
                O.cell(f["reference"]) or "(none)", f["url"].replace(" ", "%20"), f["kind"],
                "yes" if f["verified"] else "no", O.cell(f.get("check", ""))[:90]))
    lines.append("")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=None, help="write the planning files (project-planning-files.v1) here")
    ap.add_argument("--probe", default=None, help="write a Markdown report here")
    ap.add_argument("--verify", action="store_true", help="fetch register pages and direct links to set 'verified'")
    ap.add_argument("--official", default=None, help="the official part file, to report combined coverage")
    ap.add_argument("--top", default=None)
    ap.add_argument("--aliases", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--now", default=None)
    args = ap.parse_args(argv)

    now_iso = args.now or O.now_utc()
    projects = O.load_projects(args.top, args.aliases)
    if args.limit:
        projects = projects[:args.limit]
    if args.verify:
        files, records = verify(projects, O.Fetcher())
    else:
        files, records = {p["repd_ref"]: planning_file_for(p) for p in projects}, []
    result = build(projects, files, records, now_iso, args.verify)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.probe:
        official = None
        if args.official and Path(args.official).exists():
            official = json.loads(Path(args.official).read_text(encoding="utf-8"))
        Path(args.probe).write_text(probe_report(projects, files, records, now_iso, official), encoding="utf-8")
    print(json.dumps(result["counts"]))
    return 1 if result["counts"]["nothing"] else 0


if __name__ == "__main__":
    sys.exit(main())
