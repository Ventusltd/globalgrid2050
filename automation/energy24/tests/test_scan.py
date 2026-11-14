import json
from pathlib import Path
import tempfile
import unittest
from datetime import datetime, timezone
from automation.energy24 import scan

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=timezone.utc)
DCD = {"id":"dcd","name":"DCD","tier":"attributed"}
GOV = {"id":"desnz","name":"DESNZ","tier":"official"}


def item(headline, context="", publisher=DCD, url="https://www.datacenterdynamics.com/en/news/example/"):
    return {"headline":headline,"context":context,"publisher":publisher,"url":url,"published":NOW}


class Energy24Tests(unittest.TestCase):
    def setUp(self):
        self.repd = {"12345":{"Installed Capacity (MWelec)":"95.0","Site Name":"Name cannot establish identity"},
                     "23456":{"Installed Capacity (MWelec)":"40.0","Site Name":"Below threshold"}}

    def classify(self, headline, context="", publisher=DCD):
        return scan.classify(item(headline, context, publisher), self.repd, NOW)

    def test_no_false_repd_name_binding(self):
        v, _ = self.classify("95MW solar scheme begins construction", "Name cannot establish identity")
        self.assertIsNotNone(v)
        self.assertIsNone(v["repd_ref"])
        self.assertEqual(v["category"], "global-projects")

    def test_explicit_repd_ref_is_master_key(self):
        v, why = self.classify("REPD Ref 12345: solar farm reaches planning", "", GOV)
        self.assertEqual(why, "accepted")
        self.assertEqual(v["repd_ref"], "12345")
        self.assertEqual(v["capacity_mw"], 95.0)
        self.assertEqual(v["qualification"], "repd_exact_ref")

    def test_unknown_and_small_repd_are_rejected(self):
        self.assertEqual(self.classify("REPD Ref 77777 solar", "")[1], "unknown_repd_ref")
        self.assertEqual(self.classify("REPD Ref 23456 solar", "")[1], "below_50mw")

    def test_49mw_project_rejected(self):
        self.assertEqual(self.classify("Solar developer plans a 49MW scheme")[1], "below_or_unverified_threshold")

    def test_exact_50mw_project_accepted(self):
        v, why = self.classify("New UK solar project announced at 50MW")
        self.assertEqual(why, "accepted")
        self.assertEqual(v["capacity_mw"], 50)

    def test_megawatt_hours_not_confused_with_mw(self):
        self.assertIsNone(scan.capacity_mw("New 200MWh BESS project"))
        self.assertEqual(self.classify("200MWh battery storage development")[1], "below_or_unverified_threshold")

    def test_usd_threshold_exact(self):
        self.assertEqual(scan.money_usd("US$25 million data centre"), 25_000_000)
        v, why = self.classify("New data center announces US$25 million construction budget")
        self.assertEqual(why,"accepted")
        self.assertEqual(v["category"],"data-centres")
        self.assertEqual(self.classify("New data center announces US$24.9 million construction budget")[1],
                         "below_or_unverified_threshold")

    def test_foreign_currency_not_silently_converted(self):
        self.assertIsNone(scan.money_usd("€26 million solar scheme"))
        self.assertEqual(self.classify("£50 million offshore wind scheme")[1],
                         "below_or_unverified_threshold")

    def test_funding_without_project_spend_is_not_capex(self):
        for headline in (
            "Calibrant Energy secures US$145 million for solar and BESS across US power markets",
            "New data center receives US$25 million investment",
            "AI infrastructure secures $190 billion of investment",
        ):
            with self.subTest(headline=headline):
                record, reason = self.classify(headline)
                self.assertIsNone(record)
                self.assertEqual(reason, "below_or_unverified_threshold")

    def test_company_annual_target_not_single_50mw_project(self):
        record, reason = self.classify(
            "BESS developer targets 1GW annually in European rollout")
        self.assertIsNone(record)
        self.assertEqual(reason, "below_or_unverified_threshold")

    def test_project_capacity_still_qualifies_but_finance_not_capex(self):
        record, reason = self.classify(
            "Solar developer secures US$145 million financing for new 100MW project")
        self.assertEqual(reason, "accepted")
        self.assertEqual(record["capacity_mw"], 100)
        self.assertIsNone(record["capex_usd"])
        self.assertEqual(record["qualification"], "MW_CAPACITY")

    def test_explicit_project_build_budget_is_capex(self):
        record, reason = self.classify(
            "New data center commits US$30 million to build a campus")
        self.assertEqual(reason, "accepted")
        self.assertEqual(record["capex_usd"], 30_000_000)
        self.assertEqual(record["qualification"], "USD_CAPEX")

    def test_equity_transaction_not_misrepresented_as_project_capex(self):
        headline = "Investor buys US$300 million stake in BESS developer"
        v, reason = self.classify(headline)
        self.assertIsNone(v)
        self.assertEqual(reason, "corporate_financing_not_project_capex")

    def test_corporate_credit_line_not_misrepresented_as_new_project(self):
        v, reason = self.classify("BESS operator expands holdco facility to US$300 million")
        self.assertIsNone(v)
        self.assertEqual(reason, "corporate_financing_not_project_capex")

    def test_bess_supporting_datacentre_stays_energy_not_facility(self):
        v, reason = self.classify("New 150MW BESS supporting data centre reaches operation")
        self.assertEqual(reason, "accepted")
        self.assertEqual(v["category"], "global-projects")
        self.assertIsNone(v["repd_ref"])

    def test_ai_spending_included(self):
        v, why = self.classify("AI data centre operator commits $190 billion to build new hyperscale campuses")
        self.assertEqual(why,"accepted")
        self.assertEqual(v["category"],"ai-investment")
        self.assertGreater(v["capex_usd"],25_000_000)

    def test_cyber_issues_labelled_but_not_project_works(self):
        v, why = self.classify("Cloud outage disrupts major data centre infrastructure")
        self.assertEqual(why,"accepted")
        self.assertEqual(v["category"],"cybersecurity")
        self.assertIsNone(v["repd_ref"])

    def test_unrelated_or_sponsored_rejected(self):
        self.assertEqual(self.classify("Sponsored: 100MW solar solution")[1],"sponsored_or_unconfirmed")
        self.assertEqual(self.classify("New fashion launch from a technology company")[1],"outside_sector")
        self.assertFalse(scan.family_safe("Explicit profanity: fucking awful"))

    def test_urls_enforce_https_and_known_publishers(self):
        self.assertIsNone(scan.safe_url("javascript:alert(1)"))
        self.assertIsNone(scan.safe_url("https://attacker.example/news"))
        self.assertIsNone(scan.safe_url("https://user:pass@www.gov.uk/data"))
        self.assertEqual(scan.safe_url("https://www.gov.uk/x?utm_source=a&x=2"),
                         "https://www.gov.uk/x?x=2")
        self.assertIsNone(scan.safe_url("https://www.gov.uk:8443/redirect"))
        with self.assertRaises(ValueError):
            scan.TrustedPublisherRedirect().redirect_request(
                None, None, 302, "Redirect", {}, "https://localhost/private")

    def test_atom_feed_links_only(self):
        atom = b'''<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry><title>100MW UK wind energy project</title>
            <link href="https://www.gov.uk/government/news/clean-energy"/>
            <published>2026-11-14T09:00:00Z</published>
            <summary>Investment linked to a major energy project.</summary>
          </entry>
        </feed>'''
        rows = scan.parse_feed(atom,GOV)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["headline"],"100MW UK wind energy project")
        self.assertNotIn("html",rows[0])

    def test_dedupe_and_audit(self):
        p = item("UK data center will invest $50 million")
        xml = b'<rss><channel><item><title>New 100MW solar plant</title><link>https://www.datacenterdynamics.com/en/news/example/</link><pubDate>Sat, 14 Nov 2026 09:00:00 GMT</pubDate></item><item><title>New 100MW solar plant</title><link>https://www.datacenterdynamics.com/en/news/example/</link><pubDate>Sat, 14 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>'
        s,a = scan.build_snapshot(self.repd,[(DCD,xml)],NOW)
        self.assertEqual(len(s["articles"]),1)
        self.assertEqual(a["rejected"]["duplicate"],1)
        self.assertEqual(len(a["markets"]),6)

    def test_release_descriptor_chooses_newest_candidate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            d=root/"automation/repd/releases";d.mkdir(parents=True)
            for release,count in (("2026q2",14),("2026q3",15)):
                (d/(release+".json")).write_text(json.dumps({
                  "schema":"globalgrid2050.repd-release-descriptor.v1",
                  "release_id":release,"expected":{"unique_refs":count}}))
                (root/("repd-"+release+".csv")).write_text("Ref ID\n1\n")
            version,path,count=scan.select_validated_release(root)
            self.assertEqual((version,count),("2026q3",15))
            self.assertEqual(path.name,"repd-2026q3.csv")
            self.assertEqual(scan.select_validated_release(root,"2026q2")[0],"2026q2")

    def test_new_release_is_not_inferred_from_historical_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/"repd.csv").write_text("Ref ID\n1\n")
            with self.assertRaises(ValueError):
                scan.select_validated_release(root)


if __name__ == "__main__":
    unittest.main()
