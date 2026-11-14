"""Negative rights-gate fixtures. No external network and no source-rights claims."""
import copy
import importlib.util
import pathlib
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
                           "terms_url": "https://opendatacommons.org/licenses/odbl/1-0/",
                           "terms_sha256": "a" * 64, "checked_at": "2026-11-14",
                           "reviewer": "independent-reviewer", "redistribution": "verified",
                           "database_treatment": "collective"}]}
    return doc, rights


class RightsGateTests(unittest.TestCase):
    def test_complete_structural_fixture_passes_without_claiming_legal_clearance(self):
        doc, rights = fixture()
        self.assertTrue(gate.audit(doc, rights)["pass"])

    def test_current_gridatlas_unverified_status_vetoes(self):
        doc, rights = fixture()
        doc["sites"][0]["sources"][0]["licence_status"] = "unverified"
        result = gate.audit(doc, rights)
        self.assertFalse(result["pass"])
        self.assertEqual(result["unverified_source_entries"], 1)

    def test_missing_register_provenance_vetoes(self):
        doc, rights = fixture()
        del doc["sites"][0]["sources"]
        self.assertFalse(gate.audit(doc, rights)["pass"])

    def test_attribution_and_rights_evidence_must_both_exist(self):
        doc, rights = fixture()
        doc["sites"][0]["sources"][0]["attribution"] = None
        rights["sources"][0]["terms_sha256"] = ""
        self.assertFalse(gate.audit(doc, rights)["pass"])

    def test_odbl_derivative_without_access_vetoes(self):
        doc, rights = fixture()
        rights["sources"][0]["database_treatment"] = "derivative"
        self.assertFalse(gate.audit(doc, rights)["pass"])

    def test_unknown_rights_and_duplicate_dc_ids_veto(self):
        doc, rights = fixture()
        rights["sources"] = []
        doc["sites"].append(copy.deepcopy(doc["sites"][0]))
        self.assertFalse(gate.audit(doc, rights)["pass"])


if __name__ == "__main__":
    unittest.main()
