"""Run from repository root: python -m unittest discover -s automation/news/tests -p test_grid_watch.py"""
import json
from copy import deepcopy
from pathlib import Path
import unittest

from automation.news.grid_watch import build_grid_rows, normalise

HERE = Path(__file__).resolve().parents[1] / "grid_watch"
SOURCES = {s["id"]: s for s in json.loads((HERE / "sources.json").read_text())["sources"]}
RECORDS = json.loads((HERE / "fixtures.json").read_text())["records"]


class GridWatchTest(unittest.TestCase):
    def test_three_official_operator_fixture_rows(self):
        rows = build_grid_rows(RECORDS, SOURCES)
        self.assertEqual(len(rows), 3)
        self.assertEqual({r["scheme"]["operator"] for r in rows}, {"NGET", "SSEN-T", "SPT"})
        self.assertTrue(all(r["evidence"]["licence_state"] == "UNASSESSED" and not r["publishable"] for r in rows))
        self.assertTrue(all(r["links"]["grid_connection"] is None and r["links"]["available_capacity_mw"] is None for r in rows))
        self.assertIsNone(next(r for r in rows if r["scheme"]["operator"] == "SSEN-T")["scheme"]["scheme_key"])

    def test_dedup_exact_observations_but_not_conflicts(self):
        b = deepcopy(RECORDS[0]); b["retrieved_at"] = "2026-11-17T00:00:00Z"
        self.assertEqual(len(build_grid_rows([RECORDS[0], b], SOURCES)), 1)
        b["stage"] = "consented"
        self.assertEqual(len(build_grid_rows([RECORDS[0], b], SOURCES)), 2)

    def test_status_never_promoted(self):
        row = normalise(RECORDS[1], SOURCES)
        self.assertEqual(row["evidence"]["reported_stage"], "under_construction")
        self.assertFalse(row["publishable"])
        self.assertIsNone(row["links"]["repd_ref"])

    def test_missing_identity_does_not_fuzzy_match(self):
        row = normalise(RECORDS[0], SOURCES)
        self.assertIsNone(row["scheme"]["scheme_key"])
        b = deepcopy(RECORDS[0]); b["scheme_name"] = "Bramford / Twinstead"
        self.assertIsNone(normalise(b, SOURCES)["scheme"]["scheme_key"])

    def test_exact_supplier_scheme_identifier_not_connection_proof(self):
        row = normalise(RECORDS[2], SOURCES)
        self.assertEqual(row["scheme"]["scheme_key"], "SPT:EGL1/E2DC")
        self.assertIsNone(row["links"]["grid_connection"])

    def test_reject_spoofed_url(self):
        for url in ("http://www.nationalgrid.com/foo", "https://www.nationalgrid.com.evil.test/foo",
                    "https://evil@www.nationalgrid.com/foo", "https://www.nationalgrid.com:444/foo"):
            b = dict(RECORDS[0], source_url=url)
            with self.subTest(url=url), self.assertRaises(ValueError): normalise(b, SOURCES)

    def test_reject_unverified_source_id_or_operator_disagreement(self):
        for patch in ({"source_id": "unknown"}, {"network_operator":"NESO"}):
            with self.assertRaises(ValueError): normalise(dict(RECORDS[0], **patch), SOURCES)

    def test_reject_unrecognised_evidence_claims(self):
        for patch in ({"connected_capacity_mw": 100}, {"stage": "approved"}, {"etys_node_code": "cot 41"}):
            with self.assertRaises(ValueError): normalise(dict(RECORDS[0], **patch), SOURCES)

    def test_exact_etys_code_remains_unverified_crosswalk(self):
        row = normalise(dict(RECORDS[0], etys_node_code="COTT41"), SOURCES)
        self.assertEqual(row["links"]["etys_node_code_as_reported"], "COTT41")
        self.assertFalse(row["links"]["etys_node_link_verified"])

    def test_metric_kinds_units_are_not_interchangeable(self):
        b = dict(RECORDS[0], reported_metric={"kind":"equipment_rating", "value":100, "unit":"MW"})
        with self.assertRaises(ValueError): normalise(b, SOURCES)
        b["reported_metric"] = {"kind":"equipment_rating", "value":100, "unit":"MVA"}
        self.assertEqual(normalise(b, SOURCES)["reported_metric"]["unit"], "MVA")
        for v in (True, "100", -1, float("nan")):
            b["reported_metric"]["value"] = v
            with self.assertRaises(ValueError): normalise(b, SOURCES)

    def test_preserves_explicit_source_rights_without_granting_publication(self):
        sources = deepcopy(SOURCES)
        sources["nget-projects"]["licence_state"] = "RESTRICTED"
        row = normalise(RECORDS[0], sources)
        self.assertEqual(row["evidence"]["licence_state"], "RESTRICTED")
        self.assertEqual(row["evidence"]["review_state"], "REVIEW_REQUIRED")
        self.assertFalse(row["publishable"])
        sources["nget-projects"].pop("licence_state")
        self.assertEqual(normalise(RECORDS[0], sources)["evidence"]["licence_state"], "UNASSESSED")

    def test_publication_cannot_follow_retrieval(self):
        b = dict(RECORDS[0], published_at="2027-01-01T00:00:00Z")
        with self.assertRaises(ValueError): normalise(b, SOURCES)

    def test_refuses_ambiguous_clock(self):
        with self.assertRaises(ValueError): normalise(dict(RECORDS[0], retrieved_at="2026-11-16"), SOURCES)


if __name__ == "__main__":
    unittest.main()
