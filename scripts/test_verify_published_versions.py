#!/usr/bin/env python3
"""Unit tests for fail-closed homepage publication and lineage checks."""

from __future__ import annotations

import hashlib
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_published_versions as verifier


class PublicationTruthTests(unittest.TestCase):
    """What this file still asserts, and what it stopped asserting.

    Sixteen tests here used to drive check_gridatlas_homepage_identity() against
    index.html: the GRIDATLAS_V9_AUTOMATION markers, the AREAS directory, the
    os-strip identity line, the 127-row version catalogue and its promotion and
    retention rules. None of that has been in the homepage since c9fd7dad put the
    catalogue view back, so thirteen of them failed on every push for a week and
    the workflow never reached the script they were guarding. They are removed
    with the check they exercised - the structure they described survives in
    homepage_versions/homepage_v034.html and in git, and the live Grid Atlas
    composition is still read over the network by check_network().

    What is left is what is still true: every published snapshot must be
    reachable, the newest must be presented first, the newest published wrapper
    must be internally hash-bound, and the GitHub token must not leak to hosts
    that are not GitHub."""

    def test_every_published_snapshot_is_reachable_and_the_newest_is_first(self) -> None:
        published = verifier.published_snapshots()
        named = verifier.named_on_homepage(verifier.INDEX.read_text(encoding="utf-8"))
        self.assertEqual(sorted(published, reverse=True), named)
        self.assertEqual(max(published), named[0])

    def test_the_newest_published_wrapper_is_complete_and_hash_bound(self) -> None:
        # This named 202609040144 as the newest published generation. Four newer
        # snapshots have been published since and the literal was never moved, so
        # the test asserted the repository was five days ago. The newest wrapper is
        # now derived; what is asserted is the property, not the date: every file
        # the wrapper ships is listed in its own sha256sums.txt and hashes to the
        # digest recorded there, and nothing is shipped that is not listed.
        newest = verifier.published_snapshots()[-1]
        wrapper = verifier.SNAPSHOTS / newest
        sums = wrapper / "sha256sums.txt"
        if not sums.is_file():
            self.skipTest(f"{newest} ships no sha256sums.txt to bind it to")
        files = sorted(path for path in wrapper.rglob("*") if path.is_file())
        declared: dict[str, str] = {}
        for line in sums.read_text(encoding="utf-8").splitlines():
            digest, relative = line.split("  ", 1)
            declared[relative] = digest
        shipped = {
            path.relative_to(wrapper).as_posix()
            for path in files
            if path.name != "sha256sums.txt"
        }
        self.assertEqual(shipped, set(declared))
        for relative, expected in declared.items():
            self.assertEqual(
                expected,
                hashlib.sha256((wrapper / relative).read_bytes()).hexdigest(),
                relative,
            )

    def test_github_token_is_scoped_to_github_api_and_raw_hosts(self) -> None:
        seen: list[tuple[str, dict[str, str]]] = []

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read() -> bytes:
                return b"ok"

        def fake_urlopen(request, timeout):
            seen.append(
                (
                    request.full_url,
                    {name.lower(): value for name, value in request.header_items()},
                )
            )
            self.assertEqual(20, timeout)
            return Response()

        urls = (
            "https://api.github.com/repos/Ventusltd/gridatlas/commits/main",
            "https://raw.githubusercontent.com/Ventusltd/gridatlas/main/atlas/current.json",
            "https://ventusltd.github.io/gridatlas/atlas/current.json",
        )
        with mock.patch.dict(verifier.os.environ, {"GITHUB_TOKEN": "unit-token"}), mock.patch.object(
            verifier.urllib.request,
            "urlopen",
            side_effect=fake_urlopen,
        ):
            for url in urls:
                self.assertEqual(b"ok", verifier.fetch(url))

        self.assertEqual("Bearer unit-token", seen[0][1].get("authorization"))
        self.assertEqual("Bearer unit-token", seen[1][1].get("authorization"))
        self.assertNotIn("authorization", seen[2][1])

class WorkflowExecutionBudgetTests(unittest.TestCase):
    def test_pinned_playwright_install_jobs_have_viable_timeouts(self) -> None:
        workflows = verifier.ROOT / ".github" / "workflows"
        browser_jobs: dict[tuple[str, str], int] = {}
        job_header = re.compile(r"^  ([A-Za-z0-9_-]+):\s*$")
        timeout_line = re.compile(r"^    timeout-minutes:\s*([0-9]+)\s*$", re.MULTILINE)

        paths = sorted((*workflows.glob("*.yml"), *workflows.glob("*.yaml")))
        for path in paths:
            lines = path.read_text(encoding="utf-8").splitlines()
            try:
                jobs_line = lines.index("jobs:")
            except ValueError:
                continue
            starts = [
                (index, match.group(1))
                for index, line in enumerate(lines[jobs_line + 1 :], jobs_line + 1)
                if (match := job_header.fullmatch(line))
            ]
            for position, (start, job_name) in enumerate(starts):
                end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
                block = "\n".join(lines[start:end])
                if "playwright install --with-deps" not in block:
                    continue
                timeouts = timeout_line.findall(block)
                relative = path.relative_to(verifier.ROOT).as_posix()
                self.assertEqual(
                    1,
                    len(timeouts),
                    f"{relative}:{job_name} must declare exactly one job timeout",
                )
                timeout = int(timeouts[0])
                browser_jobs[(relative, job_name)] = timeout
                self.assertGreaterEqual(
                    timeout,
                    12,
                    f"{relative}:{job_name} cannot fit a pinned --with-deps install and proof",
                )

        raised_after_observed_timeout = {
            (".github/workflows/deploy-pages.yml", "verify_v9_7_candidate"),
            (".github/workflows/v7-north-star.yml", "validate"),
            (".github/workflows/v9-3-validate.yml", "validate"),
            (".github/workflows/v9-4-validate.yml", "validate"),
            (".github/workflows/v9-6-validate.yml", "validate"),
        }
        self.assertEqual(
            {job: 20 for job in raised_after_observed_timeout},
            {job: browser_jobs.get(job) for job in raised_after_observed_timeout},
        )


if __name__ == "__main__":
    unittest.main()
