#!/usr/bin/env python3
"""One table for all project-signals test suites, from the JUnit files pytest wrote.

  python automation/news/tests/acid_report.py --run <dir> [--summary FILE] [--json FILE]   run every suite, then report
  python automation/news/tests/acid_report.py <dir of *.xml> [--summary FILE] [--json FILE]    report only

With --run the suites are discovered, not listed: every automation/news/tests/test_signals_*.py and every
automation/news/signals/tests/test_*.py is one suite (test_combine.py is "combiner"), each run by pytest with
its own JUnit file. A suite added later is therefore run and counted without a change to the workflow.

Columns: suite, tests, passed, failed, then "known failing until the fixer's PR" (a test marked xfail with the
review finding it covers; strict, so one that passes unexpectedly is counted as failed), "open recommendation"
(an xfail whose reason starts with OPEN: a tester's recommendation outside the contract, never a failure) and
skipped. A suite that wrote no report, or collected no test, counts as failed. Exit code 1 when any suite has
a failure.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ORDER = ("official", "trade", "index", "planning_file", "combiner", "acid")


def discover(repo):
    """[(suite name, test file)]: the six known suites in ORDER, then any other signals suite by name."""
    news = Path(repo) / "automation" / "news"
    found = {}
    for path in sorted((news / "tests").glob("test_signals_*.py")):
        found[path.stem[len("test_signals_"):]] = path
    for path in sorted((news / "signals" / "tests").glob("test_*.py")):
        name = path.stem[len("test_"):]
        name = "combiner" if name == "combine" else name
        found[name if name not in found else "signals_" + name] = path
    return [(name, found[name]) for name in ORDER if name in found] + sorted((n, p) for n, p in found.items() if n not in ORDER)


def run_suites(repo, directory):
    """Run each discovered suite with its own JUnit report. Returns the names, the six of ORDER always included."""
    Path(directory).mkdir(parents=True, exist_ok=True)
    names = list(ORDER)
    for name, path in discover(repo):
        print("::group::%s (%s)" % (name, path.relative_to(repo)), flush=True)
        subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-rfEX", "-o", "junit_family=xunit1",
                        "--junitxml", str(Path(directory) / (name + ".xml")), str(path)], cwd=str(repo))
        print("::endgroup::", flush=True)
        if name not in names:
            names.append(name)
    return names


def read_suite(path):
    """{tests, passed, failed, known, skipped, failures: [(name, message)], known_list: [(name, reason)]}."""
    out = {"tests": 0, "passed": 0, "failed": 0, "known": 0, "open": 0, "skipped": 0, "failures": [], "known_list": [],
           "open_list": []}
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as error:
        out["failed"] = 1
        out["failures"].append(("(report unreadable)", str(error)[:200]))
        return out
    for case in root.iter("testcase"):
        out["tests"] += 1
        name = "%s::%s" % ((case.get("classname") or "").rsplit(".", 1)[-1], case.get("name") or "")
        bad = case.find("failure") if case.find("failure") is not None else case.find("error")
        skipped = case.find("skipped")
        if bad is not None:
            out["failed"] += 1
            out["failures"].append((name, (bad.get("message") or "").strip()[:300]))
        elif skipped is not None and skipped.get("type") == "pytest.xfail":
            reason = (skipped.get("message") or "").strip()[:300]
            kind = "open" if reason.startswith("OPEN") else "known"
            out[kind] += 1
            out[kind + "_list"].append((name, reason))
        elif skipped is not None:
            out["skipped"] += 1
        else:
            out["passed"] += 1
    if not out["tests"]:
        out["failed"] = 1
        out["failures"].append(("(no test collected)", "the suite did not run"))
    return out


def cell(text):
    return str(text).replace("|", "/").replace("\n", " ")


def table(suites, commit=""):
    lines = ["## Project signals: all test suites together%s\n" % (" at `%s`" % commit[:12] if commit else ""),
             "| suite | tests | passed | failed | known failing until the fixer's PR | open recommendation | skipped |",
             "|---|---|---|---|---|---|---|"]
    total = {"tests": 0, "passed": 0, "failed": 0, "known": 0, "open": 0, "skipped": 0}
    for name, s in suites:
        lines.append("| %s | %d | %d | %s | %d | %d | %d |" % (name, s["tests"], s["passed"],
                                                              ("**%d**" % s["failed"]) if s["failed"] else "0", s["known"],
                                                              s["open"], s["skipped"]))
        for key in total:
            total[key] += s[key]
    lines.append("| **all** | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** |" % (
        total["tests"], total["passed"], total["failed"], total["known"], total["open"], total["skipped"]))
    failures = [(name, test, message) for name, s in suites for test, message in s["failures"]]
    if failures:
        lines += ["\n### Failed\n", "| suite | test | message |", "|---|---|---|"]
        lines += ["| %s | `%s` | %s |" % (name, cell(test), cell(message)) for name, test, message in failures]
    known = [(name, test, reason) for name, s in suites for test, reason in s["known_list"]]
    if known:
        lines += ["\n### Known failing until the fixer's PR (%d)\n" % len(known),
                  "Each is a rule the code at this commit does not meet. The marker is strict: a test listed here that "
                  "passes is reported as failed, and on code that declares the revised contract the marker is not applied "
                  "at all, so every one of these must pass there.\n",
                  "| suite | test | finding covered |", "|---|---|---|"]
        lines += ["| %s | `%s` | %s |" % (name, cell(test), cell(reason)) for name, test, reason in known]
    opened = [(name, test, reason) for name, s in suites for test, reason in s["open_list"]]
    if opened:
        lines += ["\n### Open recommendations (%d)\n" % len(opened),
                  "Reported by the acid testers, outside contract version 2. Not failures; listed so they are not lost.\n",
                  "| suite | test | recommendation |", "|---|---|---|"]
        lines += ["| %s | `%s` | %s |" % (name, cell(test), cell(reason)) for name, test, reason in opened]
    return "\n".join(lines) + "\n", total


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("directory")
    ap.add_argument("--run", action="store_true", help="run every discovered suite into the directory first")
    ap.add_argument("--summary", default=None)
    ap.add_argument("--json", default=None)
    ap.add_argument("--commit", default="")
    ap.add_argument("--expect", default=",".join(ORDER), help="suites that must have a report")
    args = ap.parse_args(argv)
    if args.run:
        args.expect = ",".join(run_suites(Path(__file__).resolve().parents[3], args.directory))
    found = {p.stem: p for p in Path(args.directory).glob("*.xml")}
    names = [n for n in args.expect.split(",") if n] + sorted(n for n in found if n not in args.expect.split(","))
    suites = [(name, read_suite(found[name]) if name in found else
               {"tests": 0, "passed": 0, "failed": 1, "known": 0, "open": 0, "skipped": 0,
                "failures": [("(no report)", "the suite did not run")], "known_list": [], "open_list": []}) for name in names]
    text, total = table(suites, args.commit)
    try:
        print(text)
    except BrokenPipeError:
        pass
    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as handle:
            handle.write(text + "\n")
    if args.json:
        Path(args.json).write_text(json.dumps({"commit": args.commit, "total": total, "suites": dict(suites)}, indent=1) + "\n",
                                   encoding="utf-8")
    return 1 if total["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
