"""Synthetic adversarial contract fixtures. No publisher claims or release authority."""
import datetime as dt
import importlib.util
import pathlib
import unittest

PATH = pathlib.Path(__file__).with_name("project_binding_contract.py")
SPEC = importlib.util.spec_from_file_location("binding_contract", PATH)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
NOW = dt.datetime(2026, 11, 14, 18, 45, tzinfo=dt.timezone.utc)
URL = "https://publisher.example/news/two-projects"
SHA = "a" * 64


def fixture():
    projects = {"9050": [URL], "14096": [URL]}
    receipts = [{
        "url": URL, "http_status": 200, "response_sha256": SHA,
        "independent_fetch": True, "fetched_at": "2026-11-14T18:40:00Z",
    }]
    bindings = []
    for ref in projects:
        bindings.append({
            "project_ref": ref, "url": URL,
            "evidence_project_ref": ref,
            "source_response_sha256": SHA,
            "reviewer_role": "independent_identity_reviewer",
            "independent_identity_verified": True,
            "identity_evidence_url": "https://authority.example/planning/" + ref,
            "identity_evidence_sha256": "b" * 64,
            "identity_basis": "official_repd_ref",
            "identity_value": ref,
            "reviewed_at": "2026-11-14T18:35:00Z",
        })
    return projects, receipts, bindings


def check(edit=None):
    p, r, b = fixture()
    if edit:
        edit(p, r, b)
    return m.audit(p, r, b, NOW)


class ProjectBindingContract(unittest.TestCase):
    def test_two_projects_one_url_one_receipt_two_separate_bindings(self):
        x = check()
        self.assertTrue(x["contract_ok"], x["errors"])
        self.assertEqual(x["facts"]["unique_urls"], 1)
        self.assertEqual(x["facts"]["valid_bindings"], 2)
        self.assertFalse(x["release_authorised"])

    def test_single_url_receipt_does_not_infer_second_project(self):
        x = check(lambda p, r, b: b.pop())
        self.assertIn("MISSING_VALID_PROJECT_URL_BINDING", x["errors"])
        self.assertEqual(x["facts"]["missing_bindings"], 1)

    def test_R07_copied_other_project_identity_is_rejected(self):
        x = check(lambda p, r, b: b[1].update(evidence_project_ref="9050"))
        self.assertIn("PROJECT_BINDING_EVIDENCE_INVALID", x["errors"])
        self.assertEqual(x["facts"]["missing_bindings"], 1)

    def test_R07_wrong_official_ref_basis_rejected(self):
        x = check(lambda p, r, b: b[1].update(identity_value="9050"))
        self.assertFalse(x["contract_ok"])

    def test_R07_wrong_article_digest_binding_rejected(self):
        x = check(lambda p, r, b: b[1].update(source_response_sha256="c" * 64))
        self.assertFalse(x["contract_ok"])

    def test_duplicate_url_receipt_poisoned_not_last_write_wins(self):
        x = check(lambda p, r, b: r.append(dict(r[0])))
        self.assertIn("DUPLICATE_URL_RECEIPT", x["errors"])
        self.assertEqual(x["facts"]["missing_bindings"], 2)

    def test_duplicate_project_url_binding_poisoned(self):
        x = check(lambda p, r, b: b.append(dict(b[1])))
        self.assertIn("DUPLICATE_PROJECT_URL_BINDING", x["errors"])

    def test_unrelated_project_url_binding_rejected(self):
        x = check(lambda p, r, b: b.append(dict(b[0], project_ref="99999")))
        self.assertIn("UNRELATED_PROJECT_URL_BINDING", x["errors"])

    def test_stale_url_receipt_rejected(self):
        x = check(lambda p, r, b: r[0].update(fetched_at="2026-11-12T18:00:00Z"))
        self.assertIn("URL_RECEIPT_NOT_INDEPENDENT_CURRENT", x["errors"])

    def test_future_url_receipt_rejected(self):
        x = check(lambda p, r, b: r[0].update(fetched_at="2026-11-15T18:00:00Z"))
        self.assertIn("URL_RECEIPT_NOT_INDEPENDENT_CURRENT", x["errors"])

    def test_unsafe_url_rejected(self):
        x = check(lambda p, r, b: p["9050"].append("http://publisher.example/fake"))
        self.assertIn("ARTICLE_URL_INVALID", x["errors"])

    def test_self_reviewed_identity_rejected(self):
        x = check(lambda p, r, b: b[0].update(reviewer_role="producer"))
        self.assertFalse(x["contract_ok"])

    def test_future_identity_review_rejected(self):
        x = check(lambda p, r, b: b[0].update(reviewed_at="2026-11-15T18:35:00Z"))
        self.assertFalse(x["contract_ok"])

    def test_fabricated_digest_shape_rejected(self):
        x = check(lambda p, r, b: r[0].update(response_sha256="f" * 63))
        self.assertIn("URL_RECEIPT_NOT_INDEPENDENT_CURRENT", x["errors"])

    def test_http_status_not_200_rejected(self):
        x = check(lambda p, r, b: r[0].update(http_status=404))
        self.assertFalse(x["contract_ok"])

    def test_orphan_url_receipt_rejected(self):
        x = check(lambda p, r, b: r.append(dict(r[0], url="https://publisher.example/unrelated")))
        self.assertIn("ORPHAN_URL_RECEIPT", x["errors"])

    def test_malformed_receipt_fails_closed(self):
        x = check(lambda p, r, b: r.append("malformed"))
        self.assertIn("RECEIPT_MALFORMED", x["errors"])

    def test_fabricated_pinned_source_rejected(self):
        with self.assertRaisesRegex(ValueError, "TOP200_SOURCE_SHA_MISMATCH"):
            m.real_snapshot(b"[]", b"{}")

    def test_no_manifest_can_authorise_release(self):
        x = check()
        self.assertFalse(x["release_authorised"])
        self.assertIn("QA_ONLY_NO_PUBLICATION_AUTHORITY", x["release_vetoes"])


if __name__ == "__main__":
    unittest.main()
