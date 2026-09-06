#!/usr/bin/env python3
"""The homepage's constraints, as assertions rather than as prose.

WHY THIS FILE EXISTS

Every rule in this file was given as an instruction, applied, and then lost —
either to a session ending, a context window filling, or a later change made by
someone who never saw the instruction. That is not a memory problem anybody can
fix by trying harder to remember: an instruction that lives only in a
conversation has a half-life, and the estate has watched the same corrections
be given more than once.

So the constraints live here. A future session that regresses one of them gets
a red gate instead of a person noticing days later. The rules below are not
this file's opinion about good design; each one is a decision already taken,
written down so it survives the person who took it.

Run:  python3 -B scripts/test_homepage_constraints.py
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

# Words that must not appear on a page a client will read. "Intelligence" was
# named directly: a prospective client reading it about their own grid data
# does not hear "analysis", and the rest of this list is the same register.
FORBIDDEN_WORDS = (
    "intelligence",
    "surveillance",
    "targeting",
    "harvest",
    "hostile",
    "amnesia",
    "vaccine",
    "antibody",
)

# The start page is a menu of SUBJECTS, not of applications. This structure was
# chosen from historical_builds.html, which already read clearly, and the two
# federation categories were dropped from it by instruction.
REQUIRED_NESTS = (
    "Solar & BESS Topology",
    "UK Grid Tracking",
    "Data Centres & Digital Infrastructure",
    "Cables & Conductors",
    "Pricing & Materials",
    "Components",
    "Planning & Requirements",
    "Reference & Knowledge",
    "About & Media",
)

# Dropped by instruction and not to return.
REMOVED_CATEGORIES = ("GlobalGrid2050 OS & Federation", "Federation & Spider")

# Removed deliberately. Build state belongs in the repositories' READMEs, and
# the dependency map is not a front-page concern.
REMOVED_BLOCKS = ("Building now", "Federation Map")


def homepage() -> str:
    return INDEX.read_text(encoding="utf-8")


def strip_tags(html: str) -> str:
    """Reader-visible text only. A word inside a URL or an attribute is not a
    word a client reads, and flagging one would make this gate cry wolf."""
    html = re.sub(r"<script\b.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style\b.*?</style>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    html = re.sub(r"<[^>]+>", " ", html)
    return html


class HomepageReadsCleanly(unittest.TestCase):
    def test_no_forbidden_words_in_reader_visible_text(self) -> None:
        text = strip_tags(homepage()).lower()
        found = sorted({w for w in FORBIDDEN_WORDS if w in text})
        self.assertEqual([], found,
                         f"words a client should not read are on the homepage: {found}")

    def test_removed_blocks_stay_removed(self) -> None:
        text = strip_tags(homepage())
        present = [b for b in REMOVED_BLOCKS if b in text]
        self.assertEqual([], present,
                         f"blocks removed by decision have returned: {present}")


class HomepageIsAMenu(unittest.TestCase):
    def test_every_required_category_exists(self) -> None:
        html = homepage()
        declared = re.findall(r'\{ name:"([^"]+)", children:\[', html)
        missing = [n for n in REQUIRED_NESTS if n not in declared]
        self.assertEqual([], missing, f"categories missing from the homepage: {missing}")

    def test_removed_categories_stay_removed(self) -> None:
        html = homepage()
        declared = re.findall(r'\{ name:"([^"]+)", children:\[', html)
        back = [n for n in REMOVED_CATEGORIES if n in declared]
        self.assertEqual([], back, f"categories removed by instruction have returned: {back}")

    def test_no_entry_is_a_bare_timestamp(self) -> None:
        """A timestamp on its own communicates nothing. Every entry says what it is."""
        bare = [n for n in re.findall(r'\{ name:"([^"]+)"', homepage())
                if re.fullmatch(r"\d{12}", n.strip())]
        self.assertEqual([], bare, f"entries that are only a timestamp: {bare}")

    def test_no_red_status_notes(self) -> None:
        """The red note beside a name was monologue. Entries carry no note field."""
        self.assertEqual(0, len(re.findall(r'note:"', homepage())),
                         "note fields are back on homepage entries")

    def test_nest_titles_carry_no_timestamp(self) -> None:
        """A stamp on the title was tried and removed. The eye should land on a
        name; the stamps live inside."""
        offenders = []
        for title in re.findall(r"<summary>([^<]+)</summary>", homepage()):
            if re.search(r"\d{12}", title):
                offenders.append(title.strip())
        self.assertEqual([], offenders,
                         f"nest titles carry a timestamp again: {offenders}")

    def test_the_newest_builds_lead_uk_grid_tracking(self) -> None:
        """Tonight's current releases sit at the head of the category, so the
        newest thing is the first thing seen."""
        html = homepage()
        i = html.index('{ name:"UK Grid Tracking", children:[')
        head = html[i:i + 1200]
        stamps = re.findall(r'name:"(\d{12}) —', head)
        self.assertTrue(stamps, "UK Grid Tracking carries no timestamped builds")
        self.assertEqual(sorted(stamps, reverse=True), stamps,
                         "the newest builds are not newest-first")


class EveryLinkedVersionExists(unittest.TestCase):
    def test_no_nest_links_at_a_version_that_is_not_published(self) -> None:
        """Never link a guessed URL. A relative link from the homepage must
        resolve to something committed in this repository."""
        html = homepage()
        missing = []
        for href in re.findall(r'<li[^>]*><a href="(\./[^"]+)"', html):
            target = ROOT / href.lstrip("./")
            if target.is_dir():
                if not (target / "index.html").is_file():
                    missing.append(href + " (directory with no index.html)")
            elif not target.is_file():
                missing.append(href)
        self.assertEqual([], missing, f"homepage links at things that do not exist: {missing}")


class StatedCountsAreTrue(unittest.TestCase):
    def test_a_summary_that_states_a_count_states_the_right_one(self) -> None:
        """A summary reading "(17)" above fifteen items was shipped once. A
        count is a claim, and a wrong one is worse than none."""
        html = homepage()
        wrong = []
        for block in re.findall(r"<details[^>]*>(.*?)</details>", html, flags=re.S):
            summary = re.search(r"<summary>([^<]*)</summary>", block)
            if not summary:
                continue
            stated = re.search(r"\((\d+)\)", summary.group(1))
            if not stated:
                continue
            actual = len(re.findall(r"<li[\s>]", block))
            if actual != int(stated.group(1)):
                wrong.append(f"{summary.group(1).strip()} lists {actual}")
        self.assertEqual([], wrong, f"stated counts disagree with the lists: {wrong}")


class TheArchiveStaysBuried(unittest.TestCase):
    def test_the_archive_is_one_quiet_line_not_a_section(self) -> None:
        html = homepage()
        self.assertIn('class="archive-note"', html,
                      "the grey Archive line is gone; the archive must stay reachable")
        self.assertIn("historical_builds.html", html,
                      "the Archive line no longer points at historical_builds.html")
        # The listings themselves must not come back. A published directory is
        # allowed to keep the name it was published under - those paths are
        # immutable - so this counts the archive BLOCK, not the URLs.
        self.assertNotIn("Pipeline News intelligence releases", html,
                         "the archive listings have been pasted back onto the homepage")


if __name__ == "__main__":
    unittest.main(verbosity=2)
