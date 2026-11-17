"""Real ancestry restates V9.36 identities; changed declarations remain invalid."""
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline_release"))
from feature_contracts import check_features, NEON_MIGRATIONS, SOLAR_MIGRATION


class NeonOriginTests(unittest.TestCase):
    def registry(self, migration=NEON_MIGRATIONS[0]):
        feature = {"id": migration["id"], "file": "original.json", "contains": "original marker"}
        source = {"id": migration["from"], "parent": None, "features": [feature]}
        repeated = {"id": "202611171609", "parent": source["id"], "features": [copy.deepcopy(feature)]}
        current = {"id": "202611171710", "parent": repeated["id"], "features": [],
                   "feature_migrations": [copy.deepcopy(migration)]}
        return current, {v["id"]: v for v in (source, repeated, current)}

    def verdict(self, current, registry):
        with patch("feature_contracts._ticker_neon", return_value=([], [])), patch("feature_contracts._solar_inline", return_value=([], [])):
            return check_features(current, registry, Path("synthetic"))[0]

    def test_identical_descendant_restatements_keep_exact_original_identity(self):
        current, registry = self.registry()
        self.assertTrue(self.verdict(current, registry)["pass"])

    def test_changed_descendant_marker_is_rejected(self):
        current, registry = self.registry()
        registry["202611171609"]["features"][0]["contains"] = "changed"
        self.assertFalse(self.verdict(current, registry)["pass"])

    def test_identity_introduced_before_original_source_is_rejected(self):
        current, registry = self.registry()
        source = registry[NEON_MIGRATIONS[0]["from"]]
        earlier = {"id": "202611171400", "parent": None, "features": copy.deepcopy(source["features"])}
        registry[earlier["id"]] = earlier
        source["parent"] = earlier["id"]
        self.assertFalse(self.verdict(current, registry)["pass"])

    def test_duplicate_identity_inside_one_edition_is_rejected(self):
        current, registry = self.registry()
        registry["202611171609"]["features"] *= 2
        self.assertFalse(self.verdict(current, registry)["pass"])

    def test_old_migration_still_requires_single_exact_source(self):
        current, registry = self.registry(SOLAR_MIGRATION)
        self.assertFalse(self.verdict(current, registry)["pass"])


if __name__ == "__main__":
    unittest.main()
