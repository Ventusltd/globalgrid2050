"""Acid suite for the project signals (top 200 solar): the combiner run end to end on fixtures, the collectors'
matchers and date readers, the integrated workflow and the live checker. No network.

Written against contract version 2 (schema project-signals.v2: tiers recent_news, official, archive; planning
file apart; honest generated_at). The combiner is run as a program, the way the workflow runs it, so the suite
does not depend on its internals.

Known failing: a test that the code on main (schema project-signals.v1) does not meet carries `known(...)`, an
xfail naming the review finding it covers (NL-019 = the independent code review on neural-link issue 19;
"definition N" = the definitions of done of the acid cycle). The marker is strict, and it is applied only
while combine.py still declares version 1: on version 1 a marked test that passes is a failure, and on code that
declares version 2 the marker is not applied, so every marked test must pass there.

Rule ids in the test names (R01 to R15) are the rows of the scorecard.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent
NEWS = TESTS.parent
SIGNALS = NEWS / "signals"
REPO = NEWS.parents[1]
FIXTURES = TESTS / "fixtures" / "acid"
for _path in (str(TESTS), str(NEWS), str(SIGNALS)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import acid_live as L  # noqa: E402
import acid_report  # noqa: E402

COMBINE = SIGNALS / "combine.py"
VERSION_1 = "project-signals.v2" not in COMBINE.read_text(encoding="utf-8")
PART_SCHEMA = "project-signals-part.v1"
NOW = "2026-11-14T12:00:00Z"
COLLECTED = "2026-11-14T11:50:00Z"
NEXT_DAY = "2026-11-15T12:00:00Z"
NEXT_COLLECTED = "2026-11-15T11:50:00Z"

WORLD = json.loads((FIXTURES / "projects.json").read_text(encoding="utf-8"))
FALSE_MATCHES = json.loads((FIXTURES / "false_matches.json").read_text(encoding="utf-8"))["cases"]
DATES = json.loads((FIXTURES / "dates.json").read_text(encoding="utf-8"))["cases"]
TESTERS = json.loads((FIXTURES / "tester_cases.json").read_text(encoding="utf-8"))
TESTER_FALSE = json.loads((FIXTURES / "tester_false_matches.json").read_text(encoding="utf-8"))
REAL_TOP200 = json.loads((SIGNALS / "top200_solar.json").read_text(encoding="utf-8"))
REAL_ALIASES = json.loads((SIGNALS / "aliases.json").read_text(encoding="utf-8"))
REVIEWED = json.loads((SIGNALS / "reviewed_signals.json").read_text(encoding="utf-8"))
NEWS_FAMILIES = ("bbc", "trade", "national", "regional")


def known(finding, text, strict=True):
    """Known failing on main until the fixer's pull request; see the module docstring."""
    return pytest.mark.xfail(condition=VERSION_1, strict=strict, reason="%s: %s" % (finding, text))


def open_item(text):
    """A recommendation outside contract version 2: reported, never a failure."""
    return pytest.mark.xfail(strict=False, reason="OPEN, outside contract v2: %s" % text)


# ---------------------------------------------------------------- fixtures and the runner

def item(ref, slug, title=None, date="2026-11-01", family="trade", confidence="confirmed", publisher="Example News", **more):
    base = {"repd_ref": str(ref), "title": title or "Headline %s" % slug, "link": "https://news.example.co.uk/%s" % slug,
            "publisher": publisher, "date": date, "family": family, "basis": "alias in title", "confidence": confidence}
    base.update(more)
    return base


def part(team, items, stamp=COLLECTED, sources=None):
    if sources is None:
        sources = [{"id": team + "-source", "url": "https://news.example.co.uk/", "status": "ok", "requests": 3,
                    "failures": 0, "items": len(items), "error": ""}]
    return {"schema": PART_SCHEMA, "team": team, "generated_at": stamp, "items": items, "sources": sources}


def reviewed(items, stamp="2026-11-14T10:00:00Z"):
    for one in items:
        one.setdefault("basis", "reviewed 2026-11-14")
        if not one["basis"].startswith("reviewed"):
            one["basis"] = "reviewed 2026-11-14"
    return part("reviewed", items, stamp, sources=[])


def world(tmp, extra_refs=(), aliases_patch=None):
    """Write the fixture top-200 list and alias table (plus real rows for `extra_refs`); return their paths."""
    rows = [dict(r) for r in WORLD["top200"]]
    aliases = json.loads(json.dumps(WORLD["aliases"]))
    for ref in extra_refs:
        if ref in aliases["projects"]:
            continue
        rows.append(dict(next(r for r in REAL_TOP200 if str(r["repd_ref"]) == ref), rank=len(rows) + 1))
        aliases["projects"][ref] = REAL_ALIASES["projects"][ref]
    for ref, patch in (aliases_patch or {}).items():
        aliases["projects"][ref].update(patch)
    top, table = tmp / "top200.json", tmp / "aliases.json"
    top.write_text(json.dumps(rows), encoding="utf-8")
    table.write_text(json.dumps(aliases), encoding="utf-8")
    return top, table


class Run:
    def __init__(self, code, doc, text, out):
        self.code, self.doc, self.text, self.out = code, doc, text, out

    def project(self, ref):
        assert self.doc is not None, "the combiner wrote no file (exit %s): %s" % (self.code, self.text[-400:])
        return self.doc["projects"][str(ref)]


def combine(tmp, parts=None, now=NOW, previous=None, name="out", top200=None, aliases=None, extra_refs=(), aliases_patch=None):
    """Run combine.py as the workflow does. parts: {team: part dict | raw text | None (file absent)}.
    A reviewed part is always passed (empty unless given) so the committed reviewed file does not leak in."""
    work = tmp / name
    work.mkdir(parents=True, exist_ok=True)
    if top200 is None:
        top200, aliases = world(work, extra_refs, aliases_patch)
    given = {"official": None, "trade": None, "index": None, "reviewed": reviewed([])}
    given.update(parts or {})
    args = [sys.executable, str(COMBINE), "--top200", str(top200), "--aliases", str(aliases), "--now", now]
    for team, value in given.items():
        path = work / ("part-%s.json" % team)
        if isinstance(value, dict):
            path.write_text(json.dumps(value), encoding="utf-8")
        elif isinstance(value, str):
            path.write_text(value, encoding="utf-8")
        args += ["--" + team, str(path)]
    out = work / "project_signals.json"
    if previous is not None:
        out.write_bytes(Path(previous).read_bytes())          # as in the workflow: the previous file is at --out
        args += ["--previous", str(out)]
    args += ["--out", str(out), "--summary", str(work / "summary.md")]
    done = subprocess.run(args, capture_output=True, text=True, timeout=120, cwd=str(REPO))
    doc = None
    if out.exists():
        try:
            doc = json.loads(out.read_text(encoding="utf-8"))
        except ValueError:
            doc = None
    return Run(done.returncode, doc, done.stdout + done.stderr, out)


def tiers(project):
    """The three lists of contract version 2; a version 1 project fails here, saying why."""
    assert all(isinstance(project.get(name), list) for name in L.LISTS), \
        "version 1 output: one mixed 'signals' list per project, no recent_news / official / archive"
    return {name: project[name] for name in L.LISTS}


