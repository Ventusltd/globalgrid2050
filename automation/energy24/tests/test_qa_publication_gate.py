"""Independent negative acceptance fixtures: a green collector is not approval."""
import unittest
from datetime import datetime, timezone
from automation.energy24.qa_publication_gate import audit_candidate

NOW = datetime(2026, 11, 14, 16, 0, tzinfo=timezone.utc)
STAMP = "2026-11-14T15:50:00Z"


def candidate():
    articles = [
        dict(headline="Verified 80MW solar project", url="https://one.example/story", source_id="one", category="uk-repd", repd_ref="12345", materiality_basis="official_repd_mw", event_utc=STAMP, published_utc=STAMP),
        dict(headline="New 60MW data centre", url="https://two.example/story", source_id="two", category="data-centres", dc_id="dcuk-1", capacity_mw=60, capacity_basis="it_load_mw", materiality_basis="installed_or_it_load_mw", event_utc=STAMP, published_utc=STAMP),
    ]
    news = dict(schema="globalgrid2050.energy24.news.v1", release="2026q3", generated_utc=STAMP, articles=articles)
    audit = dict(schema="globalgrid2050.energy24.news-audit.v1", release="2026q3", markets={k:"" for k in ("London", "New York", "San Francisco", "Hong Kong", "Tokyo", "Sydney")}, sources=[{"id":k,"status":"OK"} for k in ("one","two")])
    receipts = [dict(source_id=k, url=f"https://{k}.example/story", status="fetched", fetched_at=STAMP, content_sha256="b"*64) for k in ("one", "two")]
    rights = {k:dict(status="verified", terms_sha256="a"*64, terms_url=f"https://{k}.example/terms", reviewer="independent reviewer", attribution=k, publisher_host=f"{k}.example") for k in ("one", "two")}
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


if __name__ == "__main__":
    unittest.main()
