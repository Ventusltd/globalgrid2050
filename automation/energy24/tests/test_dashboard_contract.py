"""Static UI/source contract checks: no synthetic public headlines and exact REPD pin."""
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[3]
APP=ROOT/"uk_renewables_pipeline/energy24"


class DashboardContract(unittest.TestCase):
    def test_source_pointer_pinned_to_validated_quarter(self):
        p=json.loads((APP/"data/release.json").read_text())
        desc=json.loads((ROOT/"automation/repd/releases"/(p["release_id"]+".json")).read_text())
        self.assertEqual(p["schema"],"globalgrid2050.energy24.release-pointer.v1")
        self.assertEqual(p["release_id"],"2026q3")
        self.assertEqual(p["official_csv_sha256"],desc["expected"]["csv_sha256"])
        self.assertEqual(p["unique_repd_refs"],desc["expected"]["unique_refs"])
        self.assertEqual(p["registry_count"],7775)
        self.assertRegex(p["release_directory"],r"^20[0-9]{10}$")

    def test_no_unverified_public_stories(self):
        p=json.loads((APP/"data/news.latest.json").read_text())
        self.assertEqual(p["schema"],"globalgrid2050.energy24.news.v1")
        self.assertEqual(p["release"],"2026q3")
        self.assertEqual(p["articles"],[])
        self.assertIsNone(p["generated_utc"])

    def test_front_end_has_six_real_local_markets(self):
        h=(APP/"index.html").read_text()
        zones=re.findall(r'data-zone="([^"]+)"',h)
        self.assertEqual(zones,[
            "Europe/London","America/New_York","America/Los_Angeles",
            "Asia/Hong_Kong","Asia/Tokyo","Australia/Sydney"])
        self.assertIn("Lead intelligence",h)
        self.assertIn("UK grid &amp; data centres",h)
        self.assertIn("US$25m+",h)
        self.assertIn("50 MW+",h)

    def test_existing_repd_master_key_is_preserved(self):
        js=(APP/"app.mjs").read_text()
        self.assertIn("state.projects.set(ref,p)",js)
        self.assertIn("state.projects.get(ref)",js)
        self.assertIn('u.searchParams.set("repd_ref",p.repd_ref)',js)
        self.assertIn('map.append(noMap)',js)
        self.assertNotIn("project_name_as_repd_key",js)

    def test_all_news_is_provenance_gated_and_public_copy_is_professional(self):
        js=(APP/"app.mjs").read_text()
        self.assertIn('["official","attributed"]',js)
        self.assertIn('payload.release!==RELEASE?.release_id',js)
        self.assertIn("NEWS FEED UNAVAILABLE",js)
        h=(APP/"index.html").read_text()
        # No abusive language in rendered static page; private test and crawler
        # source-code vocabulary is not user-visible.
        self.assertFalse(re.search(r"\b(?:fuck|shit|cunt|bullshit)\b",h,re.I))
        self.assertNotIn("<img src=",h)

if __name__=="__main__":
    unittest.main()
