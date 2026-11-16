"""Real V9.28 cohort/data integration; no browser or facility verification claim."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[3]
EDITION = 'uk_renewables_pipeline/202611161757'
DATA = ROOT / EDITION / 'global-datacentres'


def load(name):
    return json.loads((DATA / name).read_bytes())


def builder():
    spec = importlib.util.spec_from_file_location('v928_dc_build', DATA / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_real_new_edition_100_leads_22_countries_and_quarantine():
    data, audit = load('projects.json'), load('selection-audit.json')
    assert len(data['records']) == data['record_count'] == 100
    assert len({r['id'] for r in data['records']}) == 100
    assert len({r['country']['wikidata_id'] for r in data['records']}) == data['country_count'] == 22
    assert audit['candidate_count'] == data['candidate_count'] == 138
    assert len(audit['quarantined']) == audit['quarantined_count'] == data['quarantined_count'] == 38
    assert audit['independently_verified'] is False
    assert not {r['id'] for r in data['records']} & {r['id'] for r in audit['quarantined']}
    assert builder().project(DATA / 'source-facts.json') == data


def test_original_twelve_semantic_fields_exact_and_null_measurements_retained():
    parent = json.loads((ROOT / 'uk_renewables_pipeline/202611161630/global-datacentres/projects.json').read_bytes())
    records = {r['id']: r for r in load('projects.json')['records']}
    assert len(parent['records']) == 12
    for old in parent['records']:
        for key in ('id', 'name', 'country', 'operator', 'location', 'capacity'):
            assert records[old['id']][key] == old[key]
    assert sum(r['location'] is None for r in records.values()) == 61
    for r in records.values():
        assert r['verification_status'] == 'SOURCE_INDEXED'
        assert r['operating_status'] == 'not_assessed'
        assert all(x is None for x in r['capacity'].values())
        assert all(x is None for x in r['capacity_sources'].values())


def test_compact_sources_keep_full_upstream_objects_and_explicit_hash_bridge():
    manifest = load('integration-manifest.json')
    assert manifest['edition'] == '202611161757' and manifest['grains_separate'] is True
    for source in manifest['sources']:
        served = (DATA / source['served_path']).read_bytes()
        assert hashlib.sha256(served).hexdigest() == source['served_sha256']
        assert b'\n  ' not in served
        # Public source object identity is recorded even in shallow CI clones.
        assert len(source['source_commit']) == len(source['source_blob']) == 40
        assert len(source['source_sha256']) == 64
    facts = (DATA / 'source-facts.json').read_bytes()
    assert hashlib.sha256(facts).hexdigest() == load('projects.json')['source_facts_sha256']
    assert load('pipeline-audit.json')['source_facts_sha256'] == load('projects.json')['source_facts_sha256']
    assert len(load('source-facts.json')['candidate_ids']) == 138


def test_official_and_group_records_are_not_extra_facilities():
    official, groups = load('official-projects.json'), load('project-groups.json')
    assert official['schema'] == 'globalgrid2050.dc-official-projects.v1'
    assert official['coverage']['selected_records'] == len(official['projects']) == 3
    assert official['coverage']['physical_facility_count'] is None
    assert {r['entity_scope'] for r in official['projects']} == {'planning_case', 'tax_qualification_record'}
    cohort_ids = {r['id'] for r in load('projects.json')['records']}
    assert not cohort_ids & {r['project_id'] for r in official['projects']}
    for r in official['projects']:
        assert r['review_status'] == 'PROVISIONAL' and r['current_lifecycle'] == 'UNKNOWN'
        assert r['capacity_mw'] is r['latitude'] is r['longitude'] is r['listed_parent'] is None
        assert r['numeric_claims'] == r['crosswalks'] == []
    assert groups['record_count'] == len(groups['records']) == 6
    assert groups['provisional_count'] == groups['unlinked_count'] == 3
    assert {r['project_id'] for r in groups['records']} <= cohort_ids
    assert all(r['numeric_claims'] == [] and r['legal_ownership_verified'] is False for r in groups['records'])
    manifest_source = next(s for s in load('integration-manifest.json')['sources'] if s['served_path'] == 'source-facts.json')
    assert groups['cohort']['source_facts_sha256'] == manifest_source['source_sha256']


def test_pinned_furnace_double_build_readback_and_new_generation(tmp_path):
    import duckdb
    module = builder()
    assert duckdb.__version__ == '1.3.2'
    assert 'generation=202611161757/' in module.PARQUET
    assert module.build(DATA / 'source-facts.json', output_dir=tmp_path) == load('projects.json')
    assert (tmp_path / module.PARQUET).read_bytes() == (DATA / module.PARQUET).read_bytes()
    assert json.loads((tmp_path / 'pipeline-audit.json').read_bytes()) == load('pipeline-audit.json')
    assert json.loads((tmp_path / 'selection-audit.json').read_bytes()) == load('selection-audit.json')
    with duckdb.connect(':memory:') as db:
        result = db.execute('SELECT count(*),count(DISTINCT source_record_id),count(latitude),count(it_load_mw),count(site_demand_mw),count(grid_connection_mw) FROM read_parquet(?,hive_partitioning=false)', [str(DATA / module.PARQUET)]).fetchone()
        assert result == (100, 100, 39, 0, 0, 0)
    assert not (DATA / 'data/facilities/generation=202611161630/source=WIKIDATA/global-data-centre-records-v1.parquet').exists()


@pytest.mark.parametrize('mutate', [
    lambda f: f['selected_ids'].append(f['selected_ids'][0]),
    lambda f: f['baseline_ids'].pop(),
    lambda f: f['entities']['Q12857142'].update(label='Changed original identity'),
    lambda f: f.update(licence='unknown'),
])
def test_source_identity_or_selection_failure_preserves_accepted_output(tmp_path, mutate):
    facts = deepcopy(load('source-facts.json'))
    mutate(facts)
    path = tmp_path / 'bad.json'
    path.write_text(json.dumps(facts), encoding='utf-8')
    out = tmp_path / 'output'
    out.mkdir()
    sentinel = out / 'projects.json'
    sentinel.write_bytes(b'previous accepted bytes')
    with pytest.raises(ValueError):
        builder().build(path, output_dir=out)
    assert sentinel.read_bytes() == b'previous accepted bytes'
    assert not (out / builder().PARQUET).exists()


def test_edition_under_existing_18_mib_budget_with_working_data_delta():
    # Works in this intentionally sparse producer checkout and a complete CI checkout.
    raw = subprocess.check_output(['git', 'ls-tree', '-rl', 'HEAD', EDITION], cwd=ROOT).decode()
    tracked = {}
    for line in raw.splitlines():
        meta, path = line.split('\t', 1)
        tracked[path] = int(meta.split()[3])
    prefix = EDITION + '/global-datacentres/'
    total = sum(size for path, size in tracked.items() if not path.startswith(prefix))
    total += sum(p.stat().st_size for p in DATA.rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    assert total <= 18 * 1024 * 1024
