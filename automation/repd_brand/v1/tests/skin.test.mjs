import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {BRAND_SKIN, captureNativeRepdSkin, mountRepdNativeSkin, verifyRepdSkinTokens} from '../skin.mjs';

const css=readFileSync(new URL('../skin.css',import.meta.url),'utf8');

test('brand contract pins existing REPD reference and secondary GridAtlas SCADA source',()=>{
  assert.match(BRAND_SKIN.pinnedReferenceEdition,/202611222330/);
  assert.match(BRAND_SKIN.scadaReference,/gridatlas.*ventusv8\.css/);
  assert.equal(BRAND_SKIN.semanticTechnologyColours.solar,'#ffff00');
  assert.equal(BRAND_SKIN.semanticTechnologyColours.bess,'#ffae00');
  assert.equal(BRAND_SKIN.preservedWarningTicker,'#ff3038');
  assert.deepEqual(BRAND_SKIN.targetPanels,['gridPanel','datacentrePanel','offtakersPanel','pricesPanel']);
});
test('CSS stays within four non-REPD panel namespaces',()=>{
  for(const selector of ['#gridPanel','#datacentrePanel','#offtakersPanel','#pricesPanel'])assert.ok(css.includes(selector));
  assert.doesNotMatch(css,/(^|\n)\s*(?:body|html|:root|#repdScroll|#repdPanel|#officialRegister|#headlineTicker|\.btn|table|td|th)\s*[{,]/);
  assert.ok(!css.includes('!important'),'avoid broad cascade force');
  assert.ok(!css.includes('#ff3038'),'ticker must remain original and out of scope');
});
test('does not mutate any panel before native REPD table has computed rows',()=>{
  const fake={defaultView:{getComputedStyle:()=>({getPropertyValue:()=>''})},querySelector:()=>null,getElementById:()=>null};
  assert.equal(captureNativeRepdSkin(fake),null);
  assert.equal(mountRepdNativeSkin(fake).status,'waiting-for-repd');
  assert.equal(verifyRepdSkinTokens(fake).ok,false);
});
test('adapter matches native tokens and only touches four dedicated hosts',()=>{
  const hosts=new Map(BRAND_SKIN.targetPanels.map(id=>{
    const p=new Map();
    return [id,{style:{setProperty:(key,val)=>p.set(key,val),getPropertyValue:key=>p.get(key)||''},
      classList:{add:()=>{},contains:()=>true},dataset:{}}];
  }));
  const root={getPropertyValue:k=>({'--bg':'#000','--line':'#2f343d','--accent':'#00ffff','--muted':'#a6adbb'})[k]||''};
  const fmt=s=>({backgroundColor:s.bg||'',color:s.color||'',getPropertyValue:()=>''});
  const computed=new Map([
    [':root',root],['#repdScroll thead th',fmt({bg:'rgb(5, 5, 5)',color:'rgb(0, 255, 255)'})],
    ['#repdScroll tbody td',fmt({color:'rgb(166, 173, 187)'})],
    ['#repdScroll tbody td.site',fmt({color:'rgb(255, 255, 255)'})],
    ['#repdScroll tbody td.mw',fmt({color:'rgb(0, 255, 136)'})],
    ['#repdScroll',fmt({bg:'rgb(11, 14, 20)'})]
  ]);
  const d={querySelector:k=>computed.has(k)?k:null,
    defaultView:{getComputedStyle:k=>computed.get(k)},
    getElementById:id=>hosts.get(id)||null};
  const result=mountRepdNativeSkin(d);
  assert.equal(result.status,'mounted');
  assert.equal(result.applied.length,4);
  assert.equal(verifyRepdSkinTokens(d).ok,true);
});
