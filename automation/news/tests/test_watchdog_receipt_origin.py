"""Isolated, non-publishing QA contract for publisher response provenance.

Run: python -m unittest automation/news/tests/test_watchdog_receipt_origin.py
This is an additive proposed gate, NOT an independent licence or article verification.
"""
import hashlib
import re
import unittest
from datetime import datetime, timezone
from urllib.parse import urlsplit

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_ALLOWED_RIGHTS = {"verified", "licensed"}


def receipt_eligible(item, body, now):
    """Fail closed on missing publisher-origin, body-byte and temporal evidence.

    The caller must separately validate publisher licence terms and REPD bindings;
    this check alone cannot establish either. Redirects across origins require
    separately reviewed publisher ownership, rather than implicit trust.
    """
    if not isinstance(item, dict) or not isinstance(body, bytes) or not body:
        return False
    try:
        original = urlsplit(item["publisher_url"])
        final = urlsplit(item["fetched_url"])
        if any(u.scheme != "https" or not u.hostname or u.username or u.password or u.fragment for u in (original, final)):
            return False
        if (original.hostname.lower(), original.port or 443) != (final.hostname.lower(), final.port or 443):
            return False
        # Same hostname is insufficient: receipts cannot prove other articles.
        if (original.path or "/", original.query) != (final.path or "/", final.query):
            return False
        # An error page or binary asset is not a fetched article, even if hashed.
        if type(item.get("http_status")) is not int or item["http_status"] != 200:
            return False
        content_type = item.get("content_type")
        if not isinstance(content_type, str) or content_type.split(";", 1)[0].strip().lower() not in {"text/html", "application/xhtml+xml"}:
            return False
        if item.get("publisher_rights") not in _ALLOWED_RIGHTS:
            return False
        digest = item["response_sha256"]
        if not isinstance(digest, str) or not _SHA256.fullmatch(digest):
            return False
        if hashlib.sha256(body).hexdigest() != digest:
            return False
        observed = datetime.fromisoformat(item["fetched_at"].replace("Z", "+00:00"))
        if observed.tzinfo is None or now.tzinfo is None:
            return False
        seconds = (now.astimezone(timezone.utc) - observed.astimezone(timezone.utc)).total_seconds()
        return 0 <= seconds <= 86400
    except (KeyError, ValueError, TypeError, OverflowError):
        return False


class ReceiptOriginContract(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 15, 1, 0, tzinfo=timezone.utc)
        self.body = b"Independent publisher response bytes"
        self.item = {
            "publisher_url": "https://publisher.example/article?id=7",
            "fetched_url": "https://publisher.example/article?id=7",
            "publisher_rights": "verified",
            "http_status": 200,
            "content_type": "text/html; charset=utf-8",
            "response_sha256": hashlib.sha256(self.body).hexdigest(),
            "fetched_at": "2026-11-15T00:59:00Z",
        }

    def test_matching_origin_and_bytes(self):
        self.assertTrue(receipt_eligible(self.item, self.body, self.now))

    def test_cross_publisher_redirect_rejected(self):
        self.item["fetched_url"] = "https://other.example/article?id=7"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_same_host_different_article_path_rejected(self):
        self.item["fetched_url"] = "https://publisher.example/other?id=7"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_same_host_different_article_query_rejected(self):
        self.item["fetched_url"] = "https://publisher.example/article?id=8"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_fragment_article_identity_rejected(self):
        self.item["fetched_url"] += "#alternate-story"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_empty_response_body_rejected(self):
        self.body = b""
        self.item["response_sha256"] = hashlib.sha256(self.body).hexdigest()
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_http_error_page_receipt_rejected(self):
        self.item["http_status"] = 404
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_redirect_status_not_article_receipt(self):
        self.item["http_status"] = 302
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_binary_asset_receipt_rejected(self):
        self.item["content_type"] = "application/pdf"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_missing_content_type_rejected(self):
        del self.item["content_type"]
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_xhtml_article_receipt_accepted(self):
        self.item["content_type"] = "application/xhtml+xml"
        self.assertTrue(receipt_eligible(self.item, self.body, self.now))

    def test_http_downgrade_rejected(self):
        self.item["fetched_url"] = "http://publisher.example/article?id=7"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_url_credentials_rejected(self):
        self.item["fetched_url"] = "https://user:pass@publisher.example/article"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_unverified_rights_rejected(self):
        self.item["publisher_rights"] = "pending"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_claimed_hash_not_response_bytes_rejected(self):
        self.assertFalse(receipt_eligible(self.item, b"different response", self.now))

    def test_future_fetch_rejected(self):
        self.item["fetched_at"] = "2026-11-15T01:01:00Z"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_stale_fetch_rejected(self):
        self.item["fetched_at"] = "2026-11-14T00:59:00Z"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_naive_fetch_time_rejected(self):
        self.item["fetched_at"] = "2026-11-15T00:59:00"
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))

    def test_missing_receipt_rejected(self):
        del self.item["response_sha256"]
        self.assertFalse(receipt_eligible(self.item, self.body, self.now))


if __name__ == "__main__":
    unittest.main()
