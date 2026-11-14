#!/usr/bin/env python3
"""hashguard.py - "no truncation of previous work" guard.

A snapshot is a manifest of (id, size, path) for files that must not change:
  * git mode    : `git ls-tree -r -l <rev>`  -> git blob id, blob size, path  (every tracked file)
  * sha256 mode : a given list of paths      -> "sha256:<hex>", byte size, path
The on-disk format is the same three-column TSV as /home/claude/monitor/*.blobmanifest.tsv
(`<id>\\t<size>\\t<path>`, no header, paths unquoted, sorted by path).

compare fails (exit 1) when any path of the BEFORE snapshot changed, shrank or disappeared in AFTER,
unless the path matches an explicit allow-list pattern. Paths that exist only in AFTER are additions:
reported, never failed.  AFTER can be another snapshot file, a git revision, or a working tree.

Usage
  python3 -I hashguard.py snapshot --git REPO [--rev HEAD] --out before.tsv
  python3 -I hashguard.py snapshot --root DIR (--paths-file LIST | --paths P [P ...]) --out before.tsv
  python3 -I hashguard.py compare --before before.tsv
          (--after after.tsv | --after-git REPO[@REV] | --worktree DIR [--full-hash])
          [--allow GLOB ...] [--allow-file FILE] [--json report.json] [--max-list N]

Allow-list patterns are fnmatch globs over the repo-relative path ('*' also crosses '/'); a pattern ending
in '/' allows everything under that directory.  Blank lines and '#' comments are ignored in --allow-file.

Working-tree mode (git repo, default): tracked files take their blob id from the index unless
`git status` reports them modified, in which case the file is hashed with `git hash-object` (so
.gitattributes filters apply, giving ids comparable with ls-tree).  --full-hash re-hashes every file.
Untracked, non-ignored files are additions. Ignored files are not examined.
Outside a git repo every file is hashed as a raw git blob (sha1 of "blob <n>\\0" + bytes).

Exit status: 0 = no violation; 1 = at least one pre-existing file changed/shrank/disappeared outside the
allow-list; 2 = could not run (bad arguments, unreadable manifest, git failure, mixed id kinds).
"""
import argparse
import datetime
import fnmatch
import hashlib
import json
import os
import subprocess
import sys

SCHEMA = 'globalgrid2050.hashguard-report.v1'


class GuardError(Exception):
    pass


# ------------------------------------------------------------------ manifest I/O
def _unquote(p):
    if len(p) >= 2 and p[0] == '"' and p[-1] == '"':  # git C-style quoting
        return p[1:-1].encode('latin-1', 'backslashreplace').decode('unicode_escape').encode('latin-1').decode('utf-8')
    return p


def read_manifest(path):
    """-> {path: (id, size_or_None)}"""
    out = {}
    with open(path, encoding='utf-8', newline='') as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip('\n').rstrip('\r')
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t', 2)
            if len(parts) != 3:
                raise GuardError(f'{path}:{n}: expected "<id>\\t<size>\\t<path>", got {line[:80]!r}')
            oid, size, p = parts
            p = _unquote(p)
            if p in out:
                raise GuardError(f'{path}:{n}: duplicate path {p!r}')
            out[p] = (oid, None if size in ('-', '') else int(size))
    return out


def write_manifest(snap, path):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        for p in sorted(snap):
            if '\t' in p or '\n' in p:
                raise GuardError(f'path contains tab/newline, cannot write manifest: {p!r}')
            oid, size = snap[p]
            f.write(f'{oid}\t{"-" if size is None else size}\t{p}\n')


def id_kind(snap):
    kinds = {('sha256' if oid.startswith('sha256:') else 'git') for oid, _ in snap.values()}
    if len(kinds) > 1:
        raise GuardError('manifest mixes git blob ids and sha256 ids')
    return kinds.pop() if kinds else 'git'


# ------------------------------------------------------------------ hashing helpers
def _git(repo, *args, input_bytes=None):
    try:
        # GIT_OPTIONAL_LOCKS=0: `git status` must not refresh/write the index of the repo being guarded
        env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
        r = subprocess.run(['git', '-C', repo, *args], input=input_bytes, capture_output=True, check=True, env=env)
    except FileNotFoundError:
        raise GuardError('git executable not found')
    except subprocess.CalledProcessError as e:
        raise GuardError(f'git {" ".join(args)} failed in {repo}: {e.stderr.decode(errors="replace").strip()}')
    return r.stdout


