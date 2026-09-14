import copy
import json
import tempfile
import unittest
from pathlib import Path

import concept_compute
import merge_results


ROOT = Path(__file__).resolve().parents[2]


class DualComputeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = concept_compute.build_payload(ROOT)

    def result(self, lane):
        return {
            "lane": lane,
            "generated_utc": "2026-09-15T00:10:00Z",
            "runner": {"python": "test", "system": "test"},
            "git_commit": "test",
            "payload_sha256": concept_compute.digest(concept_compute.canonical(self.payload)),
            "payload": self.payload,
        }

    def test_pinned_solar_evidence(self):
        pipeline = self.payload["inputs"]["pipeline"]
        self.assertEqual(3563, pipeline["solar_projects"])
        self.assertEqual(67013, pipeline["solar_mw_rounded"])
        self.assertEqual(3558, pipeline["solar_with_coordinates"])
        self.assertEqual(
            {"14773", "17260", "1613", "17120", "1616"},
            {p["repd_ref"] for p in pipeline["missing_coordinate_projects"]},
        )
        self.assertFalse(self.payload["reconciliation_findings"][0]["matches"])
        self.assertTrue(self.payload["all_checks_pass"])

    def test_local_and_ci_merge_when_identical(self):
        merged = merge_results.merge(self.result("local"), self.result("ci"))
        self.assertTrue(merged["agreement"])

    def test_merge_rejects_divergence(self):
        local = self.result("local")
        ci = copy.deepcopy(self.result("ci"))
        ci["payload"]["checks"]["solar_projects"] = False
        ci["payload_sha256"] = concept_compute.digest(concept_compute.canonical(ci["payload"]))
        with self.assertRaisesRegex(ValueError, "divergence"):
            merge_results.merge(local, ci)


if __name__ == "__main__":
    unittest.main()