def shown(project):
    return L.shown(project)


def find(project, slug):
    return [i for i in shown(project) if i["link"].endswith("/" + slug)]


def confirmed(one):
    return one.get("confidence") == "confirmed"


def total_items(doc):
    return sum(len(shown(p)) for p in doc["projects"].values())


def projects_with_items(doc):
    return sum(1 for p in doc["projects"].values() if shown(p))


def base_parts(stamp=COLLECTED):
    """One healthy run: six projects with items, of every kind."""
    return {
        "official": part("official", [
            item("90001", "o-consent", "Alderwick Solar Farm: development consent decision", "2026-11-10", "official",
                 publisher="Planning Inspectorate"),
            item("90002", "o-exam", "Brantley Moor Solar Farm: examination closed", "2026-03-02", "official",
                 publisher="Planning Inspectorate")], stamp),
        "trade": part("trade", [
            item("90001", "t-consent", "Alderwick Solar Farm granted development consent", "2026-11-11"),
            item("90003", "t-mill", "Mill Solar Farm near Ashford approved", "2026-10-20"),
            item("90007", "t-tarn", "Tarnside Solar Farm plan submitted in Cumbria", "2026-09-30"),
            item("90008", "t-oxley-old", "Oxley Green Solar Farm proposed for Essex", "2021-05-04")], stamp),
        "index": part("index", [
            item("90008", "i-oxley-undated", "Oxley Green Solar Farm: what we know", None, "regional"),
            item("9050", "i-foston", "Solar farm at Foston wins approval", "2021-02-17", "regional")], stamp),
    }


# ---------------------------------------------------------------- R01 false matches

REJECT = [c for c in FALSE_MATCHES if c["expect"] == "reject"]
NOT_CONFIRMED = [c for c in FALSE_MATCHES if c["expect"] == "not_confirmed"]
ACCEPT = [c for c in FALSE_MATCHES if c["expect"] == "accept"]
REAL_REFS = {str(r["repd_ref"]) for r in REAL_TOP200}


def case_parts(cases, family="trade", team="trade"):
    return {team: part(team, [item(c["repd_ref"], "case-%d" % n, c["title"], "2026-11-05", family)
                              for n, c in enumerate(cases)])}


@known("NL-019 finding 5", "REPD 9050 'Bypass Solar Farm' takes headlines about bypass diodes; no exclusion rule")
@pytest.mark.parametrize("team, family", [("trade", "trade"), ("index", "regional"), ("official", "official"), ("reviewed", "trade")])
def test_R01_repd_9050_takes_no_headline_without_solar_farm_or_the_place(tmp_path, team, family):
    cases = [c for c in REJECT + ACCEPT if c["repd_ref"] == "9050"]
    parts = case_parts(cases, family, team)
    if team == "reviewed":
        parts = {"reviewed": reviewed(parts["reviewed"]["items"])}
    run = combine(tmp_path, parts)
    titles = [i["title"] for i in shown(run.project("9050"))]
    wrong = [t for t in titles if not re.search(r"solar farm|foston|grantham", t, re.I)]
    assert not wrong, "REPD 9050 shows %r although the %s part only said so" % (wrong, team)
    for case in (c for c in cases if c["expect"] == "accept"):
        assert case["title"] in titles, "the true headline %r was lost" % case["title"]


@known("NL-019 finding 5", "a headline carried over from the previous file is not checked against the exclusion rule again")
def test_R01_a_false_match_already_published_is_not_carried_into_the_next_file(tmp_path):
    """Acid tester 5: a corrected false match must not be republished from the previous file for ever. The previous
    file here is a version 1 file as main publishes it today, holding a bypass-diode headline on REPD 9050."""
    first = {"schema": "project-signals.v1", "generated_at": "2026-11-13T05:23:00Z", "projects": {"9050": {"signals": [
        {"repd_ref": "9050", "title": "New bypass diode design cuts shading losses in PV modules",
         "link": "https://news.example.co.uk/old-diode", "publisher": "Example News", "date": "2026-11-12", "family": "trade",
         "basis": "alias phrase 'Bypass' in title", "confidence": "confirmed"}]}}}
    previous = tmp_path / "previous.json"
    previous.write_text(json.dumps(first), encoding="utf-8")
    run = combine(tmp_path, base_parts(), previous=previous)
    assert run.code == 0, run.text[-400:]
    assert not find(run.project("9050"), "old-diode"), "the bypass-diode headline came back from the previous file"


COLLECTOR_KNOWN = {
    ("trade", "9050"): ("Town bypass", "NL-019 finding 5", "trade.py: 'Bypass' followed by a solar word is a confirmed match (a road with solar-powered signs)"),
    ("trade", "11678"): ("Drove Lane", "acid tester 6 (recent news)", "trade.py ties 'East Yorkshire' plus developer 'Boom' to another Boom Power project, as confirmed"),
    ("official", "11678"): ("Drove Lane", "acid tester 6 (recent news)", "official.py ties 'East Yorkshire' with a solar word to another Boom Power project, as confirmed"),
}


@pytest.mark.parametrize("case", [c for c in REJECT + NOT_CONFIRMED if c["repd_ref"] in REAL_REFS],
                         ids=lambda c: "%s-%s" % (c["repd_ref"], re.sub(r"\W+", "-", c["title"][:32])))
@pytest.mark.parametrize("collector", ["trade", "index", "official"])
def test_R01_no_collector_attaches_a_reported_false_match_as_a_confident_match(case, collector, request):
    ref, title, summary = case["repd_ref"], case["title"], case.get("summary") or ""
    if collector == "trade":
        import trade as T
        project = next(p for p in T.load_projects(str(SIGNALS / "aliases.json")) if p.ref == ref)
        found = project.match(title, summary)
        confident = found is not None and found[1] == "confirmed"
    elif collector == "index":
        import index as I
        loaded = I.load_projects(str(SIGNALS / "top200_solar.json"), str(SIGNALS / "aliases.json"))
        project = next(p for p in (loaded.values() if isinstance(loaded, dict) else loaded) if str(p["repd_ref"]) == ref)
        found = I.match_item(project, title, summary)
        confident = found is not None and found[0] == "strong"
    else:
        import official as O
        project = next(p for p in O.load_projects() if str(p["repd_ref"]) == ref)
        found = O.match(project, title, summary)
        confident = found is not None and found[1] == "confirmed"
    if (collector, ref) in COLLECTOR_KNOWN and COLLECTOR_KNOWN[(collector, ref)][0] in title:
        request.applymarker(known(*COLLECTOR_KNOWN[(collector, ref)][1:]))
    assert not confident, "%s.py ties %r to REPD %s as a confident match: %r" % (collector, title, ref, found)