def is_git_worktree(root):
    try:
        return _git(root, 'rev-parse', '--is-inside-work-tree').strip() == b'true' and \
            os.path.realpath(_git(root, 'rev-parse', '--show-toplevel').decode().strip()) == os.path.realpath(root)
    except GuardError:
        return False


def raw_blob_id(path):
    size = os.path.getsize(path)
    h = hashlib.sha1(b'blob %d\0' % size)
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def sha256_id(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return 'sha256:' + h.hexdigest()


def git_hash_paths(root, paths, filters=True):
    """git blob ids for repo-relative paths that exist as regular files.
    filters=True applies .gitattributes (eol/clean) as `git add` would; False hashes the raw bytes."""
    if not paths:
        return {}
    args = ['hash-object', '--stdin-paths'] + ([] if filters else ['--no-filters'])
    out = _git(root, *args, input_bytes=('\n'.join(paths) + '\n').encode('utf-8'))
    ids = out.decode().split()
    if len(ids) != len(paths):
        raise GuardError('git hash-object returned an unexpected number of ids')
    return dict(zip(paths, ids))


def _exists(root, p):
    fp = os.path.join(root, p)
    return os.path.isfile(fp) or os.path.islink(fp)


# ------------------------------------------------------------------ snapshots
def snapshot_git(repo, rev='HEAD'):
    out = _git(repo, 'ls-tree', '-r', '-l', '-z', rev)
    snap = {}
    for rec in out.split(b'\0'):
        if not rec:
            continue
        meta, p = rec.split(b'\t', 1)
        mode, typ, oid, size = meta.split()
        if typ != b'blob':  # submodule commits: keep the id, size unknown
            snap[p.decode('utf-8')] = (oid.decode(), None)
            continue
        snap[p.decode('utf-8')] = (oid.decode(), int(size))
    return snap


def snapshot_sha256(root, paths):
    snap = {}
    for p in paths:
        p = p.strip()
        if p.startswith('./'):
            p = p[2:]
        if not p:
            continue
        fp = os.path.join(root, p)
        if not os.path.isfile(fp):
            raise GuardError(f'cannot snapshot {p!r}: not a file under {root}')
        snap[p] = (sha256_id(fp), os.path.getsize(fp))
    return snap


def list_worktree_files(root):
    if is_git_worktree(root):
        out = _git(root, 'ls-files', '-co', '--exclude-standard', '-z')
        return [p.decode('utf-8') for p in out.split(b'\0') if p and _exists(root, p.decode('utf-8'))]
    files = []
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if x != '.git']
        for f in fs:
            files.append(os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/'))
    return files


class Snap(dict):
    """{path: (id, size)} plus .alt {path: second acceptable id}: a working-tree file whose raw bytes and
    filtered (.gitattributes-normalised) bytes hash differently matches BEFORE if either id equals it.
    This happens for blobs committed with CRLF before `* text=auto eol=lf` was added."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.alt = {}


def snapshot_worktree(root, kind='git', paths=None, full_hash=False):
    """Current state of a working tree, in the id kind of the snapshot it will be compared with.
    paths: restrict hashing to these (sha256 kind); additions are still discovered by listing."""
    snap = Snap()
    alts = snap.alt
    if kind == 'sha256':
        for p in (paths if paths is not None else list_worktree_files(root)):
            fp = os.path.join(root, p)
            if os.path.isfile(fp):
                snap[p] = (sha256_id(fp), os.path.getsize(fp))
        if paths is not None:  # additions: list only, ids not computed
            for p in list_worktree_files(root):
                snap.setdefault(p, ('unhashed', os.path.getsize(os.path.join(root, p))))
        return snap
    if not is_git_worktree(root):
        for p in list_worktree_files(root):
            fp = os.path.join(root, p)
            snap[p] = (raw_blob_id(fp), os.path.getsize(fp))
        return snap
    if full_hash:
        files = list_worktree_files(root)
        regular = [p for p in files if os.path.isfile(os.path.join(root, p)) and not os.path.islink(os.path.join(root, p))]
        ids = git_hash_paths(root, regular, filters=False)
        alt = git_hash_paths(root, regular, filters=True)
        for p in files:
            fp = os.path.join(root, p)
            if os.path.islink(fp):
                snap[p] = (hashlib.sha1(b'blob %d\0' % len(os.readlink(fp).encode()) + os.readlink(fp).encode()).hexdigest(),
                           len(os.readlink(fp).encode()))
            else:
                snap[p] = (ids[p], os.path.getsize(fp))
                if alt[p] != ids[p]:
                    alts[p] = alt[p]
        return snap
    # fast path: index ids + re-hash only what git status reports as dirty / untracked
    idx = {}
    for rec in _git(root, 'ls-files', '-s', '-z').split(b'\0'):
        if not rec:
            continue
        meta, p = rec.split(b'\t', 1)
        mode, oid, stage = meta.split()
        idx[p.decode('utf-8')] = (oid.decode(), mode.decode())
    dirty, untracked = set(), set()
    st = _git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames').split(b'\0')
    for rec in st:
        if len(rec) < 4:
            continue
        xy, p = rec[:2].decode(), rec[3:].decode('utf-8')
        (untracked if xy == '??' else dirty).add(p)
    rehash = sorted(p for p in (dirty | untracked) if _exists(root, p) and not os.path.islink(os.path.join(root, p)))
    ids = git_hash_paths(root, rehash, filters=False)
    for p, fid in git_hash_paths(root, rehash, filters=True).items():
        if fid != ids[p]:
            alts[p] = fid
    for p, (oid, mode) in idx.items():
        if p in dirty:
            if p in ids:
                snap[p] = (ids[p], os.path.getsize(os.path.join(root, p)))
            # else deleted from the working tree: absent
        elif mode == '160000':
            snap[p] = (oid, None)
        else:  # unchanged per git status: index id, size of the file on disk (or absent if git disagrees)
            fp = os.path.join(root, p)
            snap[p] = (oid, os.path.getsize(fp) if _exists(root, p) else None)
    for p in untracked:
        if p in ids:
            snap[p] = (ids[p], os.path.getsize(os.path.join(root, p)))
    return snap


# ------------------------------------------------------------------ compare
def load_allow(patterns=None, files=None):
    pats = list(patterns or [])
    for f in files or []:
        with open(f, encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith('#'):
                    pats.append(line)
    return pats


def allowed(path, patterns):
    for pat in patterns:
        if pat.endswith('/') and path.startswith(pat):
            return pat
        if fnmatch.fnmatchcase(path, pat):
            return pat
    return None


def compare(before, after, allow=(), max_list=None):
    """-> report dict. before/after: {path: (id, size_or_None)}"""
    kb = id_kind(before)
    ka = id_kind({p: v for p, v in after.items() if v[0] != 'unhashed'})
    if kb != ka and after:
        raise GuardError(f'cannot compare a {kb} snapshot with a {ka} snapshot')
    violations, allowed_changes, unchanged = [], [], 0
    for p in sorted(before):
        oid, size = before[p]
        if p not in after:
            item = {'path': p, 'change': 'disappeared', 'before_id': oid, 'before_size': size}
        else:
            aid, asize = after[p]
            if aid == oid or getattr(after, 'alt', {}).get(p) == oid:
                unchanged += 1
                continue
            if asize is None:
                asize = size
            kind = 'shrank' if (size is not None and asize is not None and asize < size) else 'changed'
            item = {'path': p, 'change': kind, 'before_id': oid, 'after_id': aid, 'before_size': size, 'after_size': asize}
        pat = allowed(p, allow)
        if pat:
            item['allowed_by'] = pat
            allowed_changes.append(item)
        else:
            violations.append(item)
    additions = [{'path': p, 'id': after[p][0], 'size': after[p][1]} for p in sorted(set(after) - set(before))]
    cut = (lambda xs: xs[:max_list]) if max_list else (lambda xs: xs)
    by = {}
    for v in violations:
        by[v['change']] = by.get(v['change'], 0) + 1
    return {
        'schema': SCHEMA, 'id_kind': kb,
        'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'before_files': len(before), 'after_files': len(after), 'unchanged': unchanged,
        'violations_total': len(violations), 'violations_by_change': by, 'violations': cut(violations),
        'allowed_changes_total': len(allowed_changes), 'allowed_changes': cut(allowed_changes),
        'additions_total': len(additions), 'additions_bytes': sum(a['size'] or 0 for a in additions),
        'additions': cut(additions), 'allow_patterns': list(allow),
        'result': 'FAIL' if violations else 'PASS', 'exit_code': 1 if violations else 0,
    }


def _parse_git_spec(spec):
    if '@' in spec and not os.path.exists(spec):
        repo, rev = spec.rsplit('@', 1)
        return repo, rev or 'HEAD'
    return spec, 'HEAD'


def main(argv=None):
    ap = argparse.ArgumentParser(description='no-truncation hash guard')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('snapshot')
    s.add_argument('--git', help='repository: snapshot every tracked file of --rev')
    s.add_argument('--rev', default='HEAD')
    s.add_argument('--root', help='directory for sha256 mode')
    s.add_argument('--paths-file')
    s.add_argument('--paths', nargs='+')
    s.add_argument('--out', required=True)
    c = sub.add_parser('compare')
    c.add_argument('--before', required=True)
    g = c.add_mutually_exclusive_group(required=True)
    g.add_argument('--after')
    g.add_argument('--after-git', help='REPO or REPO@REV')
    g.add_argument('--worktree')
    c.add_argument('--full-hash', action='store_true')
    c.add_argument('--allow', action='append', default=[])
    c.add_argument('--allow-file', action='append', default=[])
    c.add_argument('--json')
    c.add_argument('--max-list', type=int, default=0, help='truncate lists in the JSON report (0 = all)')
    c.add_argument('--quiet', action='store_true')
    try:
        a = ap.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    try:
        if a.cmd == 'snapshot':
            if bool(a.git) == bool(a.root):
                raise GuardError('give exactly one of --git or --root')
            if a.git:
                snap = snapshot_git(a.git, a.rev)
            else:
                paths = list(a.paths or [])
                if a.paths_file:
                    with open(a.paths_file, encoding='utf-8') as f:
                        paths += [ln.strip() for ln in f if ln.strip() and not ln.startswith('#')]
                if not paths:
                    raise GuardError('sha256 mode needs --paths or --paths-file')
                snap = snapshot_sha256(a.root, paths)
            write_manifest(snap, a.out)
            print(f'snapshot: {len(snap)} files, {sum(v[1] or 0 for v in snap.values())} bytes -> {a.out}')
            return 0
        before = read_manifest(a.before)
        kind = id_kind(before)
        if a.after:
            after = read_manifest(a.after)
        elif a.after_git:
            if kind != 'git':
                raise GuardError('a sha256 snapshot can only be compared with a working tree or another sha256 snapshot')
            after = snapshot_git(*_parse_git_spec(a.after_git))
        else:
            after = snapshot_worktree(a.worktree, kind, paths=sorted(before) if kind == 'sha256' else None,
                                      full_hash=a.full_hash)
        allow = load_allow(a.allow, a.allow_file)
        rep = compare(before, after, allow, a.max_list or None)
        rep['before'] = a.before
        rep['after'] = a.after or (('git:' + a.after_git) if a.after_git else ('worktree:' + a.worktree +
                                                                               (' (full hash)' if a.full_hash else '')))
    except (GuardError, OSError, ValueError) as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 2
    if not a.quiet:
        print(f'{rep["result"]}: {rep["before_files"]} pre-existing files, {rep["unchanged"]} unchanged, '
              f'{rep["violations_total"]} violations {rep["violations_by_change"]}, '
              f'{rep["allowed_changes_total"]} allowed changes, {rep["additions_total"]} additions '
              f'({rep["additions_bytes"]} bytes)')
        for v in rep['violations'][:50]:
            print(f'  VIOLATION {v["change"]:11} {v["path"]}')
        for v in rep['additions'][:50]:
            print(f'  added {v["path"]}')
        if rep['additions_total'] > 50:
            print(f'  ... {rep["additions_total"] - 50} more additions')
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(rep, f, indent=1, ensure_ascii=False)
            f.write('\n')
    return rep['exit_code']


if __name__ == '__main__':
    sys.exit(main())
