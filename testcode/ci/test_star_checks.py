import datetime as dt
import importlib.util
import json
import pathlib
import time
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("star_checks", pathlib.Path(__file__).with_name("star_checks.py"))
checks = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checks)


class PublicationChecks(unittest.TestCase):
    def test_inventory_supports_three_committed_formats(self):
        item = {"bytes": 3, "sha256": "a"*64}
        variants = [{"files": [{**item, "path": "x.json"}]},
                    {"files": [{**item, "file": "x.json"}]},
                    {"files": {"x.json": item}}]
        rows = [checks.inventory("testcode/123/publication.json", obj) for obj in variants]
        self.assertEqual(rows[0], rows[1])
        self.assertEqual(rows[0], rows[2])
        self.assertEqual(rows[0][0]["path"], "testcode/123/x.json")
        self.assertEqual(checks.safe_asset("testcode/123/publication.json", "testcode/123/x.json"), "testcode/123/x.json")

    def test_missing_inventory_is_explicit(self):
        self.assertIsNone(checks.inventory("testcode/123/publication.json", {}))
        with self.assertRaises(ValueError):
            checks.inventory("testcode/123/publication.json", {"files": "unsupported"})

    def test_path_escapes_and_cross_publication_references_rejected(self):
        for path in ("../x", "/x", "x/../y", "https://example.com/x", "testcode/456/x", "x%2fy", "x\\y", "x?y", "x//y", "."):
            with self.subTest(path=path), self.assertRaises(ValueError):
                checks.safe_asset("testcode/123/publication.json", path)

    def test_invalid_hash_size_duplicate_inventory_rejected(self):
        for item in ({"path": "x", "bytes": True, "sha256": "a"*64},
                     {"path": "x", "bytes": -1, "sha256": "a"*64},
                     {"path": "x", "bytes": checks.MAX_FILE_BYTES+1, "sha256": "a"*64},
                     {"path": "x", "bytes": 2, "sha256": "bad"}):
            with self.assertRaises(ValueError):
                checks.inventory("testcode/123/publication.json", {"files": [item]})
        item = {"path":"x", "bytes":2, "sha256":"a"*64}
        with self.assertRaises(ValueError):
            checks.inventory("testcode/123/publication.json", {"files":[item,item]})

    def test_served_manifest_cannot_authorize_changed_asset(self):
        trusted = b'original'
        item = {"path":"testcode/123/x", "bytes":len(trusted), "sha256":checks.digest(trusted), "kind":"asset"}
        wrong = checks.check_item(item, checks.PUBLIC_BASE, time.monotonic()+1, lambda *args:b"modified")
        right = checks.check_item(item, checks.PUBLIC_BASE, time.monotonic()+1, lambda *args:trusted)
        self.assertFalse(wrong["match"])
        self.assertTrue(right["match"])
        self.assertNotIn("modified", json.dumps(wrong))

    def test_plan_uses_committed_manifest_bytes(self):
        manifest = b'{"files":[{"file":"x","bytes":1,"sha256":"' + b'a'*64 + b'"}]}'
        with patch.object(checks, "git", return_value=b"testcode/123/publication.json\n"), patch.object(checks, "committed", return_value=manifest):
            rows, coverage = checks.plan(pathlib.Path('.'), 'pinned')
        self.assertEqual(rows[0]["sha256"], checks.digest(manifest))
        self.assertEqual(coverage["declared_assets"], 1)
        self.assertEqual(rows[1]["sha256"], "a"*64)

    def test_unsupported_inventory_is_a_distinct_coverage_gate(self):
        manifest = b'{"files":"unsupported"}'
        with patch.object(checks, "git", return_value=b"testcode/123/publication.json\n"), patch.object(checks, "committed", return_value=manifest):
            rows, coverage = checks.plan(pathlib.Path('.'),'pinned')
        self.assertEqual(len(rows),1)
        self.assertEqual(coverage['unsupported_inventory'],['testcode/123/publication.json'])
        self.assertEqual(coverage['manifest_only'],[])
        self.assertFalse(coverage['all_manifests_have_asset_inventory'])

    def test_public_patterns_report_counts_not_values(self):
        raw = json.dumps({"company_name":"Example Private Limited", "contact":"x@example.test", "address":"AB1 2CD", "registration":"12345678"}).encode()
        result = checks.sector_patterns(raw)
        self.assertEqual(result["company_suffix"], 1)
        self.assertEqual(result["identifier_keys"], 1)
        self.assertEqual(result["full_postcode"], 1)
        self.assertEqual(result["registration_number"], 1)
        self.assertNotIn("Example", json.dumps(result))
        self.assertTrue(all(type(value) is int for value in result.values()))

    def test_public_patterns_ignore_numeric_measurements_and_hashes(self):
        result = checks.sector_patterns(json.dumps({"count":12345678, "sha256":"12345678"*8}).encode())
        self.assertFalse(any(result.values()))

    def test_duplicate_json_and_failed_pattern_scan_fail_closed(self):
        raw = b'{"value":"first", "value":"second"}'
        with self.assertRaises(ValueError):
            checks.strict_json(raw)
        item = {"path":checks.SECTOR+'data/test.json', "bytes":len(raw), "sha256":checks.digest(raw), "kind":"asset"}
        result = checks.check_item(item,checks.PUBLIC_BASE,time.monotonic()+1,lambda *args:raw)
        self.assertFalse(result['match'])
        self.assertEqual(result['error'],'ValueError')
        for raw in (b'{"value":NaN}',b'{"value":Infinity}',b'{"value":-Infinity}'):
            with self.assertRaises(ValueError):
                checks.strict_json(raw)

    def test_redirect_target_is_never_requested_across_origins(self):
        requests = []
        class Target(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.path)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'x')
            def log_message(self,*args):
                pass
        target = ThreadingHTTPServer(('127.0.0.1',0),Target)
        class Redirect(Target):
            def do_GET(self):
                self.send_response(302)
                self.send_header('Location',f'http://127.0.0.1:{target.server_port}/blocked')
                self.end_headers()
        source = ThreadingHTTPServer(('127.0.0.1',0),Redirect)
        threads = [threading.Thread(target=server.serve_forever,daemon=True) for server in (source,target)]
        for thread in threads:
            thread.start()
        try:
            with self.assertRaises(ValueError):
                checks.fetch(f'http://127.0.0.1:{source.server_port}/',1,time.monotonic()+2)
            self.assertEqual(requests,[])
            self.assertNotEqual(checks.origin('https://example.test/'),checks.origin('http://example.test/'))
            self.assertEqual(checks.origin('https://example.test/'),checks.origin('https://example.test:443/'))
        finally:
            for server in (source,target):
                server.shutdown()
                server.server_close()
            for thread in threads:
                thread.join()

    def test_sun_owner_pin_checked_before_execution(self):
        with patch.object(checks, "git", return_value=b"0"*40), self.assertRaises(ValueError):
            checks.validate_sun_owner(pathlib.Path('.'), time.monotonic()+1)

    def test_night_cutoff_is_exclusive_and_utc(self):
        at = dt.datetime(2026,9,15,7,tzinfo=dt.timezone.utc)
        self.assertTrue(checks.window_open("2026-09-15T07:00:00Z",at-dt.timedelta(seconds=1)))
        self.assertFalse(checks.window_open("2026-09-15T07:00:00Z",at))
        for text in ("never", "2026-09-15T07:00:00", "2026-09-15T07:00:00+01:00"):
            with self.assertRaises(ValueError):
                checks.window_open(text,at)

    def test_production_pin_matches_workflow(self):
        workflow = pathlib.Path(__file__).resolve().parents[2]/'.github/workflows/star-checks.yml'
        self.assertIn(checks.SUN_COMMIT,workflow.read_text())
        self.assertNotIn('issues: write',workflow.read_text())


if __name__ == '__main__':
    unittest.main()
