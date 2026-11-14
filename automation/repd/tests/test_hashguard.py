"""Tests for automation/repd/hashguard.py using throw-away git repositories under tmp_path."""
import json
import os
import shutil
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
if PKG not in sys.path:
    sys.path.insert(0, PKG)

import hashguard as H  # noqa: E402

pytestmark = pytest.mark.skipif(shutil.which('git') is None, reason='git not installed')

ENV = dict(os.environ, GIT_AUTHOR_NAME='t', GIT_AUTHOR_EMAIL='t@example.invalid', GIT_COMMITTER_NAME='t',
           GIT_COMMITTER_EMAIL='t@example.invalid', GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM='1')


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True, env=ENV).stdout


def make_repo(tmp_path, files):
    repo = tmp_path / 'repo'
    repo.mkdir()
    git(repo, 'init', '-q', '-b', 'main')
    for p, data in files.items():
        fp = repo / p
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_bytes(data)
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'init')
    return repo


FILES = {'repd.csv': b'a,b\n1,2\n3,4\n', 'dist/repd_master.json': b'{"features": [1, 2, 3]}\n',
         'uk_renewables_pipeline/v9/index.html': b'<html>v9</html>\n', 'docs/notes.md': b'notes\n'}


def snap_file(tmp_path, repo, name='before.tsv'):
    out = tmp_path / name
    assert H.main(['snapshot', '--git', str(repo), '--out', str(out)]) == 0
    return out


def compare(tmp_path, *args):
    rep = tmp_path / 'rep.json'
    code = H.main(['compare', *args, '--json', str(rep), '--quiet'])
    return code, (json.loads(rep.read_text()) if rep.exists() else None)


def test_snapshot_matches_ls_tree_format(tmp_path):
    repo = make_repo(tmp_path, FILES)
    out = snap_file(tmp_path, repo)
    lines = out.read_text().splitlines()
    assert len(lines) == len(FILES)
    oid, size, path = lines[0].split('\t')
    assert path == 'dist/repd_master.json' and int(size) == len(FILES[path])
    assert oid == git(repo, 'rev-parse', 'HEAD:' + path).decode().strip()


def test_untouched_worktree_and_additions_pass(tmp_path):
    repo = make_repo(tmp_path, FILES)
    before = snap_file(tmp_path, repo)
    (repo / 'dist').joinpath('project_identity_2026q3.json').write_bytes(b'{}\n')
    (repo / 'uk_renewables_pipeline/202611132345').mkdir(parents=True)
    (repo / 'uk_renewables_pipeline/202611132345/index.html').write_bytes(b'new\n')
    for extra in ([], ['--full-hash']):
        code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(repo), *extra)
        assert code == 0 and rep['result'] == 'PASS'
        assert [a['path'] for a in rep['additions']] == ['dist/project_identity_2026q3.json',
                                                         'uk_renewables_pipeline/202611132345/index.html']


def test_changed_shrank_disappeared_fail(tmp_path):
    repo = make_repo(tmp_path, FILES)
    before = snap_file(tmp_path, repo)
    (repo / 'repd.csv').write_bytes(b'a,b\n')                                 # truncated
    (repo / 'dist/repd_master.json').write_bytes(b'{"features": [9, 9, 9]}\n')  # same size, new bytes
    os.remove(repo / 'uk_renewables_pipeline/v9/index.html')
    for extra in ([], ['--full-hash']):
        code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(repo), *extra)
        assert code == 1 and rep['result'] == 'FAIL'
        got = {v['path']: v['change'] for v in rep['violations']}
        assert got == {'repd.csv': 'shrank', 'dist/repd_master.json': 'changed',
                       'uk_renewables_pipeline/v9/index.html': 'disappeared'}


def test_allow_list_excuses_only_matching_paths(tmp_path):
    repo = make_repo(tmp_path, FILES)
    before = snap_file(tmp_path, repo)
    (repo / 'docs/notes.md').write_bytes(b'notes updated\n')
    (repo / 'repd.csv').write_bytes(b'x\n')
    allow = tmp_path / 'allow.txt'
    allow.write_text('# owned by this component\ndocs/\n')
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(repo), '--allow-file', str(allow))
    assert code == 1 and [v['path'] for v in rep['violations']] == ['repd.csv']
    assert rep['allowed_changes'][0]['path'] == 'docs/notes.md' and rep['allowed_changes'][0]['allowed_by'] == 'docs/'
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(repo), '--allow-file', str(allow),
                        '--allow', 'repd.*')
    assert code == 0 and rep['allowed_changes_total'] == 2