@known("NL-019 findings 1 and 5", "a part's 'confirmed' is taken on trust: no evidence check, no second term for a one-word alias")
@pytest.mark.parametrize("case", NOT_CONFIRMED, ids=lambda c: c["repd_ref"])
def test_R01_confidence_is_earned_not_inherited_from_the_part(tmp_path, case):
    extra = [case["repd_ref"]] if case["repd_ref"] in REAL_REFS else []
    run = combine(tmp_path, case_parts([case]), extra_refs=extra)
    kept = [i for i in shown(run.project(case["repd_ref"])) if i["title"] == case["title"]]
    assert not any(confirmed(i) for i in kept), "shown as confirmed although: %s" % case["why"]
    if not VERSION_1:
        assert all(i["confidence"] == "possible" for i in kept)


def test_R01_true_headlines_are_kept_as_confirmed(tmp_path):
    run = combine(tmp_path, case_parts(ACCEPT))
    for case in ACCEPT:
        kept = [i for i in shown(run.project(case["repd_ref"])) if i["title"] == case["title"]]
        assert kept and confirmed(kept[0]), "lost or downgraded: %r (%s)" % (case["title"], case["why"])


@known("NL-019 finding 5", "143 confirmed, 47 uncertain and 10 derived aliases; items of an unconfirmed alias are still shown as confirmed")
def test_R01_real_alias_table_no_confirmed_item_under_an_alias_that_is_not_evidenced(tmp_path):
    table = REAL_ALIASES["projects"]
    weak = {ref for ref, entry in table.items()
            if entry.get("alias_status") != "confirmed" or not (entry.get("alias_evidence") or entry.get("alias_evidence_url"))}
    run = combine(tmp_path, {"reviewed": REVIEWED}, top200=SIGNALS / "top200_solar.json", aliases=SIGNALS / "aliases.json")
    wrong = sorted(ref for ref in weak if any(confirmed(i) for i in shown(run.project(ref))))
    assert not wrong, "%d of the %d projects without a confirmed, evidenced alias show a confirmed item: REPD %s" % (
        len(wrong), len(weak), ", ".join(wrong[:25]))


@open_item("acid tester 3 recommends 'possible' for eight aliases marked confirmed (one agreeing fact or an unexplained capacity conflict)")
def test_R01_aliases_the_confidence_tester_would_downgrade_show_no_confirmed_item(tmp_path):
    run = combine(tmp_path, {"reviewed": REVIEWED}, top200=SIGNALS / "top200_solar.json", aliases=SIGNALS / "aliases.json")
    wrong = [c["repd_ref"] for c in TESTERS["downgrade"] if any(confirmed(i) for i in shown(run.project(c["repd_ref"])))]
    assert not wrong, "confirmed items under aliases with one agreeing fact or a capacity conflict: REPD %s" % ", ".join(wrong)


_LOADED = {}


def collector_verdict(collector, ref, title, summary=""):
    """(attached, confident) as the collector's own matcher decides for the real alias table."""
    if collector == "trade":
        import trade as T
        if "trade" not in _LOADED:
            _LOADED["trade"] = {p.ref: p for p in T.load_projects(str(SIGNALS / "aliases.json"))}
        found = _LOADED["trade"][ref].match(title, summary)
        return found is not None, found is not None and found[1] == "confirmed"
    if collector == "index":
        import index as I
        if "index" not in _LOADED:
            loaded = I.load_projects(str(SIGNALS / "top200_solar.json"), str(SIGNALS / "aliases.json"))
            _LOADED["index"] = {str(p["repd_ref"]): p for p in (loaded.values() if isinstance(loaded, dict) else loaded)}
        found = I.match_item(_LOADED["index"][ref], title, summary)
        return found is not None, found is not None and found[0] == "strong"
    import official as O
    if "official" not in _LOADED:
        _LOADED["official"] = {str(p["repd_ref"]): p for p in O.load_projects()}
    found = O.match(_LOADED["official"][ref], title, summary)
    return found is not None, found is not None and found[1] == "confirmed"


TESTER_CLASSES = sorted(TESTER_FALSE["rule_classes"])


@known("acid tester 1 (false matches)", "239 wrong headlines pass the collectors' matchers on main, 167 of them labelled confirmed")
@pytest.mark.parametrize("rule_class", TESTER_CLASSES)
def test_R01_tester_false_matches_no_collector_is_confident(rule_class):
    cases = [c for c in TESTER_FALSE["cases"] if rule_class in c["rule_classes"]]
    wrong = []
    for case in cases:
        for collector in ("trade", "index", "official"):
            if collector_verdict(collector, case["repd_ref"], case["title"])[1]:
                wrong.append("%s REPD %s %r" % (collector, case["repd_ref"], case["title"][:70]))
    assert not wrong, "class %s (%s): %d confident wrong matches in %d cases, e.g. %s" % (
        rule_class, TESTER_FALSE["rule_classes"][rule_class][:90], len(wrong), len(cases), "; ".join(wrong[:3]))


@known("acid tester 1 (false matches)", "the combiner publishes a wrong headline as confirmed whenever a part says confirmed")
@pytest.mark.parametrize("rule_class", TESTER_CLASSES)
def test_R01_tester_false_matches_are_never_published_as_confirmed(tmp_path, rule_class):
    cases = [c for c in TESTER_FALSE["cases"] if rule_class in c["rule_classes"]]
    items = [item(c["repd_ref"], "w%d" % n, c["title"], "2026-11-05") for n, c in enumerate(cases)]
    run = combine(tmp_path, {"trade": part("trade", items)}, top200=SIGNALS / "top200_solar.json", aliases=SIGNALS / "aliases.json")
    assert run.code == 0, run.text[-400:]
    wrong = ["REPD %s %r" % (c["repd_ref"], c["title"][:70]) for n, c in enumerate(cases)
             if any(confirmed(i) for i in find(run.project(c["repd_ref"]), "w%d" % n))]
    assert not wrong, "class %s: %d of %d wrong headlines are published as confirmed, e.g. %s" % (
        rule_class, len(wrong), len(cases), "; ".join(wrong[:3]))


def test_R01_tester_false_matches_fixture_is_complete():
    cases = TESTER_FALSE["cases"]
    assert len(cases) == 239 and sum(1 for c in cases if c["real"]) == 7
    assert all(c["repd_ref"] in REAL_REFS and c["title"] for c in cases)
    assert any(c["repd_ref"] == "9050" for c in cases)


# ---------------------------------------------------------------- R02 calendar and dates

MAIN_ACCEPTS_BAD_DATE = {"impossible-day", "impossible-month", "31-november", "zero-date", "future-months", "future-two-days",
                         "impossible-gdelt-slice"}


@pytest.mark.parametrize("case", DATES, ids=lambda c: c["id"])
def test_R02_combiner_never_shows_a_wrong_impossible_or_future_date(tmp_path, case, request):
    if case["id"] in MAIN_ACCEPTS_BAD_DATE:
        request.applymarker(known("NL-019 finding 3", "dates are accepted by their YYYY-MM-DD prefix: no calendar or future check"))
    run = combine(tmp_path, {"trade": part("trade", [item("90001", "dated", "Alderwick Solar Farm update", case["raw"])])})
    assert run.code == 0, run.text[-400:]
    kept = find(run.project("90001"), "dated")
    assert kept, "the item was dropped; an unreadable date makes it undated, it does not remove it"
    assert kept[0]["date"] in case["allowed"], "%r became %r (%s)" % (case["raw"], kept[0]["date"], case["why"])


