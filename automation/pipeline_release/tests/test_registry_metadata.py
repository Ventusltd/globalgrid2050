"""Malformed CI records must fail before the full release/browser verification."""
import copy
import html
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

RELEASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RELEASE))
import common
import verify

ACTUAL_REGISTRY = common.REGISTRY


class RegistryMetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pn-registry-metadata-")
        self.parent = Path(tempfile.gettempdir()).resolve()
        self.folder = Path(self.temp.name).resolve()
        self.assertEqual(self.folder.parent, self.parent)
        self.assertTrue(self.folder.name.startswith("pn-registry-metadata-"))
        self.addCleanup(self.cleanup_temp)
        self.registry = self.folder / "registry.json"
        patcher = mock.patch.object(common, "REGISTRY", self.registry)
        patcher.start()
        self.addCleanup(patcher.stop)

    def cleanup_temp(self):
        # Confirm the exact generated path before the standard-library recursive
        # cleanup on Windows; these tests never clean a caller-supplied path.
        target = Path(self.temp.name).resolve()
        self.assertEqual(target.parent, self.parent)
        self.assertTrue(target.name.startswith("pn-registry-metadata-"))
        self.temp.cleanup()

    def write(self, data):
        self.registry.write_text(json.dumps(data), encoding="utf-8")

    def bad_string_record(self):
        return {"versions": [{"id": "202611170324", "ci":
            "https://github.com/Ventusltd/globalgrid2050/actions/runs/44016860896"}]}

    def test_missing_null_empty_and_extended_metadata_round_trip_unchanged(self):
        data = {"versions": [
            {"id": "missing"}, {"id": "null", "ci": None},
            {"id": "empty", "ci": {}},
            {"id": "legacy", "ci": {"workflow": "Original workflow", "pull_request": 68,
                "conclusion": "success", "note": "Original provenance retained"}},
        ]}
        common.save_registry(data)
        self.assertEqual(common.load_registry(), data)

    def test_reported_url_string_is_rejected_with_release_and_field(self):
        self.write(self.bad_string_record())
        with self.assertRaisesRegex(ValueError, "202611170324: ci must be an object or null"):
            common.load_registry()

    def test_verify_rejects_string_before_scratch_tree_or_runner_work(self):
        self.write(self.bad_string_record())
        with mock.patch.object(verify.tempfile, "mkdtemp") as scratch, \
                mock.patch.object(verify, "tree_hash") as tree, \
                mock.patch.object(verify, "run") as runner:
            with self.assertRaisesRegex(ValueError, "202611170324: ci must be an object or null"):
                verify.main()
            scratch.assert_not_called()
            tree.assert_not_called()
            runner.assert_not_called()

    def test_save_rejects_bad_metadata_before_existing_bytes_change(self):
        original = b"existing registry bytes\n"
        self.registry.write_bytes(original)
        with self.assertRaisesRegex(ValueError, "ci must be an object or null"):
            common.save_registry(self.bad_string_record())
        self.assertEqual(self.registry.read_bytes(), original)

    def test_other_non_object_ci_values_are_rejected(self):
        for value in ([], 1, True, False):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "ci must be an object or null"):
                    common.validate_registry_metadata({"versions": [{"id": "release", "ci": value}]})

    def test_optional_renderer_fields_require_strings(self):
        for field in ("url", "conclusion"):
            for value in (None, True, 1, [], {}):
                with self.subTest(field=field, value=value):
                    with self.assertRaisesRegex(ValueError, rf"ci\.{field} must be a string"):
                        common.validate_registry_metadata({"versions": [{"id": "release", "ci": {field: value}}]})

    def test_string_content_and_extra_metadata_are_not_rewritten_or_enum_limited(self):
        data = {"versions": [{"id": "release", "ci": {"url": "../legacy-receipt.html#run",
            "conclusion": "provider_specific_result", "source_commit": "original", "extra": {"keep": True}}}]}
        before = copy.deepcopy(data)
        self.assertIs(common.validate_registry_metadata(data), data)
        common.save_registry(data)
        self.assertEqual(common.load_registry(), before)

    def test_actual_corrected_registry_metadata_renders_all_versions(self):
        original = json.loads(ACTUAL_REGISTRY.read_text(encoding="utf-8"))
        self.write(original)
        reg = common.load_registry()
        self.assertEqual(reg, original)
        v932 = next(v for v in reg["versions"] if v["id"] == "202611170324")
        self.assertIsInstance(v932["ci"], dict)
        self.assertEqual(v932["ci"]["url"], "https://github.com/Ventusltd/globalgrid2050/actions/runs/44016860896")
        # Use actual release/CI metadata with explicitly unexecuted verdicts.
        # This exercises the real renderer, not the expensive release runners.
        doc = {"generated_at": "metadata-only regression fixture", "versions": []}
        for version in reversed(reg["versions"]):
            doc["versions"].append({**version, "ci": version.get("ci"),
                "state": version.get("state", "published"), "url": version["id"] + "/",
                "verdict": "NOT_RUN", "browser_checked": False,
                "known_faults": version.get("known_faults", []),
                "checks": {"map_contract": {"rows": reg["expected_record_count"], "pass": False}}})
        rendered = verify.render(doc)
        self.assertEqual(rendered.count('<tr class="not_run">'), len(reg["versions"]))
        self.assertIn(html.escape(v932["ci"]["url"]), rendered)
        self.assertIn("SUCCESS</a>", rendered)


if __name__ == "__main__":
    unittest.main()
