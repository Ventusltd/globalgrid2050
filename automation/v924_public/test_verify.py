"""Offline contract and importer-parity tests; no public source claims."""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import verify as v


def encoded(obj):
    return (json.dumps(obj, sort_keys=True) + "\n").encode()


class Response(io.BytesIO):
    status = 200
    def __init__(self, body, length=None):
        super().__init__(body)
        self.headers = {} if length is None else {"Content-Length": str(length)}


class ReadbackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.current = "202611161244"
        self.new = "202611161630"
        self.ids = (self.new, *v.ROLLBACKS)
        self.registry = {"versions": [{"id": rid, "version": ver, "trees": [rid * 3 + "abcd"]}
            for rid, ver in zip(self.ids, ("V9.25", "V9.24", "V9.23"))]}
        self.owner = {"schema_version": 1, "entities": [{"id": "pipeline-news", "operative_release_id": self.current,
            "releases": [{"id": rid, "status": "available", "url": v.BASE + f"uk_renewables_pipeline/{rid}/"} for rid in self.ids]}]}
        self.raw = b'\xef\xbb\xbf<html><link href="./assets/versioned-homepage.css"><script src="./assets/versioned-homepage.js"></script><a href="data/homepage.json">Data</a></html>  \r\n'
        self.bundle = {name: (self.raw if name == "index.html" else b"{}\n") for name in v.FILES}
        self.bundle["data/homepage.json"] = encoded(self.owner)
        seed = {"selection": "numeric-repd-ref-ascending", "ids": [str(i) for i in range(1018, 2017)] + ["2325"],
                "record_count": 7775, "solar_count": 3604, "provisional_candidates": 2, "not_researched": 998, "independently_verified": 0}
        self.manifest = encoded(seed)
        self.remote = {}
        for entry in self.registry["versions"]:
            rid = entry["id"]
            self.write(f"uk_renewables_pipeline/{rid}/index.html", f'<html>{entry["version"]} {rid}</html>'.encode())
            if rid != v.ROLLBACKS[1]:
                self.write(f"uk_renewables_pipeline/{rid}/solar1000/manifest.json", self.manifest)
        self.ledger = {"versions": [{"id": e["id"], "version": e["version"], "verdict": "PASS", "tree": e["trees"]} for e in self.registry["versions"]]}
        self.write("automation/pipeline_release/registry.json", encoded(self.registry))
        self.write("uk_renewables_pipeline/versions.json", encoded(self.ledger))
        self.repin()

    def write(self, name, body):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        self.remote[v.BASE + name] = body

    def repin(self):
        self.bundle["data/homepage.json"] = encoded(self.owner)
        self.pin = {"repository": "Ventusltd/globalgrid2050-homepage", "commit": "a" * 40,
                    "files": {name: v.sha(body) for name, body in self.bundle.items()}}
        self.write("catalogue/homepage-owner.json", encoded(self.pin))
        for name, body in self.bundle.items():
            self.remote[f'https://raw.githubusercontent.com/{self.pin["repository"]}/{self.pin["commit"]}/{name}'] = body
            if name != "index.html":
                self.remote[v.BASE + "homepage-shell/" + name] = body
        self.remote[v.BASE] = v.transformed_index(self.bundle["index.html"])

    def git(self, root, command, ref):
        if ref == "HEAD":
            return "b" * 40
        rid = ref.rsplit("/", 1)[-1]
        return next(e["trees"][0] for e in self.registry["versions"] if e["id"] == rid)

    def prepare(self):
        return v.prepare(self.root, self.remote.__getitem__, self.git)

    def check(self):
        return v.check_once(self.prepare(), self.remote.__getitem__)

    def test_registry_tail_does_not_promote_operative_release(self):
        result = self.check()
        self.assertEqual(result["release"], self.current)
        self.assertNotEqual(result["owner_source_index_sha256"], result["transformed_root_sha256"])
        self.assertEqual(result["rollback_releases"], list(v.ROLLBACKS))

    def test_later_owner_promotion_selects_new_version(self):
        self.owner["entities"][0]["operative_release_id"] = self.new
        self.repin()
        self.assertEqual(self.check()["version"], "V9.25")

    def test_transformation_matches_real_importer(self):
        spec = importlib.util.spec_from_file_location("real_importer", Path(__file__).resolve().parents[2] / "scripts/import_homepage_owner.py")
        importer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(importer)
        def response(url, **kwargs):
            return Response(self.remote[url])
        with patch.object(importer, "ROOT", self.root), patch.object(importer.urllib.request, "urlopen", response):
            importer.main()
        self.assertEqual((self.root / "index.html").read_bytes(), v.transformed_index(self.raw))
        for name in v.FILES - {"index.html"}:
            self.assertEqual((self.root / "homepage-shell" / name).read_bytes(), self.bundle[name])

    def test_wrong_source_pin_fails(self):
        self.pin["files"]["index.html"] = "0" * 64
        self.write("catalogue/homepage-owner.json", encoded(self.pin))
        with self.assertRaisesRegex(ValueError, "source hash mismatch"):
            self.prepare()

    def test_unpinned_owner_commit_fails(self):
        self.pin["commit"] = "main"
        self.write("catalogue/homepage-owner.json", encoded(self.pin))
        with self.assertRaisesRegex(ValueError, "invalid owner pin"):
            self.prepare()

    def test_untransformed_root_fails(self):
        self.remote[v.BASE] = self.raw
        with self.assertRaisesRegex(ValueError, "served byte mismatch"):
            self.check()

    def test_malformed_importer_references_fail(self):
        for body in (self.raw.replace(b'./assets/versioned-homepage.js', b'wrong.js'), self.raw + b'href="data/homepage.json"'):
            with self.subTest(body=body), self.assertRaises(ValueError):
                v.transformed_index(body)

    def test_every_served_bundle_asset_is_pinned(self):
        for name in v.FILES - {"index.html"}:
            with self.subTest(name=name):
                url = v.BASE + "homepage-shell/" + name
                original = self.remote[url]
                self.remote[url] += b"x"
                with self.assertRaisesRegex(ValueError, "served byte mismatch"):
                    self.check()
                self.remote[url] = original

    def test_wrong_release_and_rollbacks_fail(self):
        for rid in (self.new, *v.ROLLBACKS):
            with self.subTest(rid=rid):
                self.owner["entities"][0]["operative_release_id"] = self.new
                self.repin()
                url = v.BASE + f"uk_renewables_pipeline/{rid}/index.html"
                original = self.remote[url]
                self.remote[url] = b"wrong release"
                with self.assertRaisesRegex(ValueError, "served byte mismatch"):
                    self.check()
                self.remote[url] = original

    def test_current_manifest_must_equal_frozen_baseline(self):
        self.owner["entities"][0]["operative_release_id"] = self.new
        self.repin()
        self.write(f"uk_renewables_pipeline/{self.new}/solar1000/manifest.json", self.manifest + b" ")
        with self.assertRaisesRegex(ValueError, "differs from frozen"):
            self.prepare()

    def test_missing_or_changed_ledger_fails(self):
        self.remote[v.BASE + "uk_renewables_pipeline/versions.json"] = b"{}"
        with self.assertRaisesRegex(ValueError, "served byte mismatch"):
            self.check()

    def test_ledger_semantics_are_checked_even_with_identical_bytes(self):
        for key, value in (("verdict", "FAIL"), ("version", "V9.99"), ("tree", ["wrong"])):
            with self.subTest(key=key):
                ledger = copy.deepcopy(self.ledger)
                ledger["versions"][1][key] = value
                self.write("uk_renewables_pipeline/versions.json", encoded(ledger))
                with self.assertRaisesRegex(ValueError, "ledger identity/tree/verdict"):
                    self.check()

    def test_owner_wrong_url_candidate_and_duplicate_rejected(self):
        original = copy.deepcopy(self.owner)
        for change in ("url", "status", "duplicate"):
            with self.subTest(change=change):
                self.owner = copy.deepcopy(original)
                release = self.owner["entities"][0]["releases"][1]
                if change == "duplicate":
                    self.owner["entities"].append(copy.deepcopy(self.owner["entities"][0]))
                else:
                    release[change] = "candidate" if change == "status" else v.BASE + "wrong/"
                self.repin()
                with self.assertRaises(ValueError):
                    self.prepare()

    def test_unregistered_tree_fails(self):
        with self.assertRaisesRegex(ValueError, "unregistered source tree"):
            v.prepare(self.root, self.remote.__getitem__, lambda *args: "0" * 40)

    def test_source_and_public_fetch_failure_cannot_pass(self):
        def fail(url):
            raise TimeoutError("bounded fetch timed out")
        with self.assertRaises(TimeoutError):
            v.prepare(self.root, fail, self.git)
        with self.assertRaises(TimeoutError):
            v.check_once(self.prepare(), fail)

    def test_main_writes_failure_receipt_and_exits_nonzero(self):
        output = self.root / "receipt.json"
        with patch.dict(os.environ, {"PIPELINE_RECEIPT_PATH": str(output)}), patch.object(v, "prepare", side_effect=TimeoutError("offline")):
            self.assertEqual(v.main(), 1)
        self.assertEqual(json.loads(output.read_text())["status"], "FAIL")