@pytest.mark.parametrize("case", [c for c in DATES if c.get("collectors", True)], ids=lambda c: c["id"])
@pytest.mark.parametrize("reader", ["trade.day_of", "official.parse_day", "feed.parse_date"])
def test_R02_collector_date_readers_never_swap_day_and_month_or_invent_a_date(case, reader, request):
    if (reader, case["id"]) == ("official.parse_day", "year-0026"):
        request.applymarker(known("acid tester 2 (dates)", "official.parse_day reads 1/2/0026 as the year 26"))
    if reader == "trade.day_of":
        import trade as T
        got = T.day_of(case["raw"])
    elif reader == "official.parse_day":
        import official as O
        got = O.parse_day(case["raw"])
    else:
        import datacentre_feed as D
        got = D.parse_date(case["raw"])
    got = got[:10] if isinstance(got, str) else got
    if reader == "feed.parse_date" and got is None:
        return                      # the feed reader refuses any value without a time zone: undated, never wrong
    assert got in case["allowed"], "%s(%r) gave %r (%s)" % (reader, case["raw"], got, case["why"])


@known("NL-019 finding 3", "a date after the run is kept, so the item is ranked first as the newest")
def test_R02_a_future_dated_item_is_not_ranked_as_the_newest(tmp_path):
    run = combine(tmp_path, {"trade": part("trade", [
        item("90001", "future", "Alderwick Solar Farm to open", "2027-06-01"),
        item("90001", "real", "Alderwick Solar Farm granted development consent", "2026-11-11")])})
    first = shown(run.project("90001"))[0]
    assert first["link"].endswith("/real"), "first shown: %r dated %r" % (first["title"], first["date"])


@open_item("acid tester 2 (dates): a collector's date reader loses or misreads this value")
@pytest.mark.parametrize("case", TESTERS["date_readers"], ids=lambda c: c["name"])
def test_R02_tester_date_reader_recommendations(case):
    module, name = case["function"].split(".")
    got = getattr(__import__(module), name)(case["value"])
    got = got[:10] if isinstance(got, str) else got
    assert got == case["expected"], "%s(%r) gave %r, the tester expects %r" % (case["function"], case["value"], got, case["expected"])


@known("NL-019 finding 2 and acid tester 2", "no freshness boundary exists")
@pytest.mark.parametrize("date, where", [("2026-08-16", "recent_news"), ("2026-08-15", "archive")])
def test_R02_the_ninety_day_boundary_is_counted_from_the_date(tmp_path, date, where):
    run = combine(tmp_path, {"trade": part("trade", [item("90001", "edge", "Alderwick Solar Farm update", date)])})
    lists = tiers(run.project("90001"))
    assert [name for name, items in lists.items() if items] == [where], "an item dated %s (run on 2026-11-14)" % date


# ---------------------------------------------------------------- R03 stale feed

@known("NL-019 finding 2", "freshness is inherited from the run: an article of months ago, fetched today, counts as a news signal")
def test_R03_an_old_article_fetched_today_is_archive_not_recent_news(tmp_path):
    run = combine(tmp_path, {"trade": part("trade", [item("90007", "old", "Tarnside Solar Farm plan submitted", "2026-08-01")])})
    lists = tiers(run.project("90007"))
    assert [i["link"].rsplit("/", 1)[-1] for i in lists["archive"]] == ["old"] and not lists["recent_news"]
    assert lists["archive"][0]["freshness"] == "older" and lists["archive"][0]["year"] == 2026
    assert run.doc["counts"]["headline"]["value"] == 0 and run.doc["counts"]["by_tier"]["archive_only"] == 1


@known("NL-019 finding 3", "generated_at is the clock of the run: the same parts combined a day later look freshly collected")
def test_R03_the_same_parts_combined_again_do_not_move_generated_at(tmp_path):
    first = combine(tmp_path, base_parts(), name="first")
    again = combine(tmp_path, base_parts(), now=NEXT_DAY, previous=first.out, name="again")
    assert again.code == 0, again.text[-400:]
    assert again.doc["generated_at"] == first.doc["generated_at"], "generated_at moved from %s to %s with nothing collected" % (
        first.doc["generated_at"], again.doc["generated_at"])
    assert again.doc["generated_at"] == COLLECTED, "generated_at must be the newest successful collection (%s)" % COLLECTED
    for ref in ("90001", "90003", "90008"):
        before = {i["link"]: i.get("collected_at") for i in shown(first.project(ref))}
        after = {i["link"]: i.get("collected_at") for i in shown(again.project(ref))}
        assert before == after and all(before.values()), "collected_at of the items of %s changed or is missing" % ref


@known("NL-019 finding 2", "no freshness status is computed from the date")
def test_R03_recent_news_ages_out_by_its_date_when_the_feed_stays_the_same(tmp_path):
    first = combine(tmp_path, base_parts(), name="first")
    assert [i["link"].rsplit("/", 1)[-1] for i in tiers(first.project("90003"))["recent_news"]] == ["t-mill"]
    later = combine(tmp_path, base_parts(), now="2027-03-01T12:00:00Z", previous=first.out, name="later")
    assert later.code == 0, later.text[-400:]
    lists = tiers(later.project("90003"))
    assert not lists["recent_news"] and [i["freshness"] for i in lists["archive"]] == ["older"]
    assert later.doc["counts"]["headline"]["value"] == 0


# ---------------------------------------------------------------- R04 source failure, R09 generated_at

ALL_FAILED = part("trade", [], NEXT_COLLECTED, sources=[{"id": "trade-source", "url": "https://news.example.co.uk/",
                                                           "status": "failed", "requests": 4, "failures": 4, "items": 0,
                                                           "error": "URLError: timed out"}])
BROKEN = {"missing": None, "unreadable": "{\"schema\": \"project-signals-part.v1\", \"items\": [", "raised": "Traceback (most recent call last):\n",
          "wrong-schema": json.dumps({"schema": "something-else", "items": []}), "every-source-failed": ALL_FAILED,
          "items-not-a-list": json.dumps({"schema": PART_SCHEMA, "generated_at": NEXT_COLLECTED, "items": None})}


@known("NL-019 finding 3", "a part that failed is recorded as absent, or as ok with 0 items, and never as stale; its items lose their collection time")
@pytest.mark.parametrize("how", list(BROKEN))
def test_R04_a_failed_part_is_marked_stale_and_its_items_keep_their_times(tmp_path, how):
    first = combine(tmp_path, base_parts(), name="first")
    parts = base_parts(NEXT_COLLECTED)
    parts["trade"] = BROKEN[how]
    second = combine(tmp_path, parts, now=NEXT_DAY, previous=first.out, name="second")
    assert second.code == 0, second.text[-400:]
    kept = find(second.project("90003"), "t-mill")
    assert kept, "the trade item published before was lost when the trade part failed (%s)" % how
    state = second.doc["parts"]["trade"]
    assert state["status"] == "stale", "parts.trade.status is %r after a failed collection (%s)" % (state["status"], how)
    assert state.get("collected_at") == COLLECTED and kept[0].get("collected_at") == COLLECTED
    assert second.doc.get("stale") is True
    assert second.doc["generated_at"] == NEXT_COLLECTED, "the official and index parts did succeed at %s" % NEXT_COLLECTED


