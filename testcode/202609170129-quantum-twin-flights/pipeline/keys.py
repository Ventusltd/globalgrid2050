"""Step KEYS: export the wafer's resolvable particles (key, place, name, line) to keys.json. Deterministic."""
import json, glob, os, sys
WAFER = os.environ.get('WAFER_DIR', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'globalgrid2050\testcode\202609160224'))
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'keys.json')
keys, place, name, line, family = [], [], [], [], []
files = sorted(glob.glob(os.path.join(WAFER, 'p', '*.json')), key=lambda s: int(os.path.basename(s)[:-5]))
if not files: sys.exit(f'FAIL: no particle buckets under {WAFER}')
for f in files:
    d = json.load(open(f, encoding='utf-8')); keys += d['key']; place += d['place']; name += d['name_of']; line += d['line']; family += d['family']
top = json.load(open(os.path.join(WAFER, 'particles.json'), encoding='utf-8'))
if len(keys) != len(set(keys)): sys.exit('FAIL: duplicate keys on the wafer')
json.dump({'law': top['law'], 'max_key': max(keys), 'count': len(keys), 'keys': keys, 'place': place, 'name': name, 'line': line, 'family': family,
           'places': top['places'], 'names': top['names']}, open(OUT, 'w'), separators=(',', ':'))
print(json.dumps({'step': 'keys', 'particles': len(keys), 'max_key': max(keys)}))