def test_commit_vs_commit(tmp_path):
    repo = make_repo(tmp_path, FILES)
    before = snap_file(tmp_path, repo)
    (repo / 'new.txt').write_bytes(b'n\n')
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'add')
    code, rep = compare(tmp_path, '--before', str(before), '--after-git', f'{repo}@HEAD')
    assert code == 0 and rep['additions_total'] == 1
    git(repo, 'rm', '-q', 'docs/notes.md'); git(repo, 'commit', '-q', '-m', 'rm')
    after = snap_file(tmp_path, repo, 'after.tsv')
    code, rep = compare(tmp_path, '--before', str(before), '--after', str(after))
    assert code == 1 and rep['violations'][0] == {'path': 'docs/notes.md', 'change': 'disappeared',
                                                  'before_id': rep['violations'][0]['before_id'], 'before_size': 6}


def test_sha256_mode(tmp_path):
    root = tmp_path / 'plain'
    root.mkdir()
    (root / 'a.json').write_bytes(b'{"x": 1}\n')
    (root / 'b.csv').write_bytes(b'1,2\n')
    lst = tmp_path / 'list.txt'
    lst.write_text('a.json\n./b.csv\n')
    before = tmp_path / 's.tsv'
    assert H.main(['snapshot', '--root', str(root), '--paths-file', str(lst), '--out', str(before)]) == 0
    assert all(l.startswith('sha256:') for l in before.read_text().splitlines())
    (root / 'c.txt').write_bytes(b'new\n')
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(root))
    assert code == 0 and [a['path'] for a in rep['additions']] == ['c.txt']
    (root / 'b.csv').write_bytes(b'1\n')
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(root))
    assert code == 1 and rep['violations'][0]['change'] == 'shrank'


def test_non_git_directory_uses_raw_blob_ids(tmp_path):
    repo = make_repo(tmp_path, FILES)
    before = snap_file(tmp_path, repo)
    plain = tmp_path / 'copy'
    shutil.copytree(repo, plain, ignore=shutil.ignore_patterns('.git'))
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(plain))
    assert code == 0 and rep['unchanged'] == len(FILES)


def test_crlf_blob_committed_before_eol_attribute_is_not_a_false_change(tmp_path):
    repo = make_repo(tmp_path, {'old.html': b'<p>\r\nold\r\n</p>\r\n'})
    (repo / '.gitattributes').write_bytes(b'* text=auto eol=lf\n')
    git(repo, 'add', '.gitattributes'); git(repo, 'commit', '-q', '-m', 'attrs')
    before = snap_file(tmp_path, repo)
    code, rep = compare(tmp_path, '--before', str(before), '--worktree', str(repo), '--full-hash')
    assert code == 0, rep['violations']


def test_baseline_manifest_reader_and_errors(tmp_path):
    m = tmp_path / 'm.tsv'
    m.write_text('d8b86239a676fc83fff27f6e1f645db4a3bfb06f\t952\t.cvaa/gpu-reuse.json\n'
                 '0123456789012345678901234567890123456789\t-\tsub\n')
    snap = H.read_manifest(str(m))
    assert snap['.cvaa/gpu-reuse.json'] == ('d8b86239a676fc83fff27f6e1f645db4a3bfb06f', 952) and snap['sub'][1] is None
    bad = tmp_path / 'bad.tsv'
    bad.write_text('only two\tcolumns\n')
    assert H.main(['compare', '--before', str(bad), '--worktree', str(tmp_path), '--quiet']) == 2
    mixed = tmp_path / 'mixed.tsv'
    mixed.write_text('sha256:00\t1\ta\n' + 'ab' * 20 + '\t1\tb\n')
    assert H.main(['compare', '--before', str(mixed), '--worktree', str(tmp_path), '--quiet']) == 2
