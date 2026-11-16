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
        self.assertIn("pipeline-projects-rendered", notes)
        self.assertIn("Possible, unverified project headline",notes)
        self.assertNotIn("CONFIRMED BY MACHINE",notes)



    def test_late_gridatlas_card_collapse_must_be_checked(self):
        script=(repair.B/"tests/browser_real_map_to_engine_agent7.mjs").read_text()
        self.assertIn("visibility_stability",script)
        self.assertIn("visibilityStability.every",script)
        self.assertIn("1700, 4000, 4400",script)

    def test_feedback_keeps_failed_browser_probe_red(self):
        spec2=importlib.util.spec_from_file_location(
            "v923_feedback_under_test",SOURCE.parent/"feedback.py")
        feedback=importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(feedback)
        record={"versions":[{"id":repair.NEW,"checks":{
            "feature_probes":{"pass":False,"results":[
                {"name":"Native notes column","viewport":"phone","pass":False,
                 "detail":"Missing row cell"}]},
            "map_contract":{"pass":True}
        }}]}
        outcome=feedback.analyse(record, "frozen-test-sha")
        self.assertEqual(outcome["verdict"],"PRODUCT_CI_FAIL")
        self.assertEqual(outcome["failed_checks"],["feature_probes"])
        self.assertEqual(outcome["failed_browser_probes"][0]["viewport"],"phone")
        self.assertNotEqual(outcome["verdict"],"PRODUCT_CI_PASS_WITH_OPEN_EXTERNAL_HOLDS")

    def test_feedback_missing_mandatory_checks_is_incomplete(self):
        spec2=importlib.util.spec_from_file_location(
            "v923_feedback_under_test",SOURCE.parent/"feedback.py")
        feedback=importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(feedback)
        outcome=feedback.analyse({"versions":[{"id":repair.NEW,"checks":{}}]})
        self.assertEqual(outcome["verdict"],"INCOMPLETE_VERDICT")

    def test_feedback_static_pass_is_not_a_browser_pass(self):
        spec2=importlib.util.spec_from_file_location(
            "v923_feedback_under_test",SOURCE.parent/"feedback.py")
        feedback=importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(feedback)
        names=("tree_unchanged","runner","map_contract","grid_engine_contract",
               "map_links_identical_to_parent","data_unchanged_from_parent","features_kept")
        doc={"versions":[{"id":repair.NEW,"browser_checked":False,
              "checks":{n:{"pass":True} for n in names}}]}
        outcome=feedback.analyse(doc)
        self.assertEqual(outcome["verdict"],
          "STATIC_PARITY_PASS_BROWSER_AND_GRIDATLAS_PENDING")
        self.assertFalse(outcome["browser_checked"])

    def test_feedback_missing_verdict_is_not_success(self):
        spec2=importlib.util.spec_from_file_location(
            "v923_feedback_under_test",SOURCE.parent/"feedback.py")
        feedback=importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(feedback)
        self.assertEqual(feedback.analyse(None)["verdict"],"UNVERIFIED")
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