def test_R04_with_no_part_at_all_every_project_still_has_its_planning_file(tmp_path):
    run = combine(tmp_path, {})
    assert run.code == 0, run.text[-400:]
    assert all(isinstance(p.get("planning_file"), dict) and p["planning_file"]["url"].startswith("https://")
               for p in run.doc["projects"].values())
    assert not any(shown(p) for p in run.doc["projects"].values())


@known("NL-019 finding 3", "a file built from nothing still carries the time of the run as generated_at")
def test_R09_nothing_collected_and_nothing_before_gives_no_generated_at(tmp_path):
    run = combine(tmp_path, {})
    assert run.code == 0, run.text[-400:]
    assert run.doc["generated_at"] is None, "generated_at is %r though nothing was ever collected" % run.doc["generated_at"]
    assert run.doc.get("stale") is True


@known("NL-019 finding 3", "every fetch failing republishes the previous items under a new generated_at")
@pytest.mark.parametrize("how", ["missing", "unreadable", "every-source-failed"])
def test_R09_generated_at_does_not_advance_when_every_collection_fails(tmp_path, how):
    first = combine(tmp_path, base_parts(), name="first")
    broken = BROKEN[how]
    parts = {team: (dict(broken, team=team) if isinstance(broken, dict) else broken) for team in ("official", "trade", "index")}
    second = combine(tmp_path, parts, now=NEXT_DAY, previous=first.out, name="second")
    assert second.doc is not None
    assert second.doc["generated_at"] == first.doc["generated_at"], "generated_at went from %s to %s although every collection failed (%s)" % (
        first.doc["generated_at"], second.doc["generated_at"], how)
    if second.code == 0:
        assert second.doc.get("stale") is True
        assert total_items(second.doc) == total_items(first.doc), "items were lost or added by a run that collected nothing"
        assert L.failures(second.doc, "2026-11-20T12:00:00Z").get("generated-at") is None, "six days later the file must still say it is stale"


@known("acid tester 5 (publishing)", "every signal of the previous file is carried for ever, so a reviewed entry that was withdrawn is republished")
def test_R04_a_reviewed_entry_withdrawn_from_the_committed_file_is_not_carried_for_ever(tmp_path):
    parts = base_parts()
    parts["reviewed"] = reviewed([item("90006", "r-wrong", "Henwick Solar Park approved", "2026-10-01", "regional")])
    first = combine(tmp_path, parts, name="first")
    assert find(first.project("90006"), "r-wrong")
    second = combine(tmp_path, base_parts(NEXT_COLLECTED), now=NEXT_DAY, previous=first.out, name="second")
    assert second.code == 0, second.text[-400:]
    assert not find(second.project("90006"), "r-wrong"), "the withdrawn reviewed entry is still published"


# ---------------------------------------------------------------- R05 undated against dated, ordering

@known("NL-019 finding 2", "confirmed first, then date: an undated or 2014 confirmed item outranks a timely uncertain one")
def test_R05_an_undated_item_never_outranks_a_dated_one(tmp_path):
    run = combine(tmp_path, {"index": part("index", [
        item("90001", "undated", "Alderwick Solar Farm: what we know", None, "regional"),
        item("90001", "old", "Alderwick Solar Farm first proposed", "2019-03-01", "regional"),
        item("90001", "fresh", "Alderwick Solar Farm decision due this week", "2026-11-12", "regional", "uncertain")])})
    order = [i["link"].rsplit("/", 1)[-1] for i in shown(run.project("90001"))]
    assert order == ["fresh", "old", "undated"], "shown in the order %s" % order
    assert not L.failures(run.doc, NOW).get("undated-order")


@known("definition 1", "an undated item carries no label saying so")
def test_R05_an_undated_item_is_archive_and_labelled_undated(tmp_path):
    run = combine(tmp_path, {"index": part("index", [item("90008", "undated", "Oxley Green Solar Farm: what we know", None, "regional"),
                                                      item("90008", "undated-official", "Oxley Green Solar Farm notice", None, "official")])})
    lists = tiers(run.project("90008"))
    assert not lists["recent_news"] and not lists["official"] and len(lists["archive"]) == 2
    assert all(i["date"] is None and i["year"] is None and i["freshness"] == "undated" for i in lists["archive"])


@known("acid tester 6 (recent news)", "the newest event is hidden: an uncertain recent item ranks below confirmed older ones and the cap of five cuts it")
def test_R05_a_recent_possible_item_is_not_pushed_out_by_five_older_confirmed_ones(tmp_path):
    older = [item("90001", "y%d" % n, "Alderwick Solar Farm report %d" % n, "2025-0%d-10" % n) for n in range(1, 8)]
    run = combine(tmp_path, {"trade": part("trade", older + [
        item("90001", "sale", "Developer sells 500MW solar NSIP in Norfolk", "2026-11-13", confidence="uncertain")])})
    kept = find(run.project("90001"), "sale")
    assert kept and shown(run.project("90001"))[0]["link"].endswith("/sale"), "the newest item is missing or not first"
    assert not confirmed(kept[0]), "an uncertain match must never be shown as fact"


# ---------------------------------------------------------------- R06 reviewed item duplicated by a fetched one

@pytest.mark.parametrize("fetched_link", [
    "https://news.example.co.uk/same?utm_source=rss&utm_medium=feed",
    "https://news.example.co.uk/same?ito=1&at_medium=rss",
    "http://news.example.co.uk/same",
    "https://NEWS.example.co.uk/same#comments"], ids=["utm", "ito-at", "http", "host-case-fragment"])
def test_R06_a_reviewed_item_duplicated_by_a_fetched_one_is_shown_once_as_fetched(tmp_path, fetched_link):
    title = "Alderwick Solar Farm granted development consent"
    run = combine(tmp_path, {
        "reviewed": reviewed([item("90001", "same", title, "2026-11-11", publisher="Example News")]),
        "trade": part("trade", [item("90001", "same", title, "2026-11-11", link=fetched_link)])})
    kept = [i for i in shown(run.project("90001")) if "/same" in i["link"]]
    assert len(kept) == 1, "the same article is listed %d times" % len(kept)
    assert kept[0]["link"] == "https://news.example.co.uk/same"
    if VERSION_1:
        assert not kept[0]["basis"].startswith("reviewed")
    else:
        assert kept[0]["obtained"] == "fetched" and kept[0]["source"] == "trade"


def test_R06_two_articles_whose_links_differ_in_a_meaningful_query_are_both_kept(tmp_path):
    run = combine(tmp_path, {"trade": part("trade", [
        item("90001", "a", "Alderwick Solar Farm granted development consent", "2026-11-11", link="https://news.example.co.uk/?p=35578"),
        item("90001", "b", "Alderwick Solar Farm: residents respond", "2026-10-02", link="https://news.example.co.uk/?p=35579")])})
    assert len(shown(run.project("90001"))) == 2


