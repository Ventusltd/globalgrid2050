#!/usr/bin/env python3
"""The homepage's constraints, as assertions that prove they can fail.

WHY THIS FILE EXISTS

Every rule below was given as an instruction, applied, and then lost - to a
session ending, a context window filling, or a later change made by someone who
never saw the instruction. That is not a memory problem anybody fixes by trying
harder to remember: an instruction that lives only in a conversation has a
half-life, and this estate has watched the same corrections given more than
once. So the constraints live here, and a session that regresses one gets a red
gate instead of a person noticing days later.

WHY IT IS SHAPED LIKE THIS

The first version of this file was itself the disease it exists to prevent.
Its rules read the page with regular expressions and asserted the result was
empty. Rename the shape those expressions look for - `{ name:"` to `{ label:"`,
`class="nest"` to `class="grp"` - and the expressions match nothing, the empty
list equals the empty list, and the gate reports success against a page it can
no longer see. Measured on 2026-09-06: of twelve assertions, eight passed
against a homepage whose entire structure had been renamed underneath them.

CVAA states the rule directly (Ventusltd/cvaa, 202609012310): a check may
refuse to run, but it may never refuse to run and call that success. Three
states, not two. So this file is built in two halves:

  audit()    returns findings, and reports BLINDNESS as a finding. If the
             landmarks it navigates by are missing, it says so loudly instead
             of returning an empty list that looks like health.

  DISEASES   a mutation per rule, each one a page that is wrong in exactly one
             way. Every rule must fire on its own diseased page. A rule that
             cannot fail is not a check.

Run:  python3 -B scripts/test_homepage_constraints.py
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"


# -- The decisions -----------------------------------------------------------

# Words that must not appear on a page a client reads. "Intelligence" was named
# directly: a prospective client reading it about their own grid data does not
# hear "analysis". The rest of the list is the same register.
FORBIDDEN_WORDS = ("intelligence", "surveillance", "targeting", "harvest",
                   "hostile", "amnesia", "vaccine", "antibody")

# The start page is a menu of SUBJECTS, not of applications. Taken from
# historical_builds.html, which already read clearly; the two federation
# categories were dropped from it by instruction.
REQUIRED_NESTS = ("Solar & BESS Topology", "UK Grid Tracking",
                  "Data Centres & Digital Infrastructure", "Cables & Conductors",
                  "Pricing & Materials", "Components", "Planning & Requirements",
                  "Reference & Knowledge", "About & Media")

REMOVED_CATEGORIES = ("GlobalGrid2050 OS & Federation", "Federation & Spider")

# Build state belongs in the repositories' READMEs; the dependency map is not a
# front-page concern.
REMOVED_BLOCKS = ("Building now", "Federation Map")

# The shapes every rule below navigates by. If one is missing, the page has
# been restructured, and a rule that reads it is not passing - it is blind.
LANDMARKS = (
    ("const AREAS = [", 1, "the category data block"),
    ('{ name:"', 100, "category and entry names"),
    ('<details class="area"', 1, "a rendered category"),
    ('id="test-code"', 1, "the Test Code lane"),
    ('<details class="nest"><summary>', 10, "Test Code sub-nests"),
    ('class="archive-note"', 1, "the grey archive line"),
)


def homepage() -> str:
    return INDEX.read_text(encoding="utf-8")


def strip_tags(html: str) -> str:
    """Reader-visible text only. A word inside a URL or an attribute is not a
    word a client reads, and flagging one would make this gate cry wolf."""
    html = re.sub(r"<script\b.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style\b.*?</style>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    return re.sub(r"<[^>]+>", " ", html)


# -- Sight -------------------------------------------------------------------

def blindness(html: str) -> list[str]:
    """What this gate cannot see. Reported as findings, never as silence."""
    out = []
    words = len(strip_tags(html).split())
    if words < 200:
        out.append(f"the page carries almost no reader-visible text ({words} words); "
                   f"no rule below could mean anything")
    for needle, minimum, what in LANDMARKS:
        n = html.count(needle)
        if n < minimum:
            out.append(f"{what}: found {n} of `{needle}`, expected at least {minimum} - "
                       f"the page has been restructured and these rules can no longer read it")
    return out


# -- The rules ---------------------------------------------------------------

RULES = {}


def rule(name):
    def wrap(fn):
        RULES[name] = fn
        return fn
    return wrap


def category_names(html: str) -> list[str]:
    return re.findall(r'\{ name:"([^"]+)", children:\[', html)


@rule("no-forbidden-words")
def _forbidden(html, root):
    text = strip_tags(html).lower()
    return [f'"{w}" is on a page a client reads' for w in FORBIDDEN_WORDS if w in text]


@rule("removed-blocks-stay-removed")
def _blocks(html, root):
    text = strip_tags(html)
    return [f'the "{b}" block has returned' for b in REMOVED_BLOCKS if b in text]


@rule("every-category-present")
def _categories(html, root):
    have = category_names(html)
    return [f'the category "{n}" is missing' for n in REQUIRED_NESTS if n not in have]


@rule("removed-categories-stay-removed")
def _removed(html, root):
    have = category_names(html)
    return [f'the category "{n}" was dropped by instruction and is back'
            for n in REMOVED_CATEGORIES if n in have]


@rule("no-entry-is-a-bare-timestamp")
def _bare(html, root):
    """A timestamp on its own communicates nothing. Every entry says what it is."""
    return [f'"{n}" is a timestamp and nothing else'
            for n in re.findall(r'\{ name:"([^"]+)"', html)
            if re.fullmatch(r"\d{12}", n.strip())]


@rule("no-red-status-notes")
def _notes(html, root):
    """The red note beside a name was monologue. Entries carry no note field."""
    n = len(re.findall(r'note:"', html))
    return [f"{n} note field(s) are back on homepage entries"] if n else []


@rule("category-titles-carry-no-timestamp")
def _cat_stamp(html, root):
    """A stamp on a CATEGORY title was tried and removed: the eye should land on
    a subject. Sub-nest titles are the opposite rule, below."""
    return [f'the category title "{n}" carries a timestamp'
            for n in category_names(html) if re.search(r"\d{12}", n)]


@rule("test-code-sub-nests-are-stamped-newest-first")
def _lane(html, root):
    """The opposite rule, and the reason the lane exists: the timestamp is the
    anchor that outlives anyone's memory of which build was which."""
    i = html.find('id="test-code"')
    if i == -1:
        return ["the Test Code lane is gone; it is codex's lane and not ours to remove"]
    labels = re.findall(r'<details class="nest"><summary>([^<]+)</summary>', html[i:])
    if not labels:
        return ["the Test Code lane holds no sub-nests"]
    out = [f'"{lbl}" carries no timestamp' for lbl in labels if not re.match(r"\d{12} ", lbl)]
    stamps = [lbl[:12] for lbl in labels if re.match(r"\d{12} ", lbl)]
    if stamps != sorted(stamps, reverse=True):
        out.append("the sub-nests are not newest-first")
    return out


