"""Bake cached EA LiDAR 1 m DTM around a point into a small file the lidar-onsite module draws.

Reads ONLY the local mirror E:/lidar-mirror (built from the local caches E:/lidar-cache, E:/world-cache and the
bulk zips; no network, never the EA WCS). Writes mod/lidar-onsite/<name>.json: every 1 km tile within `search`
metres that holds data, cropped to its data, sampled every `step` metres as int16 centimetres (-32768 = no data).
Usage: python bake.py <name> <E> <N> [search_m=3000] [step_m=5]
"""
import sys, json, base64, os
import numpy as np
sys.path.insert(0, os.environ.get('LIDAR_MIRROR_SRC', 'lidar-mirror/src'))  # the private mirror store, set by the operator
import mirror_store as ms

ROOT = 'E:/lidar-mirror'
name, E, N = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
search = float(sys.argv[4]) if len(sys.argv) > 4 else 3000.0
step = int(sys.argv[5]) if len(sys.argv) > 5 else 5
patches = []
for te in range(int((E - search) // 1000) * 1000, int(E + search) + 1, 1000):
    for tn in range(int((N - search) // 1000) * 1000, int(N + search) + 1, 1000):
        tid = ms.tile_id(te, tn)
        meta, h = ms.read_tile(ROOT, tid, 'dtm')
        if meta is None:
            continue
        h = np.asarray(h)                                  # rows south->north, cell SW corner (e0+c, n0+r)
        ok = np.isfinite(h)
        if not ok.any():
            continue
        rows, cols = np.where(ok)
        r0, r1 = rows.min() // step * step, rows.max() // step * step
        c0, c1 = cols.min() // step * step, cols.max() // step * step
        sub = h[r0:r1 + 1:step, c0:c1 + 1:step]           # sample the cell at every step-th SW corner
        q = np.where(np.isfinite(sub), np.round(sub * 100), -32768).astype('<i2')
        patches.append(dict(tile=tid, e0=int(meta['e0'] + c0), n0=int(meta['n0'] + r0), step=step,
                            w=int(sub.shape[1]), h=int(sub.shape[0]), valid=int(ok.sum()),
                            min=float(np.nanmin(sub)), max=float(np.nanmax(sub)),
                            source=meta['source'].split(':')[0], survey_year=meta.get('survey_year'),
                            cm=base64.b64encode(q.tobytes()).decode()))
out = dict(name=name, E=E, N=N, search=search, step=step, product='dtm',
           credit='Contains Environment Agency LiDAR 1 m DTM, OGL v3 (local cache)', patches=patches)
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, name + '.json'), 'w') as f:
    json.dump(out, f)
idx = os.path.join(here, 'index.json')
lst = json.load(open(idx)) if os.path.exists(idx) else []
lst = [a for a in lst if a['name'] != name] + [dict(name=name, E=E, N=N, search=search)]
json.dump(lst, open(idx, 'w'))
print(name, len(patches), 'patches', [(p['tile'], p['w'], p['h'], p['valid']) for p in patches])
