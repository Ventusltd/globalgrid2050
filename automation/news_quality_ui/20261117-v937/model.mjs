const kinds=new Set(['government','regulator','institution','listed_parent','reporting','discovery']);
const topics=new Set(['solar','storage','grid','datacentre','wind','renewables']);
export function validClock(value){
 if(typeof value!=='string')return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(value);if(!m)return false;
 const [y,month,day]=m.slice(1).map(Number),days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return y>=1900&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&Number.isFinite(Date.parse(value));
}
function feedUrl(value){try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/^[\d.]+$/.test(u.hostname)&&!u.hostname.endsWith('.')&&!/(^|\.)(localhost|local|internal)$/.test(u.hostname)&&(!u.port||u.port==='443');}catch{return false;}}
export function auditHealth(doc){
 const items=Array.isArray(doc?.items)?doc.items:[],publishers=new Map();let unknownPublishers=0;
 for(const item of items){const name=typeof item?.source==='string'?item.source.trim():'';if(name)publishers.set(name,(publishers.get(name)||0)+1);else unknownPublishers++;}
 const result={articles:Array.isArray(doc?.items)?items.length:null,publishers:[...publishers].sort((a,b)=>a[0].localeCompare(b[0])),unknownPublishers,collectionClock:validClock(doc?.generated_at)?doc.generated_at:null,status:typeof doc?.status==='string'?doc.status:'unavailable',available:false,reason:'Feed-health metadata unavailable or inconsistent'};
 if(items.some(item=>!item||typeof item!=='object')||!Array.isArray(doc?.feeds)||!doc.feeds.length||doc.feeds.length>500||!doc.counts)return result;
 const seen=new Set();let ok=0,failed=0;
 for(const f of doc.feeds){
  if(!f||!feedUrl(f.url)||seen.has(f.url)||typeof f.source!=='string'||!f.source.trim()||!['ok','failed'].includes(f.status)||!Number.isInteger(f.entries)||f.entries<0||!Number.isInteger(f.kept)||f.kept<0||f.kept>f.entries||(f.newest!==null&&!validClock(f.newest)))return result;
  seen.add(f.url);if(f.status==='ok')ok++;else failed++;
 }
 if(doc.counts.items!==items.length||doc.counts.feeds_ok!==ok||doc.counts.feeds_failed!==failed||doc.status==='ok'&&failed||doc.status==='partial'&&(!ok||!failed)||doc.status==='failed'&&ok||!['ok','partial','failed'].includes(doc.status))return result;
 if(doc.counts.with_possible_match!==undefined&&doc.counts.with_possible_match!==items.filter(item=>item.possible_match).length)return result;
 if(doc.counts.by_category!==undefined){const expected=Object.create(null);for(const item of items){const key=item.category||'other';expected[key]=(expected[key]||0)+1;}const counts=doc.counts.by_category;if(!counts||Array.isArray(counts)||Object.keys(counts).length!==Object.keys(expected).length||Object.entries(expected).some(([key,total])=>counts[key]!==total))return result;}
 return {...result,available:true,reason:null,feeds:seen.size,ok,failed,failedSources:doc.feeds.filter(f=>f.status==='failed').map(f=>({source:f.source,url:f.url}))};
}
export function classification(entry,ranked){
 const p=ranked?entry?.priority:null,item=entry?.item||{};
 const accepted=!!p&&p.link===item.link&&p.title===item.title&&p.source===item.source&&kinds.has(p.source_kind);
 return {kind:accepted?p.source_kind:'Unclassified',topics:[...new Set([...(typeof item.technology==='string'&&item.technology?[item.technology]:[]),...(accepted&&Array.isArray(p.topics)?p.topics.filter(t=>topics.has(t)):[])])]};
}
export function selectEntries(entries,filter={},ranked=false){
 const tokens=String(filter.query||'').trim().toLocaleLowerCase('en-GB').split(/\s+/).filter(Boolean);
 return entries.filter(entry=>{const item=entry.item,c=classification(entry,ranked);const hay=[item.title,item.source,item.category,...c.topics].join(' ').toLocaleLowerCase('en-GB');return tokens.every(token=>hay.includes(token))&&(!filter.source||item.source===filter.source)&&(!filter.category||item.category===filter.category)&&(!filter.topic||c.topics.includes(filter.topic))&&(!filter.kind||c.kind===filter.kind);});
}
