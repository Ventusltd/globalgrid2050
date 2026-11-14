"""Negative rights-gate fixtures. No external network and no source-rights claims."""
import copy
import importlib.util
import pathlib
import hashlib
import json
import unittest

PATH = pathlib.Path(__file__).resolve().parents[1] / "check_datacentre_rights.py"
spec = importlib.util.spec_from_file_location("dc_rights", PATH)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def fixture():
    source = {"id": "osm-1", "dataset": "OpenStreetMap", "url": "https://www.openstreetmap.org",
              "licence": "ODbL-1.0", "licence_url": "https://opendatacommons.org/licenses/odbl/1-0/",
              "attribution": "© OpenStreetMap contributors", "licence_status": "verified"}
    doc = {"schema": "globalgrid2050.pipeline-news.datacentre-sites.v1",
           "sites": [{"id": "dcuk-test-1", "sources": [source]}]}
    rights = {"sources": [{"source_id": "osm-1", "publisher": "OpenStreetMap Foundation",
                           "source_url": "https://www.openstreetmap.org", "licence": "ODbL-1.0",
                           "dataset": "OpenStreetMap",
                           "licence_url": "https://opendatacommons.org/licenses/odbl/1-0/",
                           "attribution": "© OpenStreetMap contributors",
                           "terms_url": "https://opendatacommons.org/licenses/odbl/1-0/",
                           "terms_sha256": "a" * 64, "checked_at": "2026-11-14",
                           "reviewer": "independent-reviewer", "redistribution": "verified",
                           "database_treatment": "collective"}]}
    register = {"features": [{"id": "dcuk-test-1", "properties":
                              {"id": "dcuk-test-1", "sources": [copy.deepcopy(source)]}}]}
    sha = hashlib.sha256(json.dumps(register, sort_keys=True).encode()).hexdigest()
    doc["register"] = {"sha256": sha}
    return doc, rights, register, sha


class RightsGateTests(unittest.TestCase):
    def test_complete_structural_fixture_passes_without_claiming_legal_clearance(self):
        doc, rights, register, sha = fixture()
        self.assertTrue(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_current_gridatlas_unverified_status_vetoes(self):
        doc, rights, register, sha = fixture()
        doc["sites"][0]["sources"][0]["licence_status"] = "unverified"
        result = gate.audit(doc, rights, register, sha, sha)
        self.assertFalse(result["pass"])
        self.assertEqual(result["unverified_source_entries"], 1)

    def test_missing_register_provenance_vetoes(self):
        doc, rights, register, sha = fixture()
        del doc["sites"][0]["sources"]
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_attribution_and_rights_evidence_must_both_exist(self):
        doc, rights, register, sha = fixture()
        doc["sites"][0]["sources"][0]["attribution"] = None
        rights["sources"][0]["terms_sha256"] = ""
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_receipt_for_other_source_cannot_clear_this_one(self):
        doc, rights, register, sha = fixture()
        rights["sources"][0]["source_url"] = "https://unrelated.example/"
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_odbl_derivative_without_access_vetoes(self):
        doc, rights, register, sha = fixture()
        rights["sources"][0]["database_treatment"] = "derivative"
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_actual_frozen_v918_candidate_is_blocked(self):
        root = pathlib.Path(__file__).resolve().parents[3]
        candidate = root / "uk_renewables_pipeline/202611140247/convergence/datacentres.json"
        doc = __import__("json").loads(candidate.read_text(encoding="utf-8"))
        report = gate.audit(doc, {"sources": []}, register, sha, sha)
        self.assertEqual(report["sites"], 226)
        self.assertEqual(report["source_entries"], 258)
        self.assertEqual(report["unverified_source_entries"], 258)
        self.assertFalse(report["pass"])

    def test_unknown_rights_and_duplicate_dc_ids_veto(self):
        doc, rights, register, sha = fixture()
        rights["sources"] = []
        doc["sites"].append(copy.deepcopy(doc["sites"][0]))
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])


    def test_truncated_candidate_cannot_pass_with_valid_looking_rights(self):
        doc, rights, register, sha = fixture()
        other = copy.deepcopy(register["features"][0])
        other["id"] = other["properties"]["id"] = "dcuk-test-2"
        register["features"].append(other)
        new_sha = hashlib.sha256(json.dumps(register, sort_keys=True).encode()).hexdigest()
        doc["register"]["sha256"] = new_sha
        self.assertFalse(gate.audit(doc, rights, register, new_sha, new_sha)["pass"])

    def test_substituted_site_and_source_veto(self):
        doc, rights, register, sha = fixture()
        doc["sites"][0]["id"] = "dcuk-invented"
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])
        doc, rights, register, sha = fixture()
        doc["sites"][0]["sources"][0]["url"] = "https://different.example"
        rights["sources"][0]["source_url"] = "https://different.example"
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])

    def test_receipt_dataset_licence_url_and_review_date_bound(self):
        for key, bad in (("dataset", "Other dataset"),
                         ("licence_url", "https://different.example"),
                         ("checked_at", "not-a-date"),
                         ("checked_at", "2099-01-01")):
            doc, rights, register, sha = fixture()
            rights["sources"][0][key] = bad
            self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"], key)

    def test_pinned_hash_required_and_candidate_metadata_bound(self):
        doc, rights, register, sha = fixture()
        self.assertFalse(gate.audit(doc, rights, register, "0" * 64, sha)["pass"])
        doc["register"]["sha256"] = "0" * 64
        self.assertFalse(gate.audit(doc, rights, register, sha, sha)["pass"])


if __name__ == "__main__":
    unittest.main()
