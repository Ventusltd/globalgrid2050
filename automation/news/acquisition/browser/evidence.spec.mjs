import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const release='/uk_renewables_pipeline/202611161630/';
const pointerURL='https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-evidence-data/dist/news/evidence/latest.json';
const manifest=JSON.parse(await readFile(new URL('../../../../uk_renewables_pipeline/202611161630/solar1000/manifest.json',import.meta.url)));
const schema='globalgrid2050.solar-evidence.provisional.v1';
const generated='2026-11-16T16:30:00Z';
const researchScope='Completed bounded feed scan using strict name/REPD-ID matching; not independent project-first research. No match is not proof no evidence exists.';
const hostileTitle='TEST FIXTURE ONLY: REPD 1018 <img src=x onerror="window.evidenceInjected=true">';
function fixture(){
  const projects=manifest.ids.map((id,i)=>({project_id:id,name:'Synthetic browser fixture',status:i?'RESEARCH_ATTEMPTED_NO_EVIDENCE':'PROVISIONAL',evidence_count:i?0:1,provisional_count:i?0:1,verified_count:0,last_event:null,last_researched_at:generated,evidence:i?[]:[{id:'fixture',url:'https://example.org/test-only-solar-article',title:hostileTitle,pub_date:generated,source_id:'fixture_only',publisher:'TEST FIXTURE ONLY',status:'PROVISIONAL',match_method:'repd_id',first_seen:generated,last_seen:generated}]}));
  const data={schema,generated_at:generated,source_run_at:generated,seed_release:'202611161244',project_count:1000,evidence_count:1,verified_count:0,review_required:true,sources:[{id:'fixture_only',status:'ok',url:'https://example.org/test-only-feed',rights_review_url:'https://example.org/test-only-rights-receipt',fetched_at:generated,http_status:200,response_sha256:'a'.repeat(64),eligible_for_publication:true,probe_only:false,rights_status:'accepted'}],research_scope:researchScope,projects};
  const body=JSON.stringify(data);
  return {body,pointer:{schema,generated_at:generated,snapshot:'snapshot_20261116T163000Z',json:'snapshot_20261116T163000Z/evidence.json',sha256:{'evidence.json':createHash('sha256').update(body).digest('hex')},project_count:1000,evidence_count:1,review_required:true}};
}
async function installRoutes(page,mode='valid'){
  const f=fixture();
  if(mode==='bad-digest')f.pointer.sha256['evidence.json']='0'.repeat(64);
  const data=JSON.parse(f.body);
  if(mode==='invalid-status')data.projects[0].status='VERIFIED';
  if(mode==='no-sources')data.sources=[];
  if(mode==='failed-source')data.sources[0].status='failed';
  if(mode==='unknown-rights')data.sources[0].rights_status='unknown';
  if(mode==='probe-only')data.sources[0].probe_only=true;
  if(mode==='not-eligible')data.sources[0].eligible_for_publication=false;
  if(mode==='missing-rights-receipt')delete data.sources[0].rights_review_url;
  if(mode==='duplicate-source')data.sources.push({...data.sources[0]});
  if(mode==='missing-source-reference')data.projects[0].evidence[0].source_id='unrecorded';
  if(mode==='invalid-run-time')data.source_run_at='2026-02-30T16:30:00Z';
  if(mode==='run-after-generation')data.source_run_at='2026-11-17T16:30:00Z';
  if(mode==='incorrect-scope')data.research_scope='All projects independently researched and verified';
  if(mode==='invalid-http-receipt')data.sources[0].http_status=403;
  if(mode==='invalid-source-hash')data.sources[0].response_sha256='not-a-hash';
  if(mode==='source-after-run')data.sources[0].fetched_at='2026-11-17T16:30:00Z';
  if(mode==='stale'){
    const old='2026-11-08T16:30:00Z';
    data.source_run_at=old;data.sources[0].fetched_at=old;
    for(const project of data.projects){
      project.last_researched_at=old;
      for(const article of project.evidence){article.first_seen=old;article.last_seen=old;article.pub_date=old;}
    }
  }
  if(mode==='retained-source'){
    data.sources[0].fetched_at='2026-11-01T16:30:00Z';
    data.sources.push({...data.sources[0],id:'current_fixture_only',fetched_at:generated});
    Object.assign(data.projects[0].evidence[0],{first_seen:'2026-11-01T16:30:00Z',last_seen:'2026-11-01T16:30:00Z',pub_date:'2026-11-01T16:30:00Z'});
  }
  f.body=JSON.stringify(data);
  if(mode!=='bad-digest')f.pointer.sha256['evidence.json']=createHash('sha256').update(f.body).digest('hex');
  await page.clock.setFixedTime(new Date('2026-11-17T16:30:00Z'));
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
  await expect(page.locator('#evidenceCoverage')).toHaveAttribute('data-selection-count','1000');
  await expect(page.locator('#tbody')).toHaveAttribute('data-complete','true');
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
}
test('provisional evidence, escaping, search, map contract, and full CSV',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installRoutes(page);await ready(page);
  await expect(page.locator('#solar1000Pilot')).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'UK projects',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'Global data centres',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Boolean(document.querySelector('.newspaper').compareDocumentPosition(document.querySelector('#officialRegister')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.screenshot({path:testInfo.outputPath('dashboard-overview.png')});
  await expect(page.locator('[data-evidence-status]')).toContainText('1 provisional matches');
  await page.locator('#search').fill('1018');
  await page.locator('#repd-1018 .project-record > summary').click();
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
  await page.locator('#repd-1018 .project-record').screenshot({path:testInfo.outputPath('evidence-panel.png')});
  const map=page.locator('#repd-1018 a.atlaslink');
  await expect(map).toHaveAttribute('target','_blank');
  const mapURL=new URL(await map.getAttribute('href'));
  expect(mapURL.protocol).toBe('https:');expect(mapURL.searchParams.get('repd_ref')).toBe('1018');
  expect(mapURL.searchParams.get('technology')).toBe('solar');
  await page.locator('#search').fill('1019');
  await page.locator('#repd-1019 .project-record > summary').click();
  await expect(page.locator('[data-evidence-project="1019"] summary')).toHaveText('Evidence · Provisional: 0');
  await page.locator('#clearFilters').click();
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportInline').click();
  const download=await downloadPromise;
  const csv=await readFile(await download.path(),'utf8');
  expect(csv).toContain('1018');
  expect(csv.trim().split(/\r?\n/)).toHaveLength(7776);
  expect(errors).toEqual([]);
});
for(const mode of ['unavailable','bad-digest','invalid-status','no-sources','failed-source','unknown-rights','probe-only','not-eligible','missing-rights-receipt','duplicate-source','missing-source-reference','invalid-run-time','run-after-generation','incorrect-scope','invalid-http-receipt','invalid-source-hash','source-after-run'])test(`${mode} evidence preserves register and maps`,async({page})=>{
  await installRoutes(page,mode);await ready(page);
  await expect(page.locator('[data-evidence-status]')).toContainText('Evidence unavailable');
  await page.locator('#search').fill('1018');
  await page.locator('#repd-1018 .project-record > summary').click();
  await expect(page.locator('[data-evidence-project="1018"] summary')).toHaveText('Evidence · Unavailable');
  await expect(page.locator('#repd-1018 a.atlaslink')).toHaveAttribute('href',/repd_ref=1018/);
  await page.locator('#search').fill('');
  await page.locator('[data-technology="solar"]').click();
  await expect(page.locator('#resultsMeta')).toContainText('3,604');
});

test('stale collection remains explicitly overdue even when snapshot generation is recent',async({page})=>{
  await installRoutes(page,'stale');await ready(page);
  const status=page.locator('[data-evidence-status]');
  await expect(status).toContainText('Evidence snapshot 2026-11-16T16:30:00Z');
  await expect(status).toContainText('Last successful collection: 2026-11-08T16:30:00Z');
  await expect(status).toContainText('Overdue: more than 7 days since collection');
  await page.locator('#search').fill('1018');
  await page.locator('#repd-1018 .project-record > summary').click();
  const panel=page.locator('[data-evidence-project="1018"]');
  await expect(panel.locator('summary')).toContainText('Provisional: 1');
  await panel.locator('summary').click();
  await expect(panel).toContainText('Last successful collection: 2026-11-08T16:30:00Z');
});
test('retained evidence can reference an older successful source receipt',async({page})=>{
  await installRoutes(page,'retained-source');await ready(page);
  await expect(page.locator('[data-evidence-status]')).toContainText('1 provisional matches');
  await expect(page.locator('[data-evidence-status]')).toContainText('Last successful collection: 2026-11-16T16:30:00Z');
  await page.locator('#search').fill('1018');
  await page.locator('#repd-1018 .project-record > summary').click();
  await expect(page.locator('[data-evidence-project="1018"] summary')).toContainText('Provisional: 1');
});

test('one pipeline switches datasets without changing UK filters, totals or exports',async({page},testInfo)=>{
  await installRoutes(page);await ready(page);
  const uk=page.getByRole('tab',{name:'UK projects',exact:true});
  const global=page.getByRole('tab',{name:'Global data centres',exact:true});
  await global.click();
  await expect(global).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#globalProjectPanel')).toBeVisible();
  await expect(page.locator('#ukProjectsPanel')).toBeHidden();
  await expect(page.locator('#globalDatacentres')).toBeVisible();
  await page.locator('#officialRegister').screenshot({path:testInfo.outputPath('global-pipeline.png')});
  await global.press('ArrowLeft');
  await expect(uk).toBeFocused();
  await expect(uk).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
  await page.locator('[data-technology="bess"]').click();
  await expect(page.locator('[data-technology="bess"]')).toHaveAttribute('aria-pressed','true');
  await global.click();await uk.click();
  await expect(page.locator('[data-technology="bess"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#clearFilters').click();
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
});
