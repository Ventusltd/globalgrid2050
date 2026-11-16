"""Global DC facts remain separate, attributable, reproducible and conservative."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import copy

import pytest

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'uk_renewables_pipeline/202611161630/global-datacentres'


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def test_curated_sample_is_genuinely_global_and_source_namespaced():
    data = load('projects.json')
    assert data['record_count'] == len(data['records']) == 12
    assert data['country_count'] == len({p['country']['wikidata_id'] for p in data['records']}) == 10
    assert {'Japan', 'India', 'Australia', 'Brazil', 'United States', 'United Kingdom'} <= {p['country']['name'] for p in data['records']}
    assert len({p['id'] for p in data['records']}) == 12
    assert all(p['id'].startswith('DC-WD-Q') for p in data['records'])
    assert 'not a comprehensive' in data['coverage']
    assert all(p['operating_status'] == 'not_assessed' and p['verification_status'] == 'SOURCE_INDEXED' for p in data['records'])


def test_export_reproduces_from_fixed_cc0_facts_and_original_coordinates():
    spec = importlib.util.spec_from_file_location('global_dc_build', DATA / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data = load('projects.json')
    assert module.build(DATA / 'source-facts.json') == data
    assert hashlib.sha256((DATA / 'source-facts.json').read_bytes()).hexdigest() == data['source_facts_sha256']
    facts = load('source-facts.json')
    assert facts['licence'] == 'CC0-1.0'
    assert all(r['http_status'] == 200 and len(r['response_sha256']) == 64 for r in facts['requests'])
    for record in data['records']:
        original = facts['entities'][record['id'].removeprefix('DC-WD-')]
        assert record['name'] == original['label']
        assert record['source']['revision'] == original['revision']
        assert f"oldid={original['revision']}" in record['source']['revision_url']
        if record['location'] is not None:
            coordinates = module.values(original, 'P625')[0]
            assert record['location']['latitude'] == coordinates['latitude']
            assert record['location']['longitude'] == coordinates['longitude']
            assert record['location']['precision_degrees'] == coordinates['precision']


def test_unknown_capacity_and_coordinates_never_fabricated():
    records = load('projects.json')['records']
    for record in records:
        assert record['capacity'] == {'it_load_mw': None, 'site_demand_mw': None, 'grid_connection_mw': None}
        assert all(source is None for source in record['capacity_sources'].values())
    for entity in ['Q142068471', 'Q142068695', 'Q142068699']:
        record = next(p for p in records if p['id'] == 'DC-WD-' + entity)
        assert record['location'] is None
    # A deprecated ISO claim is not promoted into a current code.
    assert next(p for p in records if p['country']['wikidata_id'] == 'Q55')['country']['code'] is None


def test_browser_model_filters_links_capacity_and_rejects_bad_records():
    result = subprocess.run(['node', str(DATA / 'test-model.cjs')], capture_output=True, text=True, check=True)
    assert 'PASS' in result.stdout


def test_parquet_exact_readback_schema_nulls_and_deterministic_bytes(tmp_path):
    import duckdb
    spec = importlib.util.spec_from_file_location('global_dc_furnace', DATA / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.build(DATA / 'source-facts.json', output_dir=tmp_path)
    audit = json.loads((tmp_path / 'pipeline-audit.json').read_text())
    parquet = tmp_path / module.PARQUET
    assert parquet.read_bytes() == (DATA / module.PARQUET).read_bytes()
    assert audit['double_compile'] == 'BYTE_IDENTICAL'
    assert audit['browser_export_source'] == 'DUCKDB_PARQUET_READBACK'
    assert audit['row_count'] == audit['distinct_source_ids'] == 12
    assert audit['quarantined_rows'] == audit['verified_rows'] == 0
    with duckdb.connect(':memory:') as db:
        assert db.execute('SELECT count(*) FROM read_parquet(?,hive_partitioning=false) WHERE it_load_mw IS NULL AND site_demand_mw IS NULL AND grid_connection_mw IS NULL', [str(parquet)]).fetchone()[0] == 12
        assert db.execute('SELECT count(*) FROM read_parquet(?,hive_partitioning=false) WHERE latitude IS NULL AND longitude IS NULL', [str(parquet)]).fetchone()[0] == 3
        assert db.execute('SELECT DISTINCT compression FROM parquet_metadata(?)', [str(parquet)]).fetchall() == [('ZSTD',)]


@pytest.mark.parametrize('mutation', [
    lambda f: f.update(licence='unknown'),
    lambda f: f['selected_ids'].append(f['selected_ids'][0]),
    lambda f: f['entities']['Q12857142']['claims']['P625'][0]['value'].update(latitude=200),
    lambda f: f['entities']['Q12857142']['claims'].update(P17=[]),
])
def test_invalid_inputs_are_quarantined_before_output_changes(tmp_path, mutation):
    spec = importlib.util.spec_from_file_location('global_dc_invalid', DATA / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    facts = copy.deepcopy(load('source-facts.json'))
    mutation(facts)
    path = tmp_path / 'invalid-source.json'
    path.write_text(json.dumps(facts), encoding='utf-8')
    target = tmp_path / 'output'
    target.mkdir()
    previous = target / 'projects.json'
    previous.write_text('previous accepted output', encoding='utf-8')
    with pytest.raises(ValueError, match='quarantine'):
        module.build(path, output_dir=target)
    assert previous.read_text() == 'previous accepted output'
    assert not (target / module.PARQUET).exists()
