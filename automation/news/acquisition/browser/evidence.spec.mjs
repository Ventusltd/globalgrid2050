import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const release='/uk_renewables_pipeline/202611161630/';
const pointerURL='https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-evidence-data/dist/news/evidence/latest.json';
const manifest=JSON.parse(await readFile(new URL('../../../../uk_renewables_pipeline/202611161630/solar1000/manifest.json',import.meta.url)));
const schema='globalgrid2050.solar-evidence.provisional.v1';
const generated='2026-11-16T16:30:00Z';
const hostileTitle='TEST FIXTURE ONLY: REPD 1018 <img src=x onerror="window.evidenceInjected=true">';
function fixture(){
  const projects=manifest.ids.map((id,i)=>({project_id:id,name:'Synthetic browser fixture',status:i?'RESEARCH_ATTEMPTED_NO_EVIDENCE':'PROVISIONAL',evidence_count:i?0:1,provisional_count:i?0:1,verified_count:0,last_event:null,last_researched_at:generated,evidence:i?[]:[{id:'fixture',url:'https://example.org/test-only-solar-article',title:hostileTitle,pub_date:generated,source_id:'fixture_only',publisher:'TEST FIXTURE ONLY',status:'PROVISIONAL',match_method:'repd_id',first_seen:generated,last_seen:generated}]}));
  const data={schema,generated_at:generated,source_run_at:generated,seed_release:'202611161244',project_count:1000,evidence_count:1,verified_count:0,review_required:true,sources:[],research_scope:'Synthetic browser fixture only',projects};
  const body=JSON.stringify(data);
  return {body,pointer:{schema,generated_at:generated,snapshot:'snapshot_20261116T163000Z',json:'snapshot_20261116T163000Z/evidence.json',sha256:{'evidence.json':createHash('sha256').update(body).digest('hex')},project_count:1000,evidence_count:1,review_required:true}};
}
async function installRoutes(page,mode='valid'){
  const f=fixture();
  if(mode==='bad-digest')f.pointer.sha256['evidence.json']='0'.repeat(64);
  if(mode==='invalid-status'){
    const data=JSON.parse(f.body);data.projects[0].status='VERIFIED';
    f.body=JSON.stringify(data);f.pointer.sha256['evidence.json']=createHash('sha256').update(f.body).digest('hex');
  }
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url===pointerURL){
      if(mode==='unavailable')return route.fulfill({status:503,body:'source unavailable'});
      return route.fulfill({contentType:'application/json',body:JSON.stringify(f.pointer)});
    }
    if(url===new URL(f.pointer.json,pointerURL).href)return route.fulfill({contentType:'application/json',body:f.body});
    if(url.startsWith('http://127.0.0.1:4173/'))return route.continue();
    // Keep browser smoke deterministic. External service availability is a
    // separate live gate, never inferred from these intercepted test responses.
    return route.abort();
  });
}
async function ready(page){
  await page.goto(release);
  await expect(page.locator('[data-pilot-status]')).toContainText('Pilot loaded');
  await expect(page.locator('#tbody')).toHaveAttribute('data-complete','true');
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
}
test('provisional evidence, escaping, search, map contract, and full CSV',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installRoutes(page);await ready(page);
  await expect(page.locator('[data-evidence-status]')).toContainText('1 provisional matches');
  await page.locator('[data-pilot-search]').fill('1018');
  const panel=page.locator('[data-evidence-project="1018"]');
  await expect(panel.locator('summary')).toHaveText('Evidence · Provisional: 1');
  await panel.locator('summary').click();
  await expect(panel.locator('a')).toHaveText(hostileTitle);
  await expect(panel.locator('a')).toHaveAttribute('href','https://example.org/test-only-solar-article');
  await expect(panel.locator('a')).toHaveAttribute('target','_blank');
  await expect(panel.locator('img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.evidenceInjected)).toBeUndefined();
  const panelBox=await panel.boundingBox();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.x+panelBox.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.locator('#solar1000Pilot').screenshot({path:testInfo.outputPath('evidence-panel.png')});
  const map=page.locator('.v924-row').filter({has:panel}).locator('a.v924-map');
  await expect(map).toHaveAttribute('target','_blank');
  const mapURL=new URL(await map.getAttribute('href'));
  expect(mapURL.protocol).toBe('https:');expect(mapURL.searchParams.get('repd_ref')).toBe('1018');
  expect(mapURL.searchParams.get('technology')).toBe('solar');
  await page.locator('[data-pilot-search]').fill('1019');
  await expect(page.locator('[data-evidence-project="1019"] summary')).toHaveText('Evidence · Provisional: 0');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportInline').click();
  const download=await downloadPromise;
  const csv=await readFile(await download.path(),'utf8');
  expect(csv).toContain('1018');
  expect(csv.trim().split(/\r?\n/)).toHaveLength(7776);
  expect(errors).toEqual([]);
});
for(const mode of ['unavailable','bad-digest','invalid-status'])test(`${mode} evidence preserves register and maps`,async({page})=>{
  await installRoutes(page,mode);await ready(page);
  await expect(page.locator('[data-evidence-status]')).toContainText('Evidence unavailable');
  await page.locator('[data-pilot-search]').fill('1018');
  await expect(page.locator('[data-evidence-project="1018"] summary')).toHaveText('Evidence · Unavailable');
  await expect(page.locator('.v924-row a.v924-map')).toHaveAttribute('href',/repd_ref=1018/);
  await page.locator('[data-technology="solar"]').click();
  await expect(page.locator('#resultsMeta')).toContainText('3,604');
});