@known("NL-019 finding 2", "reviewed research is one undifferentiated pile: 326 items, 113 undated, 4 dated since 31 October 2026")
def test_R06_reviewed_items_follow_their_dates_like_any_other(tmp_path):
    run = combine(tmp_path, {"reviewed": reviewed([
        item("90007", "r-recent", "Tarnside Solar Farm approved by committee", "2026-11-06", "regional"),
        item("90007", "r-2021", "Tarnside Solar Farm plan revealed", "2021-06-01", "regional"),
        item("90007", "r-undated", "Tarnside Solar Farm: the story so far", None, "regional")])})
    lists = tiers(run.project("90007"))
    assert [(i["link"].rsplit("/", 1)[-1], i["obtained"]) for i in lists["recent_news"]] == [("r-recent", "reviewed")]
    assert [i["link"].rsplit("/", 1)[-1] for i in lists["archive"]] == ["r-2021", "r-undated"]
    assert [i["year"] for i in lists["archive"]] == [2021, None]


# ---------------------------------------------------------------- R07 multi-project articles

BOTH = "Alderwick and Brantley Moor solar farms both granted development consent"
ONE = "Alderwick Solar Farm granted development consent"


@known("NL-019 finding 6", "a link on several projects is not recorded as one article about several projects")
def test_R07_an_article_naming_two_projects_is_listed_on_both_and_says_so(tmp_path):
    run = combine(tmp_path, {"reviewed": reviewed([item("90001", "both", BOTH, "2026-11-11"), item("90002", "both", BOTH, "2026-11-11")])})
    first, second = find(run.project("90001"), "both"), find(run.project("90002"), "both")
    assert first and second, "a valid two-project story must stay on both projects"
    assert first[0].get("also_projects") == ["90002"] and second[0].get("also_projects") == ["90001"]


@known("NL-019 finding 6", "five links sit on more than one project whatever their titles say")
def test_R07_an_article_naming_one_project_is_not_listed_on_another(tmp_path):
    run = combine(tmp_path, {"reviewed": reviewed([item("90001", "one", ONE, "2026-11-11"), item("90002", "one", ONE, "2026-11-11")])})
    assert find(run.project("90001"), "one"), "the article was lost from the project it names"
    assert not find(run.project("90002"), "one"), "the article is also listed on a project its title does not name"


@known("NL-019 finding 6", "the reviewed corpus has links on two projects each; the published file does not say so")
def test_R07_real_reviewed_corpus_every_shared_link_is_declared(tmp_path):
    run = combine(tmp_path, {"reviewed": REVIEWED}, top200=SIGNALS / "top200_solar.json", aliases=SIGNALS / "aliases.json")
    where = {}
    for ref, project in run.doc["projects"].items():
        for one in shown(project):
            where.setdefault(one["link"], []).append((ref, one))
    shared = {link: places for link, places in where.items() if len(places) > 1}
    undeclared = sorted(link for link, places in shared.items()
                        if any(sorted(one.get("also_projects") or []) != sorted(r for r, _ in places if r != ref) for ref, one in places))
    assert not undeclared, "%d link(s) on more than one project without also_projects: %s" % (len(undeclared), undeclared[:5])


# ---------------------------------------------------------------- R08 a sharp drop in the counts

@known("definition 5 and acid tester 5", "nothing stops publication when the counts fall sharply; the only gate (nothing == 0) cannot fire")
def test_R08_a_sharp_drop_in_the_counts_is_not_published(tmp_path):
    first = combine(tmp_path, base_parts(), name="first")
    before = first.out.read_bytes()
    had, had_items = projects_with_items(first.doc), total_items(first.doc)
    assert had >= 6
    wipe = {ref: {"exclude": ["solar"]} for ref in WORLD["aliases"]["projects"] if ref != "90001"}
    second = combine(tmp_path, base_parts(NEXT_COLLECTED), now=NEXT_DAY, previous=first.out, name="second", aliases_patch=wipe)
    if second.code == 0:
        assert projects_with_items(second.doc) * 3 >= had * 2 and total_items(second.doc) * 3 >= had_items * 2, \
            "published with %d of %d projects and %d of %d items left" % (
                projects_with_items(second.doc), had, total_items(second.doc), had_items)
    else:
        assert second.code == 3, "refusal must be exit code 3, got %d: %s" % (second.code, second.text[-300:])
        assert second.out.read_bytes() == before, "the combiner refused but still changed the published file"
        assert re.search(r"drop|fell|fall|third", second.text, re.I), "the refusal does not say why"


def test_R08_an_ordinary_second_run_is_published(tmp_path):
    first = combine(tmp_path, base_parts(), name="first")
    second = combine(tmp_path, base_parts(NEXT_COLLECTED), now=NEXT_DAY, previous=first.out, name="second")
    assert second.code == 0 and total_items(second.doc) >= total_items(first.doc), second.text[-400:]


# ---------------------------------------------------------------- R10 tiers and counts

@known("NL-019 findings 1, 2 and 8", "'161 of 200 with a signal' mixes recent news, old articles, official notices and reviewed research")
def test_R10_counts_are_by_tier_and_equal_what_the_items_give(tmp_path):
    run = combine(tmp_path, base_parts())
    assert not L.failures(run.doc, NOW), L.failures(run.doc, NOW)
    counts = run.doc["counts"]
    assert {ref: p["tier"] for ref, p in run.doc["projects"].items()} == {
        "90001": "recent_news", "90002": "official", "90003": "recent_news", "90004": "planning_file_only",
        "90005": "planning_file_only", "90006": "planning_file_only", "90007": "recent_news", "90008": "archive_only",
        "9050": "archive_only"}
    assert counts["by_tier"] == {"recent_news": 3, "official": 1, "archive_only": 2, "planning_file_only": 3, "nothing": 0}
    assert counts["headline"] == {"label": "projects with recent verified news", "value": 3}
    assert not {"with_signal", "with_confirmed_signal", "split"} & set(counts)


@known("NL-019 finding 2", "old and undated articles are counted with the news")
def test_R10_archive_and_official_items_never_reach_the_recent_news_count(tmp_path):
    run = combine(tmp_path, {
        "official": part("official", [item("90002", "o1", "Brantley Moor Solar Farm: decision", "2026-11-12", "official")]),
        "trade": part("trade", [item("90008", "t-2021", "Oxley Green Solar Farm proposed", "2021-05-04"),
                                item("90007", "t-possible", "Tarnside Solar Farm sold", "2026-11-12", confidence="uncertain"),
                                item("90001", "dev", "Alderwick Solar Farm: our plans", "2026-11-12", "developer",
                                     link="https://www.lightsourcebp.com/alderwick")])})
    counts = run.doc["counts"]
    assert counts["headline"]["value"] == 0 and counts["by_tier"]["recent_news"] == 0
    assert counts["by_tier"]["official"] == 1 and counts.get("with_possible_recent_news") == 1
    assert tiers(run.project("90001"))["archive"] and not tiers(run.project("90001"))["recent_news"], \
        "a developer's own page is not news, whatever its date"
    assert not L.failures(run.doc, NOW), L.failures(run.doc, NOW)


