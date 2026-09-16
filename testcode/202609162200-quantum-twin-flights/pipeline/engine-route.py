"""Step ENGINE-ROUTE: which wafer keys each ventus-grid-engine module owns. Writes engine-route.json. Deterministic."""
import json, glob, os, sys, collections, re
STARS = os.environ.get('STARS_CODE', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'stars\code'))
ENGINE = os.environ.get('ENGINE_DIR', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'ventus-grid-engine\engine'))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = sorted(f[:-3] for f in os.listdir(ENGINE) if f.endswith('.js'))
keys = collections.defaultdict(set); fams = collections.defaultdict(list)
for f in glob.glob(os.path.join(STARS, 'f', '*.json')):
    for fid, v in json.load(open(f, encoding='utf-8')).items():
        hit = None
        for pl in v.get('places', []):
            m = re.search(r'engine/([a-z0-9-]+)\.js$', pl.get('path', ''))
            if m and m.group(1) in mods: hit = m.group(1); break
        if hit: keys[hit].update(v.get('lines', [])); fams[hit].append({'id': fid, 'name': (v.get('names') or [''])[0], 'keys': v.get('lines', [])})
out = {'modules': {m: {'keys': sorted(keys[m]), 'families': fams[m]} for m in mods}}
found = [m for m in mods if keys[m]]
if not found: sys.exit('FAIL: no engine module has keys on the wafer')
json.dump(out, open(os.path.join(ROOT, 'engine-route.json'), 'w'), separators=(',', ':'))
print(json.dumps({'step': 'engine-route', 'modules': len(mods), 'on_wafer': len(found), 'keys': sum(len(keys[m]) for m in mods), 'missing': [m for m in mods if not keys[m]]}))
