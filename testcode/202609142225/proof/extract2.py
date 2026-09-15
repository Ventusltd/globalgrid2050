import json, struct, collections, re
B='C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/'
d=json.load(open(B+'202609141531/data.json',encoding='utf-8'))
recs=d['records']
by=collections.defaultdict(dict)
for r in recs: by[r['url']][r['width']]=r
pat=re.compile(r'graph|stars|testcode|dashboard|engine|generator|code-|lens|star',re.I)
for u in sorted(by):
    if not pat.search(u): continue
    row=[u]
    for w in (1440,430):
        r=by[u].get(w)
        if not r: row.append(f'{w}:MISSING'); continue
        m=r.get('metrics') or {}
        row.append(f"{w}: status={r.get('status')} err={r.get('error')} sw={m.get('scroll_width')} iw={m.get('inner_width')} ovf={m.get('overflow')} load={r.get('load_wall_ms')} dom={(m.get('navigation') or [{}])[0].get('dom_ms')} fcp={[p['start_ms'] for p in (m.get('paint') or []) if p['name']=='first-contentful-paint']} cerr={len(r.get('console_errors') or [])} failed={len(r.get('failed_requests') or [])} bad={[(b['url'][-40:],b['status']) for b in (r.get('bad_status') or [])]} touch={m.get('touch_points')} title={m.get('title')!r}")
    print('\n  '.join(row))
print()
print('origins',collections.Counter(u.split('/')[2] for u in by))
print('inventory_origin',collections.Counter(r['inventory_origin'] for r in recs))
print('errors present',sum(1 for r in recs if r.get('error')))
ovf430=[(u,by[u][430]['metrics']['scroll_width']) for u in by if 430 in by[u] and by[u][430].get('metrics') and by[u][430]['metrics'].get('overflow')]
print('430 overflow count',len(ovf430))
