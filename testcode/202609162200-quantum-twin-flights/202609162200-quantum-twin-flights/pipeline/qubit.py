"""Step QUBIT: every family as an atom with shells K (same file), L (same repository), M (other repositories),
so every key can be a qubit: sin^2(theta/2) = M/(K+L+M) = P(AWAY), the chance the next caller sits in another repository.
Shipped atoms (testcode/202609142202/data/electron.json, 500 of 7,607) are used verbatim; the rest are derived from
family places by the same rule and marked derived. Deterministic; writes qubit.json."""
import json, glob, os, sys, collections
STARS = os.environ.get('STARS_CODE', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'stars\code'))
QT = os.environ.get('QT_DIR', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'globalgrid2050\testcode\202609142202\data'))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shipped = {}
try:
    for a in json.load(open(os.path.join(QT, 'electron.json'), encoding='utf-8'))['atoms']:
        shipped[str(a['n'])] = {'K': a['shells']['K'], 'L': a['shells']['L'], 'M': a['shells']['M'], 'name': a['name'], 'class': a.get('class'), 'spin': a.get('spin'), 'valence': a.get('valence'), 'homes': a.get('homes'), 'source': 'electron.json'}
except Exception as e: print('no electron.json:', e)
atoms = {}; n_derived = 0
for f in glob.glob(os.path.join(STARS, 'f', '*.json')):
    for fid, v in json.load(open(f, encoding='utf-8')).items():
        if fid in shipped: atoms[fid] = shipped[fid]; continue
        places = v.get('places', [])
        if not places: continue
        home_repo = places[0].get('repo', ''); home_file = os.path.basename(places[0].get('path', ''))
        K = sum(1 for p in places if p.get('repo') == home_repo and os.path.basename(p.get('path', '')) == home_file)
        L = sum(1 for p in places if p.get('repo') == home_repo and os.path.basename(p.get('path', '')) != home_file)
        M = sum(1 for p in places if p.get('repo') != home_repo)
        atoms[fid] = {'K': K, 'L': L, 'M': M, 'name': (v.get('names') or [''])[0], 'homes': sorted({p.get('repo', '').split('/')[-1] for p in places}), 'source': 'derived from places'}; n_derived += 1
out = {'rule': 'P(AWAY) = M/(K+L+M): K same file, L same repository, M other repositories', 'shipped': len([a for a in atoms.values() if a['source'] == 'electron.json']), 'derived': n_derived, 'atoms': atoms}
if not atoms: sys.exit('FAIL: no atoms')
json.dump(out, open(os.path.join(ROOT, 'qubit.json'), 'w'), separators=(',', ':'))
print(json.dumps({'step': 'qubit', 'atoms': len(atoms), 'shipped': out['shipped'], 'derived': n_derived}))
