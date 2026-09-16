"""Step APPS: every app in the estate as a scope on the wafer. An app = a repo with a working index.html
(root or any published folder) and more than 20 numbered lines. Keys come from family places by repo.
Writes apps.json. Deterministic. Counts are memberships (a key may sit in several families and apps)."""
import json, glob, os, sys, collections
STARS = os.environ.get('STARS_CODE', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'stars\code'))
GITHUB = os.environ.get('GITHUB_DIR', os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
keys = collections.defaultdict(set); fams = collections.Counter(); paths = collections.defaultdict(set)
for f in glob.glob(os.path.join(STARS, 'f', '*.json')):
    for fid, v in json.load(open(f, encoding='utf-8')).items():
        seen = set()
        for pl in v.get('places', []):
            repo = pl.get('repo', '')
            if not repo or repo in seen: continue
            seen.add(repo); keys[repo].update(v.get('lines', [])); fams[repo] += 1; paths[repo].add(pl.get('path', ''))
apps = []
for repo in sorted(keys):
    name = repo.split('/')[-1]; clone = os.path.join(GITHUB, name)
    index = None
    if os.path.isdir(clone):
        for cand in ('index.html', 'atlas/index.html', 'docs/index.html'):
            if os.path.exists(os.path.join(clone, cand)): index = cand; break
        if not index:
            hits = [p for p in paths[repo] if p.endswith('index.html')]
            if hits: index = sorted(hits)[0] + ' (published folder)'
    n = len(keys[repo])
    apps.append({'repo': repo, 'name': name, 'keys': n, 'families': fams[repo], 'index': index, 'cloned': os.path.isdir(clone), 'app': bool(index) and n > 20})
out = {'generated': '2026-09-16', 'rule': 'app = repo with a working index.html and more than 20 numbered lines', 'apps': apps, 'keys': {a['repo']: sorted(keys[a['repo']]) for a in apps if a['app']}}
qualifying = [a for a in apps if a['app']]
if not qualifying: sys.exit('FAIL: no repo qualifies as an app')
json.dump(out, open(os.path.join(ROOT, 'apps.json'), 'w'), separators=(',', ':'))
print(json.dumps({'step': 'apps', 'repos': len(apps), 'apps': len(qualifying), 'largest': max(qualifying, key=lambda a: a['keys'])['name'], 'largest_keys': max(a['keys'] for a in qualifying), 'no_index': [a['name'] for a in apps if not a['app']]}))
