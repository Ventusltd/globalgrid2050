import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const edition=process.env.PN_JOURNEY_EDITION||'202611180451';
const source=readFileSync(resolve('uk_renewables_pipeline',edition,'scripts/plugins/preview-v928.js'),'utf8');
// Deterministic DOM-event model of the actual complete plugin, not browser proof.
function fixture({saved,technology='all',query='12588'}={}){
 const state={technology,query,county:'Oxfordshire',sort:'capacity_asc',years:{submittedYear:'2023',updatedYear:'All',operationalYear:'All'}},calls=[];
 const tasks=[],nodes=new Map(),listeners=new Map();let active=null;
 class Node{
  constructor(id,view){this.id=id;this.dataset=view?{view}:{};this.attributes={};this.events=new Map();this.hidden=false;this.children=[];this.style={};if(view)this.attributes['aria-controls']=['solar','bess'].includes(view)?'repdPanel':view==='grid'?'gridPanel':view==='datacentre'?'datacentrePanel':view+'Panel';}
  addEventListener(type,fn){this.events.set(type,[...(this.events.get(type)||[]),fn]);}
  emit(type,event={}){for(const fn of this.events.get(type)||[])fn({target:this,isTrusted:false,preventDefault(){},...event});}
  click(){this.emit('click');}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  focus(){active=this;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  querySelector(selector){return selector==='.ggdc-table'&&this.hasTable?{}:null;}
 }
 const views=['solar','bess','grid','datacentre','offtakers','prices'],tabs=views.map(view=>new Node(view+'Tab',view));
 for(const tab of tabs){nodes.set(tab.id,tab);tab.attributes['aria-selected']=String(tab.dataset.view==='solar');}
 for(const id of ['repdPanel','gridPanel','datacentrePanel','offtakersPanel','pricesPanel','tbody','contextDisclosure','contextHost','gridSourcesHost'])nodes.set(id,new Node(id));
 nodes.get('tbody').dataset.complete='false';
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id)},querySelectorAll:selector=>selector==='.pipeline-tabs [role="tab"]'?tabs:[],querySelector:selector=>selector.startsWith('#tech ')?{click(){const technology=selector.split('"')[1];state.technology=technology;calls.push({...state,years:{...state.years}});}}:null,createElement:tag=>new Node(tag),createDocumentFragment:()=>new Node('fragment')};
 const window={addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},GGDataCentreUI:{mount:async host=>{host.hasTable=true;}}};
 class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
 const history={state:saved?{pipelineJourneyReturn:{category:saved}}:null};
 const context=vm.createContext({document,window,history,location:{href:'https://globalgrid2050.com/example/?technology='+technology+'&q='+query,hostname:'globalgrid2050.com'},URL,CustomEvent,TextDecoder,queueMicrotask:fn=>tasks.push(fn),fetch:async()=>{throw Error('Offline source directory fixture');},console});
 vm.runInContext(source,context);
 return{state,calls,history,tab:view=>tabs.find(tab=>tab.dataset.view===view),category:()=>tabs.find(tab=>tab.attributes['aria-selected']==='true')?.dataset.view,focused:()=>active?.dataset.view,complete(){nodes.get('tbody').dataset.complete='true';window.dispatchEvent(new CustomEvent('pipeline-projects-rendered'));while(tasks.length)tasks.shift()();}};
}
for(const category of ['solar','bess'])for(const technology of ['all','wind_offshore']){
 test('cold '+category+' restores '+technology+' and nondefault query/filter state without re-query',()=>{
  const f=fixture({saved:category,technology,query:technology==='all'?'12588':'2470'}),before=structuredClone(f.state);f.complete();f.tab(category).click();
  assert.equal(f.category(),category);assert.deepEqual(f.state,before);assert.equal(f.calls.length,0,'category-only restore must not click the technology filter');
  f.tab(category).click();assert.equal(f.state.technology,category);assert.equal(f.calls.length,1,'the history marker must be consumed exactly once');
 });
}
test('trusted mouse and keyboard keep normal solar/BESS defaults after restore',()=>{
 const f=fixture({saved:'solar'});f.complete();f.tab('solar').click();f.tab('bess').emit('click',{isTrusted:true});assert.equal(f.state.technology,'bess');
 f.tab('bess').emit('keydown',{isTrusted:true,key:'Home'});assert.equal(f.state.technology,'solar');assert.equal(f.focused(),'solar');assert.equal(f.calls.length,2);
});
for(const selected of ['bess','grid','datacentre'])test('early trusted '+selected+' wins over late initialisation and saved restore',async()=>{
 const f=fixture({saved:'solar',technology:'solar'});f.tab(selected).emit('click',{isTrusted:true});const before=structuredClone(f.state);f.complete();f.tab('solar').click();
 assert.equal(f.category(),selected);assert.deepEqual(f.state,before);await Promise.resolve();
});
test('early trusted keyboard choice survives first project completion',()=>{
 const f=fixture({saved:'solar',technology:'solar'});f.tab('solar').emit('keydown',{isTrusted:true,key:'ArrowRight'});f.complete();f.tab('solar').click();assert.equal(f.category(),'bess');assert.equal(f.state.technology,'bess');
});
test('BFCache-like retained DOM does not reinitialise from later history state',()=>{
 const f=fixture({technology:'all'});f.complete();f.tab('bess').emit('click',{isTrusted:true});f.state.technology='wind_offshore';const before=structuredClone(f.state);f.history.state={pipelineJourneyReturn:{category:'bess'}};f.complete();assert.deepEqual(f.state,before);assert.equal(f.category(),'bess');
});
