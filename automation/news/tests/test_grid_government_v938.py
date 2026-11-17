"""V9.38 additive government-fact tests; original donor tests remain byte-exact."""
import json
from copy import deepcopy
from pathlib import Path
import unittest
from automation.news.grid_watch.government_v938 import build_grid_rows, normalise, reviewed_government_notice, FACTS_RIGHTS_SCOPE
HERE = Path(__file__).resolve().parents[1] / "grid_watch"
SOURCES = {s["id"]: s for name in ("sources.json", "government-sources.v938.json") for s in json.loads((HERE / name).read_text())["sources"]}
RECORDS = json.loads((HERE / "fixtures.json").read_text())["records"]
GOV_RECORDS = json.loads((HERE / "government-facts.json").read_text())["records"]

class GridGovernmentV938Test(unittest.TestCase):
    def test_government_publisher_is_not_reported_operator(self):
        rows = build_grid_rows(GOV_RECORDS, SOURCES)
        self.assertEqual(len(rows), 2)
        self.assertEqual({r["evidence"]["publisher"] for r in rows}, {"Planning Inspectorate", "Department for Energy Security and Net Zero"})
        self.assertTrue(all(r["scheme"]["operator"] == "NGET" and r["evidence"]["role"] == "government_authority" for r in rows))
        self.assertTrue(all(r["scheme"]["scheme_key"] is None and not r["publishable"] for r in rows))
        self.assertTrue(all(r["links"]["repd_ref"] is None and r["links"]["grid_connection"] is None and r["links"]["available_capacity_mw"] is None for r in rows))

    def test_actual_government_receipts_and_day_clocks_remain_distinct(self):
        rows = build_grid_rows(GOV_RECORDS, SOURCES)
        for row in rows:
            e = row["evidence"]
            self.assertIsNone(e["published_at"])
            self.assertEqual(e["published_date"], {"value": "2026-10-30", "precision": "DAY"})
            self.assertEqual(e["event_date"], {"value": "2026-10-30", "precision": "DAY"})
            self.assertEqual(e["source_sha256"], e["source_receipt"]["sha256"])
            self.assertEqual(e["source_receipt"]["http_status"], 200)
            self.assertGreater(e["source_receipt"]["bytes"], 60000)
        pins = next(r for r in rows if r["evidence"]["publisher"] == "Planning Inspectorate")
        self.assertEqual(pins["evidence"]["milestones"]["application_submitted"]["value"], "2025-03-27")
        self.assertEqual(pins["evidence"]["milestones"]["accepted_for_examination"]["value"], "2025-04-23")
        self.assertEqual(pins["evidence"]["milestones"]["recommendation"]["value"], "2026-07-30")

    def test_government_clock_rejects_fabricated_midnight_and_impossible_day(self):
        for patch in ({"published_at": "2026-10-30T00:00:00Z"}, {"published_date": {"value": "2026-10-30T00:00:00Z", "precision": "DAY"}}, {"event_date": {"value": "2026-02-30", "precision": "DAY"}}, {"published_date": None}, {"event_date": {"value": "2027-01-01", "precision": "DAY"}}):
            with self.subTest(patch=patch), self.assertRaises(ValueError): normalise(dict(GOV_RECORDS[0], **patch), SOURCES)

    def test_government_exact_url_hash_receipt_and_attribution_refuse_spoofs(self):
        for patch in ({"source_url": "https://www.gov.uk/government/news/unreviewed"}, {"source_url": GOV_RECORDS[0]["source_url"]+"?copy=1"}, {"source_url": "https://www.gov.uk.evil.example/source"}, {"source_sha256": "0"*64}, {"network_operator": "NESO"}, {"source_receipt": {}}):
            with self.subTest(patch=patch), self.assertRaises(ValueError): normalise(dict(GOV_RECORDS[0], **patch), SOURCES)
        for patch in ({"publisher": "NGET"}, {"operator": "NGET"}, {"reported_operators": ["NGET", "NESO"]}):
            sources = deepcopy(SOURCES);sources[GOV_RECORDS[0]["source_id"]].update(patch)
            with self.subTest(source_patch=patch), self.assertRaises(ValueError): normalise(GOV_RECORDS[0], sources)

    def test_one_notice_two_documents_unknown_counts_and_review_gate(self):
        rows = build_grid_rows(GOV_RECORDS, SOURCES);pending = reviewed_government_notice(rows)
        self.assertFalse(pending["publishable"]);self.assertIsNone(pending["notice_count"]);self.assertEqual(pending["document_count"], 2)
        self.assertEqual(pending["facts"]["planned_metric"], {"kind": "planned_transmission_upper_bound", "value": 2000, "unit": "MW"})
        self.assertIsNone(pending["facts"]["current_capacity_mw"]);self.assertIsNone(pending["facts"]["coordinates"])
        # Synthetic review references test the gate; they do not represent actual approval.
        approval = {"state": "APPROVED_FACTS_ONLY", "rights_scope": FACTS_RIGHTS_SCOPE, "facts_sha256": pending["facts_sha256"], "reviews": [{"role": "AGENT_A", "decision": "PASS", "reference": "https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-100"}, {"role": "AGENT_B", "decision": "PASS", "reference": "https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-101"}]}
        self.assertTrue(reviewed_government_notice(rows, approval)["publishable"])
        for patch in ({"rights_scope": "all_gov_content"}, {"facts_sha256": "0"*64}, {"reviews": approval["reviews"][:1]}, {"state": "REVIEW_REQUIRED"}):
            with self.subTest(patch=patch), self.assertRaises(ValueError): reviewed_government_notice(rows, dict(approval, **patch))
        changed = deepcopy(rows);changed[0]["links"]["available_capacity_mw"] = 2000
        with self.assertRaises(ValueError): reviewed_government_notice(changed, approval)
        changed = deepcopy(rows);changed[0]["evidence"]["licence_state"] = "RESTRICTED"
        with self.assertRaises(ValueError): reviewed_government_notice(changed, approval)
        with self.assertRaises(ValueError): reviewed_government_notice(build_grid_rows(RECORDS, SOURCES), approval)


if __name__ == "__main__":
    unittest.main()
