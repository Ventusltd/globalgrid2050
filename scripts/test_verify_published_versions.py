#!/usr/bin/env python3
"""Unit tests for fail-closed homepage publication and lineage checks."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_published_versions as verifier


VALID_HOMEPAGE = verifier.INDEX.read_text(encoding="utf-8")


class GridAtlasHomepageIdentityTests(unittest.TestCase):
    def test_pipeline_0144_wrapper_is_current_complete_and_hash_bound(self) -> None:
        published = verifier.published_snapshots()
        named = verifier.named_on_homepage(VALID_HOMEPAGE)
        self.assertEqual("202609040144", published[-1])
        self.assertEqual("202609040144", named[0])
        self.assertEqual(sorted(published, reverse=True), named)

        wrapper = verifier.SNAPSHOTS / "202609040144"
        files = sorted(path for path in wrapper.rglob("*") if path.is_file())
        self.assertEqual(64, len(files))
        manifest = json.loads((wrapper / "release-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual("202609040144-pipelinenews", manifest["release_id"])
        self.assertEqual("202609040044-pipelinenews", manifest["parent_release_id"])
        self.assertEqual(
            "ab80d45be05eb08b334af8bc93cfeb30d3b9d3d9",
            manifest["atlas_receiver_commit"],
        )

        declared: dict[str, str] = {}
        for line in (wrapper / "sha256sums.txt").read_text(encoding="utf-8").splitlines():
            digest, relative = line.split("  ", 1)
            declared[relative] = digest
        actual_paths = {
            path.relative_to(wrapper).as_posix()
            for path in files
            if path.name != "sha256sums.txt"
        }
        self.assertEqual(actual_paths, set(declared))
        for relative, expected in declared.items():
            self.assertEqual(expected, hashlib.sha256((wrapper / relative).read_bytes()).hexdigest())

    def test_complete_catalogue_and_current_identity_pass(self) -> None:
        report: dict = {}
        failures = verifier.check_gridatlas_homepage_identity(VALID_HOMEPAGE, report)
        self.assertEqual([], failures)
        self.assertEqual(report["gridatlas_named"], report["gridatlas_os_strip"])
        self.assertEqual(126, report["gridatlas_catalogue_count"])
        self.assertEqual(
            {"generation": "202609040134", "version": "v9.104"},
            report["gridatlas_previous"],
        )
        self.assertEqual(
            {"LIVE": 8, "ARCHIVED": 111, "REJECTED_PRE_PROMOTION": 3, "MISSING": 4},
            report["gridatlas_catalogue_status_counts"],
        )
        self.assertEqual(
            {
                "BROKEN": 2,
                "MANIFEST_EVIDENCE": 101,
                "NONE": 4,
                "REACHABLE_UNVERIFIED": 13,
                "SOURCE_ONLY": 2,
                "WORKING_VERIFIED": 4,
            },
            report["gridatlas_catalogue_availability_counts"],
        )

    def test_stale_reader_identity_fails(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            "UK Grid Atlas V9.105 — Current Release (Working Verified)</a>"
            '<span class="live-status">202609040219',
            "UK Grid Atlas V9.86 — Current Release (Working Verified)</a>"
            '<span class="live-status">202609030200',
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any("os-strip names v9.86 / 202609030200" in item for item in failures))

    def test_missing_identity_and_catalogue_fail_closed(self) -> None:
        failures = verifier.check_gridatlas_homepage_identity("", {})
        self.assertTrue(any("AUTOMATION block" in item for item in failures))
        self.assertTrue(any("os-strip identity" in item for item in failures))
        self.assertTrue(any("no Grid Atlas version catalogue" in item for item in failures))

    def test_malformed_catalogue_marker_is_not_silently_skipped(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            "v9.50|202609011251|ARCHIVED|MANIFEST_EVIDENCE|",
            "v9.50|202609011251|UNPROVEN|MANIFEST_EVIDENCE|",
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any("malformed" in item for item in failures))

    def test_foundation_row_cannot_be_rewritten(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            "UK Grid Atlas V1 -- Archived Evidence",
            "UK Grid Atlas V1 -- Altered Evidence",
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertIn(
            "the protected V1-to-v9.103 Grid Atlas catalogue foundation was rewritten",
            failures,
        )

    def test_missing_version_cannot_gain_an_invented_link(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            '{ name:"UK Grid Atlas V9.1 -- Missing", note:',
            '{ name:"UK Grid Atlas V9.1 -- Missing", url:"https://example.invalid/", note:',
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any("missing v9.1 invents" in item for item in failures))

    def test_future_version_requires_promotion_first(self) -> None:
        future = (
            '  { name:"UK Grid Atlas V9.106 - 202609040220 -- Archived Evidence", '
            'url:"https://example.invalid/202609040220-composition.json", '
            'note:"ARCHIVED | MANIFEST EVIDENCE | generation 202609040220 | '
            'source commit 3506bfb2b4d298e6bb00132c05467d67a71e89af | '
            'checked_at 2026-09-04T00:40:53Z | '
            'immutable composition evidence; not a runnable application", '
            'data_gridatlas_catalogue:"v9.106|202609040220|ARCHIVED|MANIFEST_EVIDENCE|'
            '3506bfb2b4d298e6bb00132c05467d67a71e89af|2026-09-04T00:40:53Z" },\n'
        )
        invalid = VALID_HOMEPAGE.replace(
            "]);\n/* GRIDATLAS_VERSION_CATALOGUE_END */",
            future + "]);\n/* GRIDATLAS_VERSION_CATALOGUE_END */",
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any("future Grid Atlas version" in item for item in failures))

    def test_missing_rows_render_as_disabled_text_not_broken_undefined_links(self) -> None:
        self.assertIn('r.url?`<a href="${encodeURI(r.url)}">', VALID_HOMEPAGE)
        self.assertIn('class="missing-entry" aria-disabled="true"', VALID_HOMEPAGE)
        self.assertIn("details.nest ul.drawer li { overflow-wrap:anywhere; }", VALID_HOMEPAGE)
        self.assertNotIn("v9.106", VALID_HOMEPAGE.lower())

    def test_working_claim_is_limited_to_browser_proven_versions(self) -> None:
        failures: list[str] = []
        records = verifier.parse_gridatlas_catalogue(VALID_HOMEPAGE, failures)
        self.assertEqual([], failures)
        working = [record for record in records if record["availability"] == "WORKING_VERIFIED"]
        self.assertEqual(
            [
                ("v8", None),
                ("v9.103", "202609040058"),
                ("v9.104", "202609040134"),
                ("v9.105", "202609040219"),
            ],
            [(record["version"], record["generation"]) for record in working],
        )
        self.assertIn("mobile browser click verified: Tesco produced [OK]", working[0]["note"])
        self.assertIn("mobile browser click verified at 393x852", working[1]["note"])
        self.assertIn("mobile browser click verified at 393x852", working[2]["note"])
        self.assertIn("mobile browser click verified at 393x852-class", working[3]["note"])

    def test_known_failures_rejected_candidates_and_current_proof_are_explicit(self) -> None:
        failures: list[str] = []
        records = verifier.parse_gridatlas_catalogue(VALID_HOMEPAGE, failures)
        by_identity = {(record["version"], record["generation"]): record for record in records}
        legacy = by_identity[("v9", "202608291237")]
        self.assertEqual("BROKEN", legacy["availability"])
        self.assertIn("repd_browser_registry returns HTTP 404", legacy["note"])
        former = by_identity[("v9.99", "202609032315")]
        self.assertEqual("MANIFEST_EVIDENCE", former["availability"])
        self.assertIn("known project-card hit-target regression", former["note"])
        rejected = [
            by_identity[("v9.100", "202609040021")],
            by_identity[("v9.101", "202609040046")],
            by_identity[("v9.102", "202609040047")],
        ]
        self.assertTrue(all(record["status"] == "REJECTED_PRE_PROMOTION" for record in rejected))
        self.assertTrue(all("never live" in record["note"] for record in rejected))
        prior = by_identity[("v9.103", "202609040058")]
        self.assertEqual("WORKING_VERIFIED", prior["availability"])
        self.assertEqual("ARCHIVED", prior["status"])
        previous = by_identity[("v9.104", "202609040134")]
        self.assertEqual("WORKING_VERIFIED", previous["availability"])
        self.assertEqual("ARCHIVED", previous["status"])
        current = by_identity[("v9.105", "202609040219")]
        self.assertEqual("WORKING_VERIFIED", current["availability"])
        self.assertEqual("LIVE", current["status"])
        self.assertEqual("5cb95611bae0eae031d493b7f2b6b3ef9ce2b995", current["commit"])
        self.assertIn("unchecked and disabled at [EMPTY]", current["note"])
        self.assertTrue(all(record["checked_at"] for record in records))
        self.assertNotIn("Current Verified Release", VALID_HOMEPAGE)
        self.assertNotIn("LIVE VERIFIED · immutable timestamped release", VALID_HOMEPAGE)

    def test_only_stale_v9_current_rows_receive_the_exact_archive_transition(self) -> None:
        failures: list[str] = []
        current = verifier.parse_gridatlas_catalogue(VALID_HOMEPAGE, failures)
        snapshot_text = (verifier.HOMEPAGE_VERSIONS / "homepage_v033.html").read_text(encoding="utf-8")
        snapshot = verifier.parse_gridatlas_catalogue(snapshot_text, failures)
        self.assertEqual([], failures)
        self.assertEqual(126, len(snapshot))
        self.assertEqual(126, len(current))

        changed = {("v9.103", "202609040058"), ("v9.104", "202609040134")}
        current_by_identity = {
            (record["version"], record["generation"]): record for record in current
        }
        for old in snapshot:
            identity = (old["version"], old["generation"])
            if identity in changed:
                self.assertEqual(
                    verifier.archived_gridatlas_record(old),
                    current_by_identity[identity],
                )
            else:
                self.assertEqual(old, current_by_identity[identity])

        def exact_rows(text: str) -> list[str]:
            match = verifier.GRIDATLAS_CATALOGUE_BLOCK_RE.search(text)
            self.assertIsNotNone(match)
            return [
                line
                for line in match.group("body").splitlines()
                if "data_gridatlas_catalogue:" in line
            ]

        snapshot_rows = exact_rows(snapshot_text)
        current_rows = exact_rows(VALID_HOMEPAGE)
        self.assertEqual(126, len(snapshot_rows))
        self.assertEqual(126, len(current_rows))
        changed_lines = []
        for old, new in zip(snapshot_rows, current_rows, strict=True):
            if old != new:
                changed_lines.append(old)
        self.assertEqual(2, len(changed_lines))
        self.assertTrue(any("v9.103|202609040058" in line for line in changed_lines))
        self.assertTrue(any("v9.104|202609040134" in line for line in changed_lines))

    def test_a_retained_live_row_cannot_be_rewritten(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            "with every authoritative and mirrored checkbox checked",
            "with every authoritative and mirrored checkbox rechecked",
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any("rewrote retained record v9.104" in item for item in failures))

    def test_v9105_is_the_only_mutable_current_v9_row(self) -> None:
        failures: list[str] = []
        records = verifier.parse_gridatlas_catalogue(VALID_HOMEPAGE, failures)
        self.assertEqual([], failures)
        v9_current = [
            record for record in records
            if record["version"].startswith("v9.")
            and record["url"] == verifier.GRIDATLAS_CURRENT_URL
        ]
        self.assertEqual([("v9.105", "202609040219")], [
            (record["version"], record["generation"]) for record in v9_current
        ])

        invalid = VALID_HOMEPAGE.replace(
            "https://ventusltd.github.io/gridatlas/atlas/manifests/202609040134-composition.json",
            verifier.GRIDATLAS_CURRENT_URL,
            1,
        )
        failures = verifier.check_gridatlas_homepage_identity(invalid, {})
        self.assertTrue(any(
            "v9.104 archived working evidence is not bound" in item
            or "prior v9.x catalogue rows still masquerade" in item
            for item in failures
        ))

        stale_snapshot = (
            verifier.HOMEPAGE_VERSIONS / "homepage_v033.html"
        ).read_text(encoding="utf-8")
        failures = verifier.check_gridatlas_homepage_identity(stale_snapshot, {})
        stale_failure = next(
            item for item in failures
            if "prior v9.x catalogue rows still masquerade" in item
        )
        self.assertIn("v9.103", stale_failure)
        self.assertIn("v9.104", stale_failure)

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

    def test_automation_markers_v8_sentinel_and_areas_wiring_fail_closed(self) -> None:
        cases = (
            ("GRIDATLAS_V9_AUTOMATION_START", "AUTOMATION_START marker"),
            ('url:"./repd_grid_atlasv8/"', "local V8 sentinel route"),
            ("children:[...GRIDATLAS_VERSION_CATALOGUE].reverse()", "wired into AREAS"),
        )
        for token, expected in cases:
            with self.subTest(token=token):
                invalid = VALID_HOMEPAGE.replace(token, "REMOVED_REQUIRED_TOKEN", 1)
                failures = verifier.check_gridatlas_homepage_identity(invalid, {})
                self.assertTrue(any(expected in failure for failure in failures))


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