@known("NL-019 finding 2", "the committed reviewed corpus is shown as current signals")
def test_R10_real_reviewed_corpus_passes_every_live_rule_and_its_headline_is_small(tmp_path):
    run = combine(tmp_path, {"reviewed": REVIEWED}, top200=SIGNALS / "top200_solar.json", aliases=SIGNALS / "aliases.json")
    assert run.code == 0, run.text[-400:]
    problems = L.failures(run.doc, NOW)
    problems.pop("generated-at", None)          # nothing live was collected in this run: stale by design
    assert not problems, {rule: lines[:3] for rule, lines in problems.items()}
    cutoff = (dt.date(2026, 11, 14) - dt.timedelta(days=90)).isoformat()
    recent = {str(i["repd_ref"]) for i in REVIEWED["items"]
              if i.get("family") in NEWS_FAMILIES and isinstance(i.get("date"), str) and cutoff <= i["date"][:10] <= "2026-11-15"}
    value = run.doc["counts"]["headline"]["value"]
    assert value <= len(recent), "headline %d, but only %d projects have a reviewed publisher article since %s" % (value, len(recent), cutoff)


# ---------------------------------------------------------------- R11 planning file labels

@known("NL-019 finding 7", "every kind of link is labelled 'planning file', including an unverified search page")
def test_R11_a_register_search_is_not_labelled_as_a_planning_file(tmp_path):
    run = combine(tmp_path, {})
    for ref, project in run.doc["projects"].items():
        file = project["planning_file"]
        assert file["label"] in L.LABELS, "REPD %s: label %r" % (ref, file["label"])
        if file["kind"] == "search_page":
            assert file["label"].startswith("planning register") and file["link_type"] == "search" and file["verified"] is False
        else:
            assert file["label"].startswith("planning file (") and file["link_type"] == "direct"
        assert (file["label"] == "planning file (verified link)") == (file["verified"] is True)
    assert run.project("90006")["planning_file"]["label"].startswith("planning register")
    assert set(run.doc["counts"]["planning_file"]) == {"verified_direct", "unverified_direct", "register_search", "register_finder"}
    assert sum(run.doc["counts"]["planning_file"].values()) == len(run.doc["projects"])


# ---------------------------------------------------------------- R12 events and clusters

@known("definition 8 and NL-019 finding 6", "no event type; the same story from two publishers is two headlines, or one is silently dropped")
def test_R12_one_event_reported_twice_is_shown_once_with_its_sources(tmp_path):
    run = combine(tmp_path, {"trade": part("trade", [
        item("90001", "a", "Alderwick Solar Farm granted development consent", "2026-11-10", publisher="Example News"),
        item("90001", "b", "Alderwick Solar Farm wins development consent from Secretary of State", "2026-11-12", publisher="Other Press"),
        item("90002", "c", "Brantley Moor Solar Farm refused development consent", "2026-11-10")])})
    recent = tiers(run.project("90001"))["recent_news"]
    assert len(recent) == 1, "one consent, two reports: %d headlines shown" % len(recent)
    assert recent[0]["event"] == "consent" and recent[0]["link"].endswith("/b"), "the item shown is the newest dated confirmed one"
    assert recent[0].get("cluster") == "90001:consent:2026-11-10"
    assert [s["link"].rsplit("/", 1)[-1] for s in recent[0].get("sources") or []] == ["a"]
    assert tiers(run.project("90002"))["recent_news"][0]["event"] == "refusal"


@known("definition 8", "no event type is recorded")
@pytest.mark.parametrize("title, event", [
    ("Alderwick Solar Farm granted development consent", "consent"),
    ("Alderwick Solar Farm refused by Secretary of State", "refusal"),
    ("Alderwick Solar Farm appeal lodged", "appeal"),
    ("Alderwick Solar Farm reaches financial close", "financial_close"),
    ("Construction starts at Alderwick Solar Farm", "construction_start"),
    ("Alderwick Solar Farm energised", "energisation"),
    ("Alderwick Solar Farm: residents' views", None)])
def test_R12_the_event_is_recorded_only_where_the_title_states_it(tmp_path, title, event):
    run = combine(tmp_path, {"trade": part("trade", [item("90001", "e", title, "2026-11-10")])})
    kept = find(run.project("90001"), "e")
    assert kept and "event" in kept[0] and kept[0]["event"] == event, "event %r for %r" % (kept[0].get("event") if kept else None, title)


# ---------------------------------------------------------------- R13 provenance on every item

@known("definition 1 and NL-019 finding 1", "items carry no provenance: not how obtained, not which part, not when collected")
def test_R13_every_item_says_where_it_came_from_and_when(tmp_path):
    parts = base_parts()
    parts["reviewed"] = reviewed([item("90006", "r1", "Henwick Solar Park approved", "2026-10-01", "regional")])
    run = combine(tmp_path, parts)
    assert not L.failures(run.doc, NOW).get("schema"), L.failures(run.doc, NOW).get("schema")[:5]
    got = {i["link"].rsplit("/", 1)[-1]: (i["source"], i["obtained"], i["collected_at"]) for p in run.doc["projects"].values() for i in shown(p)}
    assert got["t-mill"] == ("trade", "fetched", COLLECTED) and got["o-consent"] == ("official", "fetched", COLLECTED)
    assert got["r1"][:2] == ("reviewed", "reviewed")
    assert set(run.doc["parts"]) >= {"official", "trade", "index", "reviewed", "planning"}
    assert run.doc["generated_at"] == COLLECTED and run.doc["run_at"] == NOW and run.doc["stale"] is False


# ---------------------------------------------------------------- R14 the integrated workflow

WORKFLOW = REPO / ".github" / "workflows" / "project-signals-acid.yml"


def test_R14_the_integrated_workflow_runs_every_signals_suite():
    text = WORKFLOW.read_text(encoding="utf-8")
    suites = sorted(str(p.relative_to(REPO)).replace("\\", "/") for p in
                    list(TESTS.glob("test_signals_*.py")) + list((SIGNALS / "tests").glob("test_*.py")))
    assert len(suites) >= 6
    missing = [s for s in suites if s not in text]
    assert not missing, "not run by the integrated workflow: %s" % missing
    assert "schedule:" in text and "pull_request:" in text and "automation/news/signals/**" in text
    assert "acid_report.py" in text and "acid_live.py" in text and "GITHUB_STEP_SUMMARY" in text
    assert "contents: read" in text and "contents: write" not in text, "the acid workflow must not be able to write"


