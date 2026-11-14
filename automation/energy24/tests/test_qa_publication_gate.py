"""Independent negative acceptance fixtures: a green collector is not approval."""
import unittest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from automation.energy24.qa_publication_gate import audit_candidate

NOW = datetime(2026, 11, 14, 16, 0, tzinfo=timezone.utc)
STAMP = "2026-11-14T15:50:00Z"


def candidate():
    articles = [
        dict(headline="Verified 80MW solar project", url="https://one.example/story", source_id="one", category="uk-repd", repd_ref="12345", materiality_basis="official_repd_mw", event_utc=STAMP, published_utc=STAMP),
        dict(headline="New 60MW data centre", url="https://two.example/story", source_id="two", category="data-centres", dc_id="dcuk-1", capacity_mw=60, capacity_basis="it_load_mw", materiality_basis="installed_or_it_load_mw", event_utc=STAMP, published_utc=STAMP),
    ]
    news = dict(schema="globalgrid2050.energy24.news.v1", release="2026q3", generated_utc=STAMP, articles=articles)
    audit = dict(schema="globalgrid2050.energy24.news-audit.v1", release="2026q3", markets={k:datetime.fromisoformat(STAMP.replace("Z", "+00:00")).astimezone(ZoneInfo(tz)).isoformat(timespec="minutes") for k,tz in {
        "London":"Europe/London", "New York":"America/New_York",
        "San Francisco":"America/Los_Angeles", "Hong Kong":"Asia/Hong_Kong",
        "Tokyo":"Asia/Tokyo", "Sydney":"Australia/Sydney"}.items()}, sources=[{"id":k,"status":"OK"} for k in ("one","two")])
    receipts = [dict(source_id=k, url=f"https://{k}.example/story", status="fetched", fetched_at=STAMP, content_sha256="b"*64) for k in ("one", "two")]
    rights = {k:dict(status="verified", terms_sha256="a"*64, terms_url=f"https://{k}.example/terms", reviewer="independent reviewer", attribution=k, publisher_host=f"{k}.example", publisher_owner_id=f"owner-{k}") for k in ("one", "two")}
    return news, audit, receipts, rights


