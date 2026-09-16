"""Step ROUTE: which wafer keys does GridAtlas own? Reads the Modular Star family buckets, writes route-gridatlas.json.
Deterministic. No model involved: a published number must come from a script that can fail."""
import json, glob, collections, os, sys
STARS = os.environ.get('STARS_CODE', os.path.join(os.environ.get('GITHUB_DIR', os.path.expanduser('~/Documents/GitHub')), r'stars\code'))
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'route-gridatlas.json')
want = {
 'atlas/index.html': 'gridatlas/atlas/',
 'atlas/releases/202608300453-atlas-v9/ventusv8.css': 'ventusv8.css',
 'atlas/releases/202608300453-atlas-v9/index.html': 'releases/202608300453-atlas-v9/index.html',
 'atlas/cartridges/202609041945-streaming-parquet-bridge-v9-5.js': 'streaming-parquet-bridge',
 'atlas/cartridges/202609071213-place-global-search-v9-5.js': 'place-global-search',
 'atlas/cartridges/202609062358-substation-intelligence-v9-63.js': 'substation-intelligence-v9-63',
 'atlas/cartridges/202609080850-sld-sandbox-v9-8.js': 'sld-sandbox-v9-8',
}
per = collections.defaultdict(lambda: {'families': 0, 'keys': set(), 'repos': set()})
allkeys, fams = set(), []
buckets = glob.glob(os.path.join(STARS, 'f', '*.json'))
if not buckets: sys.exit(f'FAIL: no family buckets under {STARS}')
for f in buckets:
    for fid, v in json.load(open(f, encoding='utf-8')).items():
        hit = None
        for pl in v.get('places', []):
            path, repo = pl.get('path', ''), pl.get('repo', '')
            for tp, frag in want.items():
                if path.endswith(tp.split('/')[-1]) and 'gridatlas' in repo: hit = (tp, repo, path); break
            if hit: break
        if hit:
            tp, repo, path = hit; d = per[tp]; d['families'] += 1; d['keys'].update(v.get('lines', [])); d['repos'].add(repo)
            allkeys.update(v.get('lines', [])); fams.append({'id': fid, 'name': (v.get('names') or [''])[0], 'file': tp, 'keys': v.get('lines', []), 'repo': repo, 'path': path})
out = {'law': 'r = sqrt(key), theta = key * 2.39996', 'source': 'stars/code/f families matched by repo path',
       'files': {k: {'families': d['families'], 'keys': sorted(d['keys']), 'repos': sorted(d['repos'])} for k, d in per.items()},
       'keys': sorted(allkeys), 'families': fams}
if len(allkeys) == 0: sys.exit('FAIL: route has zero keys')
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
shared = sum(len(v['keys']) for v in out['files'].values()) - len(allkeys)
print(json.dumps({'step': 'route', 'unique_keys': len(allkeys), 'shared_between_files': shared, 'families': len(fams), 'files': {k: len(v['keys']) for k, v in out['files'].items()}, 'note': 'a key can belong to several families; counts per file overlap'}))
