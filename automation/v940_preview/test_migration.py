"""Adversarial checks for the explicit source-preserving presentation migration."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'automation/pipeline_release'))
from feature_contracts import _ticker_neon


class NeonMigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.folder, self.source = root / 'uk_renewables_pipeline/new', root / 'uk_renewables_pipeline/source'
        for folder in (self.folder, self.source):
            (folder / 'data').mkdir(parents=True)
            (folder / 'data/test.json').write_text('{"synthetic":true}')
            (folder / 'scripts/layers').mkdir(parents=True)
            (folder / 'scripts/layers/model.mjs').write_text('SYNTHETIC unchanged policy')
        (self.folder / 'scripts/layers/ticker.mjs').write_bytes((ROOT / 'uk_renewables_pipeline/202611171710/scripts/layers/ticker.mjs').read_bytes())
        (self.folder / 'contracts').mkdir()
        self.shared = root / 'automation/ticker_neon_ui/20261117-v940'
        shutil.copytree(ROOT / 'automation/ticker_neon_ui/20261117-v940', self.shared)
        self.contract = json.loads((ROOT / 'uk_renewables_pipeline/202611171710/contracts/ticker.v940.json').read_text())
        self.save()

    def tearDown(self):
        self.tmp.cleanup()

    def save(self):
        (self.folder / 'contracts/ticker.v940.json').write_text(json.dumps(self.contract))

    def test_pinned_successor_admits_one_scoped_probe(self):
        errors, probes = _ticker_neon(self.folder, self.source)
        self.assertEqual(errors, [])
        self.assertEqual(len(probes), 1)

    def test_changed_shared_bytes_are_rejected(self):
        (self.shared / 'ticker.mjs').write_text('changed')
        self.assertTrue(_ticker_neon(self.folder, self.source)[0])

    def test_changed_policy_or_data_is_rejected(self):
        for rel in ('scripts/layers/model.mjs', 'data/test.json'):
            path = self.folder / rel
            original = path.read_bytes()
            path.write_text('changed')
            self.assertTrue(_ticker_neon(self.folder, self.source)[0])
            path.write_bytes(original)

    def test_missing_pin_and_wrong_contract_cap_are_rejected(self):
        self.contract['limit'] = 101
        self.save()
        self.assertTrue(_ticker_neon(self.folder, self.source)[0])
        self.contract['limit'] = 100
        self.contract['shared_sha256'].pop('header.mjs')
        self.save()
        self.assertTrue(_ticker_neon(self.folder, self.source)[0])


if __name__ == '__main__':
    unittest.main()
