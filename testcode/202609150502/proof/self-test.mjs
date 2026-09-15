import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {makeCore,readState,queryFor,projectURL,seriesLight} from '../model.mjs';
import ring from '../ring.mjs';
import table from '../table.mjs';
const root=new URL('../',import.meta.url),json=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const report={pass:false,checks:[]};
const check=(name,fn)=>{fn();report.checks.push({name,pass:true});};
try{
const pack=json('data/uk-solar.json'),today=json('data/today.json'),core=makeCore(pack),seed=today.seed;
check('public source hashes',()=>{for(const [name,proof] of Object.entries(json('data/provenance.json').files)){const b=fs.readFileSync(new URL(`data/${name}`,root));assert.equal(b.length,proof.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),proof.sha256);}});
check('all permanent records and explicit null geometry',()=>{assert.equal(core.N,3563);assert.equal(core.byKey.size,3563);assert.deepEqual(core.rec.filter(p=>p.latitude===null).map(p=>p.repd_ref),['14773','1613','1616','17120','17260']);assert.equal(core.rec.filter(p=>p.latitude!==null).length,3558);});
check('declared totals are recomputed at source precision',()=>{assert.equal(core.N,pack.solar_projects);assert.equal(Number(core.rec.reduce((s,p)=>s+(p.capacity_mw??0),0).toFixed(3)),pack.solar_capacity_mw);for(const status of core.statuses)assert.equal(core.rec.filter(p=>p.status===status).length,pack.by_status[status]);});
const view={w:430,h:380,seed,focus:0};const a=new Float32Array(core.N*2),b=new Float32Array(core.N*2);
check('registered lens contracts and pure deterministic ring bounds',()=>{for(const L of [ring,table])for(const key of ['id','from','wants','draws','hint','layout','edges','labels'])assert.ok(key in L);ring.layout(core,view,a);ring.layout(core,view,b);assert.deepEqual(a,b);assert.ok(a.every(Number.isFinite));for(let i=0;i<core.N;i++){assert.ok(a[2*i]>=0&&a[2*i]<=view.w);assert.ok(a[2*i+1]>=0&&a[2*i+1]<=view.h);}const source=fs.readFileSync(new URL('ring.mjs',root),'utf8');assert.ok(!/\bfetch\s*\(|#[a-fA-F0-9]{6}\b|history\.|state\.\w+\s*=/.test(source));});
check('URL round trip preserves seed selection and lens',()=>{for(const key of ['10000','14773']){const s=readState(`?lens=table&seed=${seed}&repd_ref=${key}`,seed,core);assert.equal(s.focus,core.resolve(key));assert.deepEqual(readState(queryFor(s),seed,core),s);s.lens='ring';assert.equal(readState(queryFor(s),seed,core).key,key);assert.equal(new URL(projectURL(key)).searchParams.get('repd_ref'),key);}});
check('unknown and malformed input is explicit',()=>{assert.equal(readState('?seed=bad&lens=unknown&repd_ref=999999999',seed,core).notes.length,3);assert.equal(readState('?seed=bad',seed,core).seed,seed);assert.equal(readState(`?seed=${'f'.repeat(64)}`,seed,core).seed,'f'.repeat(64));});
check('different valid seed changes layout, key order does not',()=>{ring.layout(core,{...view,seed:'a'.repeat(64)},b);assert.notDeepEqual(a,b);const reversed=makeCore({...pack,projects:[...pack.projects].reverse()});ring.layout(reversed,view,b);assert.deepEqual(a,b);});
check('reject invented or partial coordinates and invalid capacity',()=>{for(const edit of [{latitude:0},{capacity_mw:-1},{capacity_mw:NaN}]){const p=structuredClone(pack);Object.assign(p.projects.find(x=>x.latitude===null),edit);assert.throws(()=>makeCore(p));}const p=structuredClone(pack);p.projects[0].capacity_mw=null;assert.equal(makeCore(p).mass[0],0);p.projects[0].capacity_mw=0;assert.equal(makeCore(p).mass[0],0);});
check('light uses measured series with finite bounded values',()=>{const light=seriesLight(today.pv_live.series);assert.equal(light.length,today.pv_live.intervals);assert.ok(light.every(x=>x>=0&&x<=1));assert.deepEqual(seriesLight([{generation_mw:0}]),[0]);assert.throws(()=>seriesLight([{generation_mw:NaN}]));});
check('no unseeded random calls in shipped production modules',()=>{for(const name of ['model.mjs','ring.mjs','table.mjs','app.mjs'])assert.ok(!/Math\.random\s*\(/.test(fs.readFileSync(new URL(name,root),'utf8')));});
report.pass=true;
}catch(e){report.error=e.stack;}
const out=process.env.REPORT_PATH;if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
