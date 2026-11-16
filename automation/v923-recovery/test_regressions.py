#!/usr/bin/env python3
"""CVAA fail-closed checks: interrupted builds and two-vertical REPD table cells."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parent/"repair.py"
spec=importlib.util.spec_from_file_location("v923_repair_under_test",SOURCE)
repair=importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)

class IncompleteBuildTests(unittest.TestCase):
    def test_interrupted_after_create_must_fail(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"index.html").write_text("partial")
            with self.assertRaisesRegex(RuntimeError,"PARTIAL_CANDIDATE"):
                repair.require_completed_candidate(root,{"id":repair.NEW,"version":"V9.23","parent":repair.OLD,"runner":"tests/run_v9_23.sh","trees":["digest"]})

    def test_unregistered_candidate_must_fail(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(RuntimeError,"PARTIAL_CANDIDATE"):
                repair.require_completed_candidate(Path(d),{"id":repair.OLD,"version":"V9.22"})


    def test_inline_headline_summary_exists_and_is_candidate_only(self):
        notes=(repair.B/"scripts/plugins/machine-notes-v923.js").read_text()
        self.assertIn("headlineSummaryV923",notes)
        self.assertIn("Possible, unverified project headline",notes)
        self.assertNotIn("CONFIRMED BY MACHINE",notes)

    def test_candidate_columns_are_one_per_vertical(self):
        content=(repair.B/"scripts/plugins/projects-v9-8.js").read_text()
        marker="\nfunction projectRowHtml(project) {"
        self.assertEqual(content.count(marker),1)
        inter,repd=content.split(marker,1)
        self.assertEqual(inter.count('class="machine-note-cell"'),1)
        self.assertEqual(repd.count('class="machine-note-cell"'),1)
        self.assertNotIn('data-note-ref',inter)
        self.assertIn('data-note-ref=',repd)

if __name__=="__main__":
    unittest.main()