@rule("newest-builds-lead-uk-grid-tracking")
def _lead(html, root):
    """Tonight's releases sit at the head of the category, so the newest thing
    is the first thing seen."""
    i = html.find('{ name:"UK Grid Tracking", children:[')
    if i == -1:
        return ["UK Grid Tracking is missing"]
    stamps = re.findall(r'name:"(\d{12}) ', html[i:i + 1200])
    if not stamps:
        return ["UK Grid Tracking carries no timestamped builds"]
    return [] if stamps == sorted(stamps, reverse=True) else ["its builds are not newest-first"]


@rule("every-link-resolves")
def _links(html, root):
    """Never link a guessed URL. A relative link must resolve to something
    committed in this repository."""
    hrefs = re.findall(r'<li[^>]*><a href="(\./[^"]+)"', html)
    if not hrefs:
        return ["no relative entry links were found at all"]
    out = []
    for href in hrefs:
        target = root / href.lstrip("./")
        if target.is_dir():
            if not (target / "index.html").is_file():
                out.append(f"{href} is a directory with no index.html")
        elif not target.is_file():
            out.append(f"{href} does not exist")
    return out


@rule("stated-counts-are-true")
def _counts(html, root):
    """A summary reading "(17)" above fifteen items was shipped once. A count is
    a claim, and a wrong one is worse than none. A 12-digit stamp in brackets is
    a name, not a count."""
    out = []
    # Every summary, with the items that follow it up to the next </details>.
    # Do NOT use one findall over `<details ...>(.*?)</details>`: it is
    # non-overlapping, so an outer <details> consumes the opening tag of the
    # first one inside it and that block is never examined. The gate's own
    # diseased fixture is what found this.
    for m in re.finditer(r"<summary>([^<]*)</summary>", html):
        stated = re.search(r"\((\d{1,3})\)\s*$", m.group(1))
        if not stated:
            continue
        end = html.find("</details>", m.end())
        block = html[m.end():end if end != -1 else len(html)]
        actual = len(re.findall(r"<li[\s>]", block))
        if actual != int(stated.group(1)):
            out.append(f'"{m.group(1).strip()}" lists {actual}')
    return out


@rule("archive-stays-buried")
def _archive(html, root):
    out = []
    if 'class="archive-note"' not in html:
        out.append("the grey Archive line is gone; the archive must stay reachable")
    if "historical_builds.html" not in html:
        out.append("the Archive line no longer points at historical_builds.html")
    # A published directory keeps the name it was published under - those paths
    # are immutable - so this counts the archive BLOCK, not the URLs.
    if "Pipeline News intelligence releases" in html:
        out.append("the archive listings have been pasted back onto the homepage")
    return out


