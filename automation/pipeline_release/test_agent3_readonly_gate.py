#!/usr/bin/env python3
"""Agent3 independent negative release fixtures; no network, writer or deployment."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("agent3_readonly_gate", HERE / "agent3_readonly_gate.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
ORIGINAL_RECORDS = gate.RECORDS
NEW = "202611141930"

def valid_trees(repo, release):
    return gate.PROTECTED.get(release)

class Agent3GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.versions = self.repo / "uk_renewables_pipeline/versions.json"
        self.versions.parent.mkdir(parents=True)
        self.versions.write_text(json.dumps({"release_candidate":{"operative":{"id":gate.OPERATIVE}}}))
        self.folder = self.repo / "uk_renewables_pipeline" / NEW
        self.folder.mkdir(parents=True)
        self.part = self.folder / "data/v9.1/projects/part-001.json"
        self.part.parent.mkdir(parents=True)
        self.rows = [{"repd_ref":"1","technology":"solar"},
                     {"repd_ref":"2","technology":"bess"},
                     {"repd_ref":"3","technology":"wind_onshore"}]
        self.manifest = self.folder / "data/v9.1/build_manifest.json"
        self.original_records = gate.RECORDS
        gate.RECORDS = 3
        self.addCleanup(lambda: setattr(gate, "RECORDS", self.original_records))
        self.refresh()
        self.original_manifest = self.repo / "uk_renewables_pipeline" / gate.OPERATIVE / "data/v9.1/build_manifest.json"
        self.original_manifest.parent.mkdir(parents=True, exist_ok=True)
        self.original_manifest.write_text(self.manifest.read_text())
        (self.folder / "index.html").write_text("<!doctype html><title>Test</title>")

    def refresh(self):
        data = json.dumps({"projects": self.rows}, separators=(",", ":")).encode()
        self.part.write_bytes(data)
        self.manifest.write_text(json.dumps({
            "project_count": len(self.rows),
            "project_partitions": [{"path":"data/v9.1/projects/part-001.json",
                                    "record_count":len(self.rows),"sha256":gate.sha256(data)}]
        }))

    def check(self, candidate=NEW, tree_reader=valid_trees):
        return gate.verify(self.repo, candidate, tree_reader=tree_reader)

    def assert_blocked(self, result, contains):
        self.assertEqual(result["offline_integrity_status"], "FAIL")
        self.assertTrue(any(contains in e for e in result["errors"]), result["errors"])
        self.assertFalse(result["release_authorised"])
        self.assertEqual(result["publication_status"], "HOLD")

    def test_baseline_pass_but_release_hold(self):
        r = self.check(None)
        self.assertEqual(r["offline_integrity_status"], "PASS")
        self.assertEqual(r["acceptance_status"], "UNVERIFIED")
        self.assertFalse(r["release_authorised"])

    def test_small_valid_synthetic_candidate_still_hold(self):
        r = self.check()
        self.assertEqual(r["candidate_unique_repd_refs"], 3)
        self.assertEqual(r["offline_integrity_status"], "PASS")
        self.assertTrue(all(v == "UNVERIFIED" for v in r["required_external_acceptance"].values()))
        self.assertFalse(r["release_authorised"])

    def test_missing_candidate_fail(self):
        self.assert_blocked(self.check("202611141931"), "candidate folder absent")

    def test_existing_v921_id_rejected(self):
        self.assert_blocked(self.check(gate.V921), "candidate ID")

    def test_invalid_id_rejected(self):
        self.assert_blocked(self.check("../unsafe"), "candidate ID")

    def test_protected_tree_changed_fails(self):
        def tampered(repo, release):
            return "0" * 40 if release == gate.OPERATIVE else valid_trees(repo, release)
        self.assert_blocked(self.check(None, tampered), "protected release")

    def test_operative_pointer_changed_fails(self):
        self.versions.write_text(json.dumps({"release_candidate":{"operative":{"id":"202611141017"}}}))
        self.assert_blocked(self.check(None), "protected release")

    def test_duplicate_repd_identity_rejected(self):
        self.rows[1]["repd_ref"] = "1"
        self.refresh()
        self.assert_blocked(self.check(), "duplicate/invalid REPD")

    def test_bad_partition_sha_rejected(self):
        self.part.write_bytes(b'{"projects":[]}')
        self.assert_blocked(self.check(), "partition hash mismatch")

    def test_bad_partition_row_count_rejected(self):
        m = json.loads(self.manifest.read_text())
        m["project_partitions"][0]["record_count"] = 4
        self.manifest.write_text(json.dumps(m))
        self.assert_blocked(self.check(), "partition record count mismatch")

    def test_bad_total_count_rejected(self):
        m = json.loads(self.manifest.read_text())
        m["project_count"] = 7
        self.manifest.write_text(json.dumps(m))
        self.assert_blocked(self.check(), "REPD rows not exactly")

    def test_self_consistent_repd_source_substitution_rejected(self):
        self.rows[2]["repd_ref"] = "4"
        self.refresh()
        self.assert_blocked(self.check(), "differ from protected V9.20")

    def test_missing_html_rejected(self):
        (self.folder / "index.html").unlink()
        self.assert_blocked(self.check(), "candidate index.html absent")

    def test_missing_partition_rejected(self):
        self.part.unlink()
        self.assert_blocked(self.check(), "missing or unsafe")

    def test_path_traversal_partition_rejected(self):
        m = json.loads(self.manifest.read_text())
        m["project_partitions"][0]["path"] = "../outside.json"
        self.manifest.write_text(json.dumps(m))
        self.assert_blocked(self.check(), "missing or unsafe")

    def test_datacentre_project_type_rejected(self):
        self.rows[2]["technology"] = "data_centre"
        self.refresh()
        self.assert_blocked(self.check(), "DC identity")

    def test_datacentre_json_payload_rejected(self):
        (self.folder / "news").mkdir()
        (self.folder / "news/headlines.json").write_text('{"ref":"dcuk-123"}')
        self.assert_blocked(self.check(), "DC payload")

    def test_datacentre_javascript_payload_rejected(self):
        (self.folder / "app.js").write_text('const record={"technology":"datacentre"};')
        self.assert_blocked(self.check(), "DC payload")

    def test_zero_partitions_rejected(self):
        self.manifest.write_text('{"project_count":3,"project_partitions":[]}')
        self.assert_blocked(self.check(), "no project partitions")

    def test_missing_evidence_always_unverified_even_after_valid_offline(self):
        r=self.check()
        self.assertEqual(r["offline_integrity_status"], "PASS")
        self.assertEqual(len(r["required_external_acceptance"]), 11)
        self.assertNotIn("PASS", r["required_external_acceptance"].values())
        self.assertEqual(r["publication_status"], "HOLD")

if __name__ == "__main__":
    unittest.main()