class PublicationHoldTests(unittest.TestCase):
    def check(self, news, audit, receipts, rights):
        return audit_candidate(news, audit, receipts, rights, {"12345":80}, {"dcuk-1"}, NOW)

    def test_complete_structural_fixture_passes_without_claiming_legal_clearance(self):
        self.assertEqual(self.check(*candidate()), [])

    def test_producer_authored_feed_without_receipts_or_licences_is_held(self):
        n,a,r,l = candidate()
        self.assertIn("article_0:no_independent_exact_url_receipt", self.check(n,a,[],{}))
        self.assertIn("article_1:publisher_rights_unverified", self.check(n,a,[],{}))

    def test_one_publisher_cannot_approve_an_hourly_write(self):
        n,a,r,l = candidate()
        n["articles"] = n["articles"][:1]
        self.assertIn("insufficient_independent_publishers", self.check(n,a,r,l))

    def test_unverified_data_centre_id_is_not_a_repd_identity(self):
        n,a,r,l = candidate()
        n["articles"][1].pop("dc_id")
        self.assertIn("article_1:data_centre_id_unverified", self.check(n,a,r,l))

    def test_financing_is_not_project_capex(self):
        n,a,r,l = candidate()
        i=n["articles"][1]
        i.update(capex_usd=80_000_000, materiality_basis="project_capex_usd", financing_type="corporate_debt")
        self.assertIn("article_1:corporate_funding_not_project_capex", self.check(n,a,r,l))

    def test_funding_without_explicit_project_capex_classification_is_held(self):
        n,a,r,l = candidate()
        i=n["articles"][1]
        i.update(capex_usd=80_000_000, materiality_basis="project_capex_usd")
        self.assertIn("article_1:corporate_funding_not_project_capex", self.check(n,a,r,l))
        i["financing_type"] = "project_capex"
        self.assertNotIn("article_1:corporate_funding_not_project_capex", self.check(n,a,r,l))

    def test_verified_non_uk_dc_id_can_be_distinct_from_repd(self):
        n,a,r,l = candidate()
        n["articles"][1].update(dc_id="verified-international-site-1", region="India")
        errors = audit_candidate(n,a,r,l,{"12345":80},{"verified-international-site-1"},NOW)
        self.assertNotIn("article_1:data_centre_id_unverified", errors)
        n["articles"][1]["region"]="UK"
        errors = audit_candidate(n,a,r,l,{"12345":80},{"verified-international-site-1"},NOW)
        self.assertIn("article_1:data_centre_id_unverified", errors)

    def test_forged_receipt_for_other_url_cannot_clear_article(self):
        n,a,r,l = candidate()
        r[1]["url"]="https://two.example/unrelated"
        self.assertIn("article_1:no_independent_exact_url_receipt", self.check(n,a,r,l))

    def test_stale_event_with_new_scan_stamp_is_not_fresh_news(self):
        n,a,r,l = candidate()
        n["articles"][0]["event_utc"]="2026-09-10T10:00:00Z"
        self.assertIn("article_0:event_or_publication_stale_unverified", self.check(n,a,r,l))

    def test_receipt_requires_content_digest(self):
        n,a,r,l = candidate()
        r[0].pop("content_sha256")
        self.assertIn("article_0:no_independent_exact_url_receipt", self.check(n,a,r,l))

    def test_publisher_rights_cannot_be_laundered_across_hosts(self):
        n,a,r,l = candidate()
        l["two"]["publisher_host"] = "one.example"
        self.assertIn("article_1:publisher_rights_unverified", self.check(n,a,r,l))

    def test_grid_capacity_must_not_be_inferred(self):
        n,a,r,l = candidate()
        n["articles"][1]["grid_connection_mw"]=60
        self.assertIn("article_1:inferred_grid_connection", self.check(n,a,r,l))

    def test_two_mastheads_with_same_owner_are_not_independent(self):
        n,a,r,l = candidate()
        l["two"]["publisher_owner_id"] = l["one"]["publisher_owner_id"]
        self.assertIn("insufficient_independent_publishers", self.check(n,a,r,l))

    def test_clock_names_alone_cannot_fake_six_iana_offsets(self):
        n,a,r,l = candidate()
        a["markets"]["New York"] = a["markets"]["London"]
        self.assertIn("market_clock_invalid:New York", self.check(n,a,r,l))
        a["markets"]["New York"] = "2026-11-14T10:50:00-05:00"
        self.assertNotIn("market_clock_invalid:New York", self.check(n,a,r,l))

    def test_future_receipt_cannot_prove_current_scan(self):
        n,a,r,l = candidate()
        r[0]["fetched_at"] = "2026-11-14T17:00:00Z"
        self.assertIn("article_0:no_independent_exact_url_receipt", self.check(n,a,r,l))

    def test_conflicting_duplicate_receipt_cannot_overwrite_failed_fetch(self):
        n,a,r,l = candidate()
        bad = dict(r[0], status="failed", content_sha256="")
        r.insert(0, bad)
        errors = self.check(n,a,r,l)
        self.assertIn("duplicate_receipt_key:one:https://one.example/story", errors)
        self.assertIn("article_0:no_independent_exact_url_receipt", errors)

    def test_duplicate_source_id_cannot_overwrite_failed_crawl(self):
        n,a,r,l = candidate()
        a["sources"].insert(0, {"id":"one", "status":"FAILED"})
        errors = self.check(n,a,r,l)
        self.assertIn("duplicate_source_id:one", errors)
        self.assertIn("article_0:source_not_successful", errors)

    def test_malformed_evidence_rows_fail_closed_not_crash(self):
        n,a,r,l = candidate()
        a["sources"].append({"id": ["not", "hashable"]})
        r.append({"source_id": ["not", "hashable"], "url": "https://one.example/story"})
        errors = self.check(n,a,r,l)
        self.assertIn("invalid_source_record", errors)
        self.assertIn("invalid_receipt_record", errors)

    def test_tracking_query_and_fragment_cannot_multiply_a_single_story(self):
        n,a,r,l = candidate()
        copy = dict(n["articles"][0], headline="80MW solar scheme update",
                    url="https://one.example/story?utm_source=hourly&gclid=123#section")
        n["articles"].append(copy)
        r.append(dict(r[0], url=copy["url"]))
        errors = self.check(n,a,r,l)
        self.assertIn("article_2:duplicate", errors)
        # An exact receipt for the alias is still required; no receipt rewriting.
        self.assertNotIn("article_2:no_independent_exact_url_receipt", errors)

    def test_meaningful_query_is_not_discarded_by_dedup(self):
        n,a,r,l = candidate()
        copy = dict(n["articles"][0], headline="80MW solar project planning documents",
                    url="https://one.example/story?document=2")
        n["articles"].append(copy)
        r.append(dict(r[0], url=copy["url"]))
        self.assertNotIn("article_2:duplicate", self.check(n,a,r,l))

    def test_tracking_alias_without_its_own_receipt_still_fails(self):
        n,a,r,l = candidate()
        copy = dict(n["articles"][0], headline="80MW solar update",
                    url="https://one.example/story?utm_campaign=hourly")
        n["articles"].append(copy)
        errors = self.check(n,a,r,l)
        self.assertIn("article_2:duplicate", errors)
        self.assertIn("article_2:no_independent_exact_url_receipt", errors)

    def test_missing_publisher_owner_is_not_licence_or_independence_proof(self):
        n,a,r,l = candidate()
        l["two"].pop("publisher_owner_id")
        errors = self.check(n,a,r,l)
        self.assertIn("article_1:publisher_rights_unverified", errors)
        self.assertIn("insufficient_independent_publishers", errors)


if __name__ == "__main__":
    unittest.main()