class TransportTests(unittest.TestCase):
    def test_http_url_and_unknown_host_rejected_before_network(self):
        for url in ("http://globalgrid2050.com/", "https://localhost/", "https://globalgrid2050.com:8443/", "https://user@globalgrid2050.com/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                v.read(url)

    def test_redirect_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "redirect"):
            v.NoRedirects().redirect_request(None, None, 302, "", {}, "https://localhost/")

    def test_size_limits_and_http_failure(self):
        for body, length, status in ((b"x", v.MAX_BYTES + 1, 200), (b"x" * (v.MAX_BYTES + 1), None, 200), (b"denied", None, 403)):
            response = Response(body, length)
            response.status = status
            with self.subTest(length=length, status=status), patch.object(v.urllib.request, "build_opener") as factory:
                factory.return_value.open.return_value = response
                with self.assertRaises(ValueError):
                    v.read(v.BASE)
                self.assertEqual(factory.return_value.open.call_args.kwargs["timeout"], 10)

    def test_retry_budget_is_bounded(self):
        for value in ("0", "5", "-1", "not-a-number"):
            with self.subTest(value=value), patch.dict(os.environ, {"PIPELINE_VERIFY_ATTEMPTS": value}), self.assertRaises(ValueError):
                v.bounded_env("PIPELINE_VERIFY_ATTEMPTS", 3, 1, 4)

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate JSON key"):
            v.decode(b'{"a":1,"a":2}')


if __name__ == "__main__":
    unittest.main()
