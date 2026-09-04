#!/usr/bin/env python3
"""Unit tests for fail-closed homepage publication identity checks."""

from __future__ import annotations

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_published_versions as verifier


def homepage(strip_version: str, strip_generation: str, row_version: str, row_generation: str) -> str:
    return f'''<div class="os-strip"><a href="https://ventusltd.github.io/gridatlas/atlas/">UK Grid Atlas {strip_version} — Current Verified Release</a><span class="live-status">{strip_generation} · verified live</span></div>
/* <!-- GRIDATLAS_V9_AUTOMATION_START --> */
{{ data_gridatlas_release:"{row_generation}-gridatlas-{row_version}" }}
/* <!-- GRIDATLAS_V9_AUTOMATION_END --> */'''


class GridAtlasHomepageIdentityTests(unittest.TestCase):
    def test_matching_reader_and_governed_identity_passes(self) -> None:
        report: dict = {}
        failures = verifier.check_gridatlas_homepage_identity(
            homepage("V9.99", "202609032315", "v9.99", "202609032315"), report
        )
        self.assertEqual([], failures)
        self.assertEqual(report["gridatlas_named"], report["gridatlas_os_strip"])

    def test_stale_reader_identity_fails(self) -> None:
        failures = verifier.check_gridatlas_homepage_identity(
            homepage("V9.86", "202609030200", "v9.99", "202609032315"), {}
        )
        self.assertEqual(1, len(failures))
        self.assertIn("os-strip names v9.86 / 202609030200", failures[0])

    def test_missing_or_duplicate_identity_fails_closed(self) -> None:
        valid = homepage("V9.99", "202609032315", "v9.99", "202609032315")
        missing_failures = verifier.check_gridatlas_homepage_identity("", {})
        duplicate_failures = verifier.check_gridatlas_homepage_identity(valid + valid, {})
        self.assertEqual(2, len(missing_failures))
        self.assertEqual(2, len(duplicate_failures))


if __name__ == "__main__":
    unittest.main()
