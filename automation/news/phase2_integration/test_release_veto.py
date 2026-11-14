"""Independent Agent A release-veto regression. Tests are QA, never approval."""
import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import unittest

PATH=pathlib.Path(__file__).with_name("release_veto.py")
spec=importlib.util.spec_from_file_location("release_veto",PATH)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=dt.datetime(2026,11,14,17,15,tzinfo=dt.timezone.utc)
def b(x): return json.dumps(x,sort_keys=True).encode()
def sample():
    top=[{"repd_ref":str(i)} for i in range(1,201)]
    projects={str(i):{"repd_ref":str(i),"signals":[]} for i in range(1,201)}
    projects["1"]["signals"]=[{"repd_ref":"1","link":"https://example.org/a","date":"2026-11-14"}]
    data={"schema":"project-signals.v1","projects":projects,
          "sources":[{"id":"src1","url":"https://example.org/a","licence_url":"https://example.org/terms"}]}
    return top,data
def check(top=None,data=None,e=None):
    t,d=sample()
    if top is not None:t=top
    if data is not None:d=data
    tb,db=b(t),b(d)
    return m.inspect(tb,db,e,NOW,(hashlib.sha256(tb).hexdigest(),hashlib.sha256(db).hexdigest()))
class Veto(unittest.TestCase):
    def test_missing_independent_receipts_and_licences_hold(self):
        r=check()
        self.assertFalse(r["release_authorised"])
        self.assertEqual(r["facts"]["article_receipts_missing"],1)
        self.assertEqual(r["facts"]["source_rights_missing"],1)
    def test_exact_200_required(self):
        t,d=sample();t.pop()
        self.assertIn("EXACT_200_REPD_IDENTITIES",check(t,d)["vetoes"])
    def test_wrong_project_identity_rejected(self):
        t,d=sample();d["projects"]["1"]["signals"][0]["repd_ref"]="2"
        self.assertIn("ARTICLE_REF_MISMATCH",check(t,d)["vetoes"])
    def test_insecure_url_rejected(self):
        t,d=sample();d["projects"]["1"]["signals"][0]["link"]="http://example.org/a"
        self.assertIn("ARTICLE_SOURCE_URL_INVALID",check(t,d)["vetoes"])
    def test_stale_receipt_rejected(self):
        e={"article_receipts":{"https://example.org/a":{"project_ref":"1","url":"https://example.org/a",
           "independent_fetch":True,"actual_bytes_sha256":"f"*64,"fetched_at":"2026-11-12T17:00:00Z"}}}
        self.assertEqual(check(e=e)["facts"]["article_receipts_missing"],1)
    def test_future_receipt_rejected(self):
        e={"article_receipts":{"https://example.org/a":{"project_ref":"1","url":"https://example.org/a",
           "independent_fetch":True,"actual_bytes_sha256":"f"*64,"fetched_at":"2026-11-15T17:00:00Z"}}}
        self.assertEqual(check(e=e)["facts"]["article_receipts_missing"],1)
    def test_rights_self_certification_rejected(self):
        e={"source_rights":{"src1":{"source_url":"https://example.org/a",
           "licence_url":"https://example.org/terms","reviewer_role":"producer",
           "redistribution_allowed":True,"terms_actual_bytes_sha256":"f"*64,
           "checked_at":"2026-11-14T17:00:00Z"}}}
        self.assertEqual(check(e=e)["facts"]["source_rights_missing"],1)
    def test_fake_all_green_still_no_authority(self):
        e={"independent_byte_retrieval_verified":True,"integrated_acid_all_green_no_xfail":True,
           "independent_reviewer_approved":True,
           "browser":{"1440":{"actual_browser_run":True,"js_errors":0},
                      "390":{"actual_browser_run":True,"js_errors":0}},
           "csv_map_real_clicks_exact_ids":True,
           "public_served_bytes_independently_rehashed":True,
           "immutable_successor_and_rollback_rehearsed":True,
           "dc_source_register_sha256":m.PIN_DC_REGISTER,"dc_258_rights_verified":True}
        r=check(e=e)
        self.assertIn("QA_ONLY_NO_PUBLICATION_AUTHORITY",r["vetoes"])
        self.assertFalse(r["release_authorised"])
    def test_invalid_json_fail_closed(self):
        self.assertIn("INVALID_JSON",m.inspect(b"not-json",b"{}",now=NOW)["vetoes"])
    def test_wrong_pinned_sha_fail_closed(self):
        t,d=sample()
        r=m.inspect(b(t),b(d),now=NOW)
        self.assertIn("TOP200_SOURCE_SHA_MISMATCH",r["vetoes"])
        self.assertIn("DATA_SNAPSHOT_SHA_MISMATCH",r["vetoes"])
    def test_dc_rights_veto(self):
        self.assertIn("DC_REGISTER_AND_258_RIGHTS_HOLD",check()["vetoes"])
if __name__=="__main__":unittest.main()
