import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const edition=process.env.PN_NEWS_RETURN_EDITION||'202611180633';
const project=readFileSync(`uk_renewables_pipeline/${edition}/scripts/plugins/projects-v9-8.js`,'utf8');
const energy=readFileSync('automation/energy_context_ui/20261118/view.mjs','utf8');
function declaration(source,name){
 const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);
 const open=source.indexOf('{',start);let depth=1,end=open+1;
 while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
 assert.equal(depth,0,name);return source.slice(start,end);
}
const sync=declaration(project,'syncFilterUrl');
const restore=declaration(energy,'restoreNews');
const apply=energy.split('\n').find(line=>line.startsWith('const applyRequest='));assert.ok(apply);
const origin={origin_type:'substation',origin_id:'grid_substations:0'};
const saved={path:`/uk_renewables_pipeline/${edition}/`,filters:{query:'storage',source:'GOV.UK',topic:'grid',category:'policy',kind:'government'},origin,contextTopic:'grid'};
function fixture(){
 const history={state:{pipelineEnergyNewsReturn:structuredClone(saved),pipelineJourneyReturn:{category:'grid'},unrelated:{keep:true}},replaceState(state,_title,url){this.state=structuredClone(state);if(url)location.href=url.href;}};
 const location={pathname:saved.path,href:`https://globalgrid2050.com${saved.path}?news_topic=storage#headlinesHeading`,search:'?news_topic=storage'};
 const query={value:'',dispatchEvent(){}};
 const selects=Object.fromEntries(Object.entries(saved.filters).filter(([k])=>k!=='query').map(([k,value])=>[k,{value:'',options:[{value:''},{value}]}]));
 const tasks=[];const box={window:{location},history,location,URL,query,selects,tasks,Event:class{},structuredClone};
 vm.createContext(box);vm.runInContext(`let technology='wind_offshore',status='All',county='Oxfordshire',query='12588',sortMode='updated_desc',submittedYear='All',updatedYear='All',operationalYear='All';
 const returnKey='pipelineEnergyNewsReturn',filterKinds=['source','topic','category','kind'];let requestApplied=false,feed=null,activeTopic=null,selectedOrigin=null;
 function newsQuery(){return globalThis.query;}function newsSelect(kind){return selects[kind];}function requestedContext(){return {topic:'storage'};}function connectNews(){return true;}function renderMain(){}function selectOrigin(value){selectedOrigin=value;}function topicFilter(topic){activeTopic=topic;return true;}function setTimeout(fn){tasks.push(fn);}
 ${sync}\n${restore}\n${apply}
 globalThis.sync=syncFilterUrl;globalThis.feedReady=()=>{feed={items:[]};applyRequest();};globalThis.drain=()=>{while(tasks.length)tasks.shift()();};globalThis.visible=()=>({topic:activeTopic,origin:selectedOrigin,filters:{query:globalThis.query.value,...Object.fromEntries(filterKinds.map(k=>[k,selects[k].value]))}});`,box);
 return box;
}
for(const order of ['sync-before-feed','feed-captured-before-sync'])test(`real URL sync preserves visible context and second cold return: ${order}`,()=>{
 const f=fixture();const keys=structuredClone(f.history.state);
 if(order==='sync-before-feed'){f.sync();f.feedReady();}else{f.feedReady();f.sync();}
 f.drain();assert.deepEqual(f.history.state,keys);
 assert.equal(new URL(f.location.href).searchParams.get('technology'),'wind_offshore');assert.equal(new URL(f.location.href).searchParams.get('q'),'12588');
 assert.equal(new URL(f.location.href).searchParams.get('news_topic'),'storage');assert.equal(new URL(f.location.href).hash,'#headlinesHeading');
 assert.deepEqual(JSON.parse(JSON.stringify(f.visible())),{topic:'grid',origin,filters:saved.filters});
 const second=fixture();second.history.state=structuredClone(f.history.state);second.sync();second.feedReady();second.drain();
 assert.deepEqual(JSON.parse(JSON.stringify(second.visible())),{topic:'grid',origin,filters:saved.filters});
});
test('a normal filter URL update with no saved return remains usable',()=>{const f=fixture();f.history.state=null;f.sync();assert.equal(f.history.state,null);assert.equal(new URL(f.location.href).searchParams.get('county'),'Oxfordshire');});