def test_R14_the_summary_table_counts_passed_failed_and_known_failing(tmp_path):
    (tmp_path / "combiner.xml").write_text(
        '<testsuites><testsuite><testcase classname="a.b" name="ok"/><testcase classname="a.b" name="bad"><failure message="boom"/></testcase>'
        '<testcase classname="a.b" name="known"><skipped type="pytest.xfail" message="NL-019 finding 3: x"/></testcase>'
        '<testcase classname="a.b" name="open"><skipped type="pytest.xfail" message="OPEN, outside contract v2: y"/></testcase>'
        '<testcase classname="a.b" name="skip"><skipped type="pytest.skip" message="s"/></testcase></testsuite></testsuites>', encoding="utf-8")
    code = acid_report.main([str(tmp_path), "--expect", "combiner,trade", "--summary", str(tmp_path / "s.md"), "--json", str(tmp_path / "s.json")])
    text = (tmp_path / "s.md").read_text(encoding="utf-8")
    assert code == 1 and "| combiner | 5 | 1 | **1** | 1 | 1 | 1 |" in text
    assert "| trade | 0 | 0 | **1** | 0 | 0 | 0 |" in text, "a suite that did not run must count as failed"
    assert "NL-019 finding 3: x" in text and "| suite | tests | passed | failed |" in text
    (tmp_path / "combiner.xml").write_text('<testsuites><testsuite><testcase classname="a.b" name="ok"/></testsuite></testsuites>', encoding="utf-8")
    assert acid_report.main([str(tmp_path), "--expect", "combiner"]) == 0


# ---------------------------------------------------------------- R15 the live checker

def good_item(slug, date, tier, family="trade", confidence="confirmed", title=None):
    day = L.parse_day(date)
    fresh = "undated" if day is None else "recent" if day >= dt.date(2026, 8, 16) else "older"
    return {"title": title or "Example Solar Farm %s" % slug, "link": "https://news.example.co.uk/%s" % slug, "publisher": "Example News",
            "date": date, "year": day.year if day else None, "tier": tier, "event": None, "obtained": "fetched", "source": "trade",
            "family": family, "collected_at": COLLECTED, "confidence": confidence, "freshness": fresh, "basis": "exact phrase in title"}


def good_file():
    def project(ref, tier, recent=(), official=(), archive=(), label="planning register search"):
        return {"repd_ref": ref, "rank": 1, "site_name": "Example", "alias": "Example Solar Farm", "alias_standing": "confirmed",
                "tier": tier, "recent_news": list(recent), "official": list(official), "archive": list(archive),
                "planning_file": {"label": label, "link_type": "direct" if label.startswith("planning file") else "search",
                                  "authority": "Example", "reference": "1/2", "url": "https://register.example.gov.uk/", "kind":
                                  "application" if label.startswith("planning file") else "search_page",
                                  "verified": label == "planning file (verified link)", "note": ""}}
    projects = {
        "1": project("1", "recent_news", [good_item("a", "2026-11-10", "recent_news")], [], [good_item("b", "2021-01-05", "archive"),
                                                                                             good_item("c", None, "archive")]),
        "2": project("2", "official", [], [good_item("d", "2025-02-01", "official", "official")], label="planning file (verified link)"),
        "9050": project("9050", "archive_only", [], [], [good_item("e", "2021-02-17", "archive", "regional", title="Solar farm at Foston wins approval")]),
        "4": project("4", "planning_file_only")}
    ok = {"status": "ok", "collected_at": COLLECTED, "items": 1, "note": ""}
    return {"schema": "project-signals.v2", "generated_at": COLLECTED, "run_at": NOW, "stale": False, "scope": "test", "recent_days": 90,
            "parts": {"official": dict(ok), "trade": dict(ok), "index": dict(ok), "reviewed": dict(ok), "planning": dict(ok)},
            "counts": {"projects": 4, "headline": {"label": "projects with recent verified news", "value": 1},
                       "by_tier": {"recent_news": 1, "official": 1, "archive_only": 1, "planning_file_only": 1, "nothing": 0},
                       "possible_only": 0, "with_recent_news": 1, "with_official": 1, "with_archive": 2, "with_possible_recent_news": 0,
                       "items": {"recent_news": 1, "official": 1, "archive": 3},
                       "planning_file": {"verified_direct": 1, "unverified_direct": 0, "register_search": 3, "register_finder": 0}},
            "dropped": {}, "sources": [], "projects": projects}


def test_R15_live_checker_passes_a_file_that_meets_the_contract():
    assert L.failures(good_file(), NOW) == {}


def _diode(doc):
    doc["projects"]["9050"]["archive"][0]["title"] = "New bypass diode design cuts shading losses in PV modules"


def _undated_first(doc):
    doc["projects"]["1"]["archive"].reverse()


def _headline(doc):
    doc["counts"]["headline"]["value"] = 3


def _by_tier(doc):
    doc["counts"]["by_tier"].update(recent_news=2, archive_only=0)


def _old_as_recent(doc):
    moved = doc["projects"]["1"]["archive"].pop(0)
    doc["projects"]["1"]["recent_news"].append(dict(moved, tier="recent_news"))


def _nothing(doc):
    doc["projects"]["4"]["planning_file"] = None


def _future(doc):
    doc["projects"]["1"]["recent_news"][0].update(date="2027-01-01", year=2027)


def _impossible(doc):
    doc["projects"]["1"]["recent_news"][0].update(date="2026-02-30")


def _old_stamp(doc):
    doc["generated_at"] = "2026-11-10T05:00:00Z"
    for name in ("official", "trade", "index"):
        doc["parts"][name]["collected_at"] = "2026-11-10T05:00:00Z"


def _fresh_stamp_over_stale_parts(doc):
    for name in ("official", "trade", "index"):
        doc["parts"][name].update(status="stale", collected_at="2026-11-10T05:00:00Z")
    doc["stale"] = True


def _version_1(doc):
    doc["schema"] = "project-signals.v1"


@pytest.mark.parametrize("damage, rule", [
    (_diode, "repd-9050"), (_undated_first, "undated-order"), (_headline, "tier-counts"), (_by_tier, "tier-counts"),
    (_old_as_recent, "tier-purity"), (_nothing, "nothing"), (_future, "dates"), (_impossible, "dates"),
    (_old_stamp, "generated-at"), (_version_1, "schema")], ids=lambda v: getattr(v, "__name__", v))
def test_R15_live_checker_names_the_rule_that_is_broken(damage, rule):
    doc = good_file()
    damage(doc)
    assert rule in L.failures(doc, NOW), "the checker did not report %r" % rule


def test_R15_live_checker_accepts_an_old_generated_at_only_when_the_file_says_stale():
    doc = good_file()
    _old_stamp(doc)
    _fresh_stamp_over_stale_parts(doc)
    assert "generated-at" not in L.failures(doc, NOW)
    doc["stale"] = False
    assert "generated-at" in L.failures(doc, NOW)


def test_R15_live_checker_exit_code_and_summary_name_the_rule(tmp_path):
    doc = good_file()
    _diode(doc)
    path, summary = tmp_path / "project_signals.json", tmp_path / "summary.md"
    path.write_text(json.dumps(doc), encoding="utf-8")
    assert L.main([str(path), "--now", NOW, "--summary", str(summary)]) == 1
    assert "Failed: repd-9050" in summary.read_text(encoding="utf-8")
    path.write_text(json.dumps(good_file()), encoding="utf-8")
    assert L.main([str(path), "--now", NOW]) == 0
    path.write_text("not json", encoding="utf-8")
    assert L.main([str(path), "--now", NOW]) == 1