def audit(html: str, root: Path = ROOT) -> list[str]:
    """Every finding, or blindness. Never an empty list it has not earned."""
    blind = blindness(html)
    if blind:
        return [f"CANNOT SEE THE PAGE: {b}" for b in blind]
    out = []
    for name, fn in RULES.items():
        out += [f"{name}: {m}" for m in fn(html, root)]
    return out


# -- The diseased fixtures ---------------------------------------------------
# One mutation per rule: a page wrong in exactly one way. A rule that does not
# fire on its own disease is not a check.

def _swap(find, repl, count=-1):
    return lambda h: h.replace(find, repl) if count < 0 else h.replace(find, repl, count)


def _oldest_first_in_uk_grid_tracking(html: str) -> str:
    """Swap the head of UK Grid Tracking with an older entry below it."""
    i = html.index('{ name:"UK Grid Tracking", children:[')
    body = html[i:i + 1200]
    stamps = re.findall(r'name:"(\d{12}) ', body)
    if len(stamps) < 2:
        return html
    newest, older = stamps[0], stamps[-1]
    swapped = body.replace(f'name:"{newest} ', 'name:"@@ ', 1)
    swapped = swapped.replace(f'name:"{older} ', f'name:"{newest} ', 1)
    swapped = swapped.replace('name:"@@ ', f'name:"{older} ', 1)
    return html[:i] + swapped + html[i + 1200:]


DISEASES = (
    ("no-forbidden-words",
     _swap("<footer", "<p>Grid intelligence briefing</p><footer", 1)),
    ("removed-blocks-stay-removed",
     _swap("<footer", "<p>Building now</p><footer", 1)),
    ("every-category-present",
     _swap('{ name:"Components", children:[', '{ name:"Widgets", children:[', 1)),
    ("removed-categories-stay-removed",
     _swap('{ name:"Components", children:[', '{ name:"Federation & Spider", children:[', 1)),
    ("no-entry-is-a-bare-timestamp",
     lambda h: re.sub(r'\{ name:"(\d{12}) — [^"]+"', r'{ name:"\1"', h, count=1)),
    ("no-red-status-notes",
     lambda h: re.sub(r'(\{ name:"\d{12} — [^"]+")', r'\1, note:"superseded"', h, count=1)),
    ("category-titles-carry-no-timestamp",
     _swap('{ name:"Components", children:[', '{ name:"202609060537 Components", children:[', 1)),
    ("test-code-sub-nests-are-stamped-newest-first",
     lambda h: re.sub(r'(<details class="nest"><summary>)\d{12} — ', r'\1', h, count=1)),
    ("newest-builds-lead-uk-grid-tracking", _oldest_first_in_uk_grid_tracking),
    ("every-link-resolves",
     _swap('<li><a href="./', '<li><a href="./no_such_build_202609061200/', 1)),
    ("stated-counts-are-true",
     lambda h: re.sub(r'(<details class="nest"><summary>[^<]+)(</summary>)', r'\1 (99)\2', h, count=1)),
    ("archive-stays-buried",
     _swap("historical_builds.html", "nowhere.html")),
)


# -- The gate ----------------------------------------------------------------

class TheHomepageHoldsItsConstraints(unittest.TestCase):
    def test_the_live_homepage_has_no_findings(self) -> None:
        found = audit(homepage())
        self.assertEqual([], found, "the homepage has regressed:\n  - " + "\n  - ".join(found))


class TheGateCanSeeThePage(unittest.TestCase):
    def test_a_page_missing_its_landmarks_is_reported_blind_not_healthy(self) -> None:
        """The failure this file was rebuilt to prevent: rename the shapes and
        the old gate went green against a page it could no longer read."""
        renamed = (homepage().replace('{ name:"', '{ label:"')
                             .replace('<details class="nest">', '<details class="grp">'))
        found = audit(renamed)
        self.assertTrue(found, "a restructured page produced no findings at all")
        self.assertTrue(all(f.startswith("CANNOT SEE THE PAGE") for f in found),
                        f"blindness was reported as ordinary findings: {found}")

    def test_an_empty_page_is_reported_blind(self) -> None:
        self.assertTrue(audit(""), "an empty page passed every constraint")

    def test_the_real_page_is_not_blind(self) -> None:
        self.assertEqual([], blindness(homepage()),
                         "the gate cannot navigate the page it is checking")


class EveryRuleFiresOnItsOwnDisease(unittest.TestCase):
    def test_every_rule_has_a_diseased_fixture(self) -> None:
        missing = sorted(set(RULES) - {n for n, _ in DISEASES})
        self.assertEqual([], missing, f"rules with no disease to prove them: {missing}")

    def test_each_rule_fires_on_its_own_disease(self) -> None:
        healthy = homepage()
        for name, mutate in DISEASES:
            with self.subTest(rule=name):
                sick = mutate(healthy)
                self.assertNotEqual(healthy, sick, "the mutation changed nothing")
                found = audit(sick)
                self.assertTrue(any(f.startswith(name + ":") for f in found),
                                f"{name} did not fire on its own disease; audit said {found}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
