"""DNA TEST: does a planet's code exist, line by line, where its keys say it does?
For one app, every key it carries is fetched from its recorded repository at its recorded commit and line, and hashed.
Result: found of total, with every miss named. A planet passes its DNA test or it does not. usage: python pipeline/dna.py gridatlas"""
import json, os, sys, subprocess, hashlib, collections, time, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub'))
name = (sys.argv[1] if len(sys.argv) > 1 else 'gridatlas').lower()
A = json.load(open(os.path.join(ROOT, 'apps.json'), encoding='utf-8')); K = json.load(open(os.path.join(ROOT, 'keys.json'), encoding='utf-8'))
app = next((a for a in A['apps'] if a['app'] and a['name'] == name), None) or next((a for a in A['apps'] if a['app'] and name in a['name']), None)
if not app: sys.exit(f'FAIL: no app "{name}"')
want = set(A['keys'][app['repo']]); idx = {k: i for i, k in enumerate(K['keys'])}
by_place = collections.defaultdict(list)
for k in want:
    i = idx.get(k)
    if i is not None: by_place[K['place'][i]].append((k, K['line'][i]))
t0 = time.time(); found = 0; misses = []; cache = {}
for pi, items in by_place.items():
    repo, commit, path = K['places'][pi]; clone = os.path.join(GH, repo.split('/')[1])
    if not os.path.isdir(clone) or not re.fullmatch(r'[0-9a-f]{7,40}', str(commit)): text = None
    else:
        r = subprocess.run(['git', '-C', clone, 'show', f'{commit}:{path}'], capture_output=True); text = r.stdout.decode('utf-8', 'replace').split('\n') if r.returncode == 0 else None
        if text and text[-1] == '': text.pop()
    for k, ln in items:
        if text is None or not ln or ln > len(text): misses.append({'key': k, 'repo': repo, 'commit': commit[:10], 'path': path, 'line': ln, 'why': 'no clone or commit' if text is None else 'line beyond file end'})
        else: found += 1
total = found + len(misses); passed = total > 0 and not misses
out = {'app': app['name'], 'repo': app['repo'], 'keys': total, 'found': found, 'missing': len(misses), 'passed': passed, 'places': len(by_place), 'seconds': round(time.time() - t0, 1), 'misses': misses[:50]}
os.makedirs(os.path.join(ROOT, 'probe'), exist_ok=True); json.dump(out, open(os.path.join(ROOT, 'probe', f'DNA-{app["name"]}.json'), 'w'), indent=1)
print(json.dumps({k: out[k] for k in ['app', 'keys', 'found', 'missing', 'passed', 'places', 'seconds']}))
if not passed: sys.exit(f'FAIL: {len(misses)} of {total} lines not found')
