import json, re
B='C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/'
d=json.load(open(B+'202609141531/data.json',encoding='utf-8'))
j=json.load(open(B+'202609141531/journeys.json',encoding='utf-8'))
keep=re.compile(r'stars|testcode/2026091413|testcode/2026091414|ventus-grid-engine|globalgrid2050.com/(index.html)?$|grid_engine/index.html$')
out={'source':'testcode/202609141531/data.json + journeys.json','observed_utc':d['observed_utc'],'browser':d['browser'],'renderer':d['renderer'],'records_total':len(d['records']),'unique_urls':len({r['url'] for r in d['records']}),'loads':[],'journeys':[]}
for r in d['records']:
    if keep.search(r['url']):
        m=r.get('metrics') or {}
        out['loads'].append({'url':r['url'],'width':r['width'],'status':r['status'],'error':r.get('error'),'scroll_width':m.get('scroll_width'),'inner_width':m.get('inner_width'),'load_wall_ms':r.get('load_wall_ms'),'fcp_ms':next((p['start_ms'] for p in m.get('paint') or [] if p['name']=='first-contentful-paint'),None),'console_errors':r.get('console_errors'),'bad_status':r.get('bad_status'),'touch_points':m.get('touch_points'),'title':m.get('title'),'document_sha256':r.get('document_sha256')})
for x in j:
    out['journeys'].append({'url':x['url'],'width':x['width'],'input':x['input'],'errors':x['errors'],'scroll_width':x['metrics'].get('scroll_width'),'inner_width':x['metrics'].get('inner_width'),'fcp_ms':next((p['start_ms'] for p in x['metrics'].get('paint') or [] if p['name']=='first-contentful-paint'),None),'numbered_lines_visible':x['metrics'].get('numbered_lines_visible'),'status':x['status']})
out['not_surveyed']=['dashboard ?graph=* (13 graph ids in root index.html: overview, structure, modular, federation, chemistry, periodic-table, engine-graph, vedic, sense, random, proof-of-work, gridatlas-lineage, generated-apps) - no ?graph= URL in data.json','testcode/202609141522/* - no record','individual 202609141350/vNN pages at startup - only journeys.json covers them']
json.dump(out,open('../lens_mobile_evidence.json','w',encoding='utf-8'),indent=1)
print(len(out['loads']),len(out['journeys']))
