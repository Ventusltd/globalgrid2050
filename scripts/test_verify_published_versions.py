#!/usr/bin/env python3
"""Unit tests for fail-closed homepage publication and lineage checks."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_published_versions as verifier


VALID_HOMEPAGE = verifier.INDEX.read_text(encoding="utf-8")


class GridAtlasHomepageIdentityTests(unittest.TestCase):
    def test_complete_catalogue_and_current_identity_pass(self) -> None:
        report: dict = {}
        failures = verifier.check_gridatlas_homepage_identity(VALID_HOMEPAGE, report)
        self.assertEqual([], failures)
        self.assertEqual(report["gridatlas_named"], report["gridatlas_os_strip"])
        self.assertEqual(124, report["gridatlas_catalogue_count"])
        self.assertEqual(
            {"generation": "202609040047", "version": "v9.102"},
            report["gridatlas_previous"],
        )
        self.assertEqual(
            {"LIVE": 8, "ARCHIVED": 109, "REJECTED_PRE_PROMOTION": 3, "MISSING": 4},
            report["gridatlas_catalogue_status_counts"],
        )
        self.assertEqual(
            {
                "BROKEN": 2,
                "MANIFEST_EVIDENCE": 101,
                "NONE": 4,
                "REACHABLE_UNVERIFIED": 13,
                "SOURCE_ONLY": 2,
                "WORKING_VERIFIED": 2,
            },
            report["gridatlas_catalogue_availability_counts"],
        )

    def test_stale_reader_identity_fails(self) -> None:
        invalid = VALID_HOMEPAGE.replace(
            "UK Grid Atlas V9.103 — Current Release (Working Verified)</a>"
            '<span class="live-status">202609040058',
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
            "the protected V1-to-V9.98 Grid Atlas catalogue foundation was rewritten",
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
            '  { name:"UK Grid Atlas V9.104 - 202609040104 -- Archived Evidence", '
            'url:"https://example.invalid/manifest.json", '
            'note:"ARCHIVED | MANIFEST EVIDENCE | generation 202609040104 | '
            'source commit 3506bfb2b4d298e6bb00132c05467d67a71e89af | '
            'checked_at 2026-09-04T00:40:53Z | '
            'immutable composition evidence; not a runnable application", '
            'data_gridatlas_catalogue:"v9.104|202609040104|ARCHIVED|MANIFEST_EVIDENCE|'
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
        self.assertNotIn("v9.104", VALID_HOMEPAGE.lower())

    def test_working_claim_is_limited_to_browser_proven_v8_and_v9103(self) -> None:
        failures: list[str] = []
        records = verifier.parse_gridatlas_catalogue(VALID_HOMEPAGE, failures)
        self.assertEqual([], failures)
        working = [record for record in records if record["availability"] == "WORKING_VERIFIED"]
        self.assertEqual(
            [("v8", None), ("v9.103", "202609040058")],
            [(record["version"], record["generation"]) for record in working],
        )
        self.assertIn("mobile browser click verified: Tesco produced [OK]", working[0]["note"])
        self.assertIn("mobile browser click verified at 393x852", working[1]["note"])

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
        current = by_identity[("v9.103", "202609040058")]
        self.assertEqual("WORKING_VERIFIED", current["availability"])
        self.assertEqual("03ac1fd5b094c59e21b311a7978c954111d3e330", current["commit"])
        self.assertTrue(all(record["checked_at"] for record in records))
        self.assertNotIn("Current Verified Release", VALID_HOMEPAGE)
        self.assertNotIn("LIVE VERIFIED · immutable timestamped release", VALID_HOMEPAGE)

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


if __name__ == "__main__":
    unittest.main()
