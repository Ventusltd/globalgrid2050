import json, struct, collections
B='C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/'
d=json.load(open(B+'202609141531/data.json',encoding='utf-8'))
recs=d['records']
for r in recs:
    if r['url'] in ('https://globalgrid2050.com/','https://globalgrid2050.com/index.html') or '1522' in r['url'] or 'graph=' in r['url']:
        m=r.get('metrics') or {}
        print(r['url'],r['width'],'status',r['status'],'sw',m.get('scroll_width'),'load',r.get('load_wall_ms'),'cerr',r.get('console_errors'),'bad',[(b['url'][-50:],b['status']) for b in r.get('bad_status') or []],'title',m.get('title'))
print('any 1522 url:',any('1522' in r['url'] for r in recs))
print('any graph= url:',any('graph=' in r['url'] for r in recs))
# data pack
D=B+'202609142202/data/'
fam=json.load(open(D+'families.json',encoding='utf-8'))
blk=json.load(open(D+'blocks.json',encoding='utf-8'))
prov=json.load(open(D+'provenance.json',encoding='utf-8'))
raw=open(D+'lines.bin','rb').read()
n=len(raw)//4
arr=struct.unpack('<%dI'%n,raw)
print('families.json type',type(fam).__name__,'len',len(fam) if isinstance(fam,list) else list(fam.keys()))
print('blocks.json keys',list(blk.keys()) if isinstance(blk,dict) else type(blk))
if isinstance(blk,dict):
    for k,v in blk.items():
        print('  ',k,type(v).__name__,len(v) if hasattr(v,'__len__') else v)
    if 'blocks' in blk: print('  block sample',blk['blocks'][0])
print('lines.bin bytes',len(raw),'entries',n,'unique',len(set(arr)),'min',min(arr),'max',max(arr))
if isinstance(fam,list):
    print('sum lineCount',sum(f.get('lineCount',0) for f in fam),'blocks in fam',len(set(f['block'] for f in fam)),'cats in fam',len(set(f['category'] for f in fam)))
    print('fam keys',sorted(set(k for f in fam for k in f)))
print('prov keys',list(prov.keys()))
for k,v in prov.items():
    if k!='sources': print(' ',k,':',json.dumps(v)[:600])
print('sources',len(prov['sources']))
for s in prov['sources']:
    if 'index.json' in s['url'] or 'names' in s['url'] or 'blocks' in s['url']: print('  ',s['url'],s['bytes'],s.get('http_status'))
for f in ('electron','random','entangled'):
    x=json.load(open(D+f+'.json',encoding='utf-8'))
    print(f, type(x).__name__, list(x.keys())[:10] if isinstance(x,dict) else len(x))
