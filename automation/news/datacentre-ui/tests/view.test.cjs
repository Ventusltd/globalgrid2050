/* Source-integrity loading and failure-mode tests, no external network. */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const view = require('../view.js');
const ROOT = path.resolve(__dirname, '../../../..');
const current = 'uk_renewables_pipeline/202611161757/global-datacentres/';
const baseline = 'uk_renewables_pipeline/202611161747/global-datacentres/projects.json';
const files = {
  projects:current+'projects.json',official:current+'official-projects.json',
  groups:current+'project-groups.json',audit:current+'selection-audit.json',baseline
};
const contents = Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(path.join(ROOT,p),'utf8')]));
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
const inputs = {urls:Object.fromEntries(Object.keys(files).map(k=>[k,'fixture://'+k])),
  sha256:Object.fromEntries(Object.keys(files).map(k=>[k,digest(contents[k])]))};
const fetcher = async url => ({ok:true,text:async()=>contents[url.replace('fixture://','')]});
const hasMessage = async (fn,needle) => {
  await assert.rejects(fn,e=>String(e.message).includes(needle));
};
test('SHA-256 pinned five-file loader accepts actual cohort',async()=>{
  const b=await view.load(inputs,fetcher,digest);
  assert.equal(b.projects.records.length,100);
  assert.equal(b.official.projects.length,3);
  assert.equal(b.groups.records.length,6);
  assert.equal(b.audit.quarantined.length,38);
  assert.equal(b.baseline.records.length,12);
});
test('reject modified bytes / stale or corrupted source',async()=>{
  const tamper=async url=>({ok:true,text:async()=>url==='fixture://projects'?contents.projects+' ':contents[url.replace('fixture://','')]});
  await hasMessage(()=>view.load(inputs,tamper,digest),'hash differs');
});
test('reject unavailable source instead of partial rendering',async()=>{
  const missing=async url=>url==='fixture://official'?{ok:false}:{ok:true,text:async()=>contents[url.replace('fixture://','')]};
  await hasMessage(()=>view.load(inputs,missing,digest),'unavailable');
});
test('reject a missing source hash',async()=>{
  const bad=structuredClone(inputs);delete bad.sha256.groups;
  await hasMessage(()=>view.load(bad,fetcher,digest),'Unpinned');
});
test('reject URL script scheme even when digest exists',async()=>{
  const bad=structuredClone(inputs);bad.urls.projects='javascript:alert(1)';
  await hasMessage(()=>view.load(bad,fetcher,digest),'unsafe');
});
test('reject validly hashed but malformed JSON',async()=>{
  const badText='{broken';
  const bad=structuredClone(inputs);bad.sha256.projects=digest(badText);
  const badFetch=async url=>({ok:true,text:async()=>url==='fixture://projects'?badText:contents[url.replace('fixture://','')]});
  await assert.rejects(()=>view.load(bad,badFetch,digest),SyntaxError);
});
test('reject validly hashed but fake VERIFIED row',async()=>{
  const item=JSON.parse(contents.projects);item.records[0].verification_status='VERIFIED';
  const badText=JSON.stringify(item),bad=structuredClone(inputs);bad.sha256.projects=digest(badText);
  const badFetch=async url=>({ok:true,text:async()=>url==='fixture://projects'?badText:contents[url.replace('fixture://','')]});
  await hasMessage(()=>view.load(bad,badFetch,digest),'unverified');
});
test('on failure, mount removes stale content and visibly fails closed',async()=>{
  const previous=global.document;
  global.document={createElement(tag){return {tagName:tag,nodeType:1,className:'',textContent:'',setAttribute(){}}}};
  try {
    const host={nodes:[{textContent:'STALE 100 RECORDS'}],replaceChildren(...nodes){this.nodes=nodes}};
    const bad=structuredClone(inputs);bad.sha256.projects='0'.repeat(64);
    const r=await view.mount(host,bad,fetcher,digest);
    assert.ok(r.error.includes('hash differs'));
    assert.equal(host.nodes.length,1);
    assert.match(host.nodes[0].textContent,/unavailable/);
    assert.doesNotMatch(host.nodes[0].textContent,/STALE/);
  } finally {global.document=previous;}
});
