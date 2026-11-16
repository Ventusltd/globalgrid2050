import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const release='/uk_renewables_pipeline/202611161747/';
const directory=new URL('../../../../uk_renewables_pipeline/202611161747/prospecting/',import.meta.url);
const priorityRaw=await readFile(new URL('priority.json',directory));
const manifestRaw=await readFile(new URL('manifest.json',directory));
const csv=await readFile(new URL('priority.csv',directory));
const manifest=JSON.parse(manifestRaw),priority=JSON.parse(priorityRaw);
const ranked=priority.records[0],unranked=manifest.inventory.official_ids.find(id=>!priority.records.some(row=>row.id===id));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const live='https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/dist/pipeline_headlines.json';
// The prospecting bundle is actual pinned data. News below is an explicit offline fixture.
const newsFixture=JSON.parse(execFileSync(process.env.PYTHON||'python',['-c',`
import json
from automation.news.build_news_priority import build
from automation.news.tests.test_news_priority_export import document,raw
from automation.news.tests.test_news_algorithm import article
d=document([article('https://www.bloomberg.com/news/test-only','TEST FIXTURE: UK solar financing',source='Bloomberg'),article('https://www.gov.uk/news/test-only','TEST FIXTURE: UK solar planning policy',source='GOV.UK',category='policy')]);b=raw(d)
print(json.dumps({'raw':b.decode(),'rank':build(b)}))
`],{cwd:root,encoding:'utf8'}));

async function setup(page,mode='valid'){
  const origin=new URL(test.info().project.use.baseURL).origin;
  await page.clock.setFixedTime(new Date('2026-11-16T17:49:00Z'));
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url===live)return route.fulfill({contentType:'application/json',body:newsFixture.raw});
    if(url===live.replace(/\.json$/,'.rank.json'))return route.fulfill({contentType:'application/json',body:JSON.stringify(newsFixture.rank)});
    if(url===origin+release+'prospecting/manifest.json'&&mode==='manifest')return route.fulfill({contentType:'application/json',body:manifestRaw.toString()+' '});
    if(url===origin+release+'prospecting/priority.json'){
      if(mode==='missing')return route.fulfill({status:404,body:'unavailable'});
      if(mode==='malformed')return route.fulfill({contentType:'application/json',body:'{'});
      if(mode==='typed-source'){const bad=structuredClone(priority);bad.records[0].capacities.repd_installed_mw='1000';return route.fulfill({contentType:'application/json',body:JSON.stringify(bad)});}
    }
    if(url.startsWith(origin+'/'))return route.continue();
    return route.abort();
  });
  await page.goto(release);
  await expect(page.locator('#tbody')).toHaveAttribute('data-complete','true');
  await expect(page.locator('#resultsMeta')).toContainText('7,775');
  await page.waitForFunction(()=>['accepted','rejected'].includes(window.projectResearchPriorityState));
}

test('actual export reproduces and source modules remain identical',async()=>{
  const actual=JSON.parse(execFileSync(process.env.PYTHON||'python',['-c',`
import json,hashlib
from automation.news.build_prospecting_priority import build_artifacts
b=build_artifacts(as_of='2026-11-16T17:48:52Z')
c=lambda v:(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)+'\\n').encode()
b['priority.json']=c(json.loads(b['priority.json']))
m=json.loads(b['manifest.json']);m['files']['priority.json']={'sha256':hashlib.sha256(b['priority.json']).hexdigest(),'bytes':len(b['priority.json'])};b['manifest.json']=c(m)
print(json.dumps({k:hashlib.sha256(v).hexdigest() for k,v in b.items()}))
`],{cwd:root,encoding:'utf8'}));
  expect(actual).toEqual({'priority.json':hash(priorityRaw),'priority.csv':hash(csv),'manifest.json':hash(manifestRaw)});
  for(const name of ['adapter.mjs','bundle.mjs','view.mjs']){
    expect(await readFile(new URL(`../../../../uk_renewables_pipeline/202611161747/scripts/plugins/prospecting/${name}`,import.meta.url))).toEqual(await readFile(new URL(`../../prospecting-ui/${name}`,import.meta.url)));
  }
  expect(manifest.inventory.official_ids).toHaveLength(7775);expect(manifest.inventory.solar1000_ids).toHaveLength(1000);
  expect(priority.records.every(r=>r.research_state==='UNKNOWN'&&r.heat.state==='UNKNOWN'&&r.event_at===null)).toBe(true);
});

