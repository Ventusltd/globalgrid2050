import json, struct, collections, re
B='C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/'
d=json.load(open(B+'202609141531/data.json',encoding='utf-8'))
j=json.load(open(B+'202609141531/journeys.json',encoding='utf-8'))
recs=d['records']
print('records',len(recs),'discovered',d['discovered_pages'])
print('top keys',list(d.keys()))
print('record keys',sorted(set(k for r in recs for k in r)))
print('metric keys',sorted(set(k for r in recs for k in (r.get('metrics') or {}))))
print('widths',collections.Counter(r['width'] for r in recs))
urls=sorted(set(r['url'] for r in recs))
print('unique urls',len(urls))
pat=re.compile(r'graph=|stars/table|stars/code|testcode/202609141350|testcode/202609141522',re.I)
lens=[u for u in urls if pat.search(u)]
print('lens urls',len(lens))
for u in lens: print(' ',u)
print()
print('JOURNEYS',len(j))
for x in j:
    print(x['url'],x['width'],x['input'],'| errors',x['errors'],'| sw',x['metrics'].get('scroll_width'),x['metrics'].get('inner_width'),'| status:',x['status'])