test('inline ranking, remarks, exact identity, rerenders, maps and full CSV',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
  await expect(page.locator('#researchPriorityStatus')).toContainText('1,000 ranked from 7,775');
  await expect(page.locator('#solar1000Pilot')).toHaveCount(0);
  await expect(page.locator('#evidenceCoverage')).toHaveAttribute('data-selection-count','1000');
  await expect(page.locator('#newsStatus')).toHaveAttribute('data-order','priority');
  await expect(page.locator('#newsStatus')).toContainText('not project verification');
  await expect(page.locator('#liveNews')).toContainText('Bloomberg');
  await expect(page.locator('#liveNews .ln-title').first()).toContainText('planning policy');
  await page.locator('#search').fill(ranked.id.slice(5));
  const row=page.locator('#repd-'+ranked.id.slice(5)),map=row.locator('a.atlaslink');
  const mapBefore=await map.getAttribute('href');expect(new URL(mapBefore).searchParams.get('repd_ref')).toBe(ranked.id.slice(5));
  await row.locator('.v927-priority-hint').click();
  const detail=row.locator('[data-priority-id]');await expect(detail).toHaveAttribute('open','');
  await expect(detail).toContainText('Momentum: unknown');await expect(detail).toContainText(ranked.research_note);
  await page.evaluate(()=>window.dispatchEvent(new Event('pipeline-projects-rendered')));
  await expect(row.locator('[data-priority-id]')).toHaveCount(1);await expect(detail).toHaveAttribute('open','');
  await expect(map).toHaveAttribute('href',mapBefore);
  await expect(detail.locator('a').first()).toHaveAttribute('href',ranked.source.url);
  await page.screenshot({path:info.outputPath('priority-project.png')});
  await page.locator('#search').fill(unranked.slice(5));await page.locator('#repd-'+unranked.slice(5)+' .project-record > summary').click();
  await expect(page.locator('#repd-'+unranked.slice(5)+' [data-priority-state]')).toHaveText('Outside this research-priority subset');
  await page.locator('#clearFilters').click();
  const downloading=page.waitForEvent('download');await page.locator('#exportInline').click();
  const full=await readFile(await(await downloading).path(),'utf8');expect(full.trim().split(/\r?\n/)).toHaveLength(7776);
  await page.getByText('How to interpret statuses, maps and news',{exact:true}).click();
  const researchDownload=page.waitForEvent('download');await page.locator('a[href="prospecting/priority.csv"]').click();
  expect(hash(await readFile(await(await researchDownload).path()))).toBe(manifest.files['priority.csv'].sha256);
  await page.getByRole('tab',{name:'Global data centres',exact:true}).click();await expect(page.locator('.gdc-card')).toHaveCount(12);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

for(const mode of ['missing','manifest','malformed','typed-source'])test(`${mode} priority leaves official dataset usable`,async({page})=>{
  await setup(page,mode);await expect(page.locator('#researchPriorityStatus')).toContainText('Research priority unavailable');
  await expect(page.locator('.v927-priority-hint')).toHaveCount(0);
  await page.locator('#search').fill('1018');await page.locator('#repd-1018 .project-record > summary').click();
  await expect(page.locator('#repd-1018 [data-priority-state]')).toHaveText('Research priority unavailable');
  await expect(page.locator('#repd-1018 a.atlaslink')).toHaveAttribute('href',/repd_ref=1018/);
  await page.locator('#clearFilters').click();await expect(page.locator('#resultsMeta')).toContainText('7,775');
});

test('failed reload clears previous rank without clearing project facts',async({page})=>{
  await setup(page);await page.locator('#search').fill(ranked.id.slice(5));await page.locator('.v927-priority-hint').click();
  await page.route('**/prospecting/manifest.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.evaluate(async()=>{const module=await import('./scripts/plugins/research-priority-v927.js?v=9.27');await module.reloadPriority();});
  await expect(page.locator('[data-priority-id]')).toHaveCount(0);await expect(page.locator('.v927-priority-hint')).toHaveCount(0);
  await expect(page.locator('[data-priority-state]')).toHaveText('Research priority unavailable');
  await expect(page.locator('#repd-'+ranked.id.slice(5)+' .record-grid')).toBeVisible();
});
